import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  CreateStaffResponseData,
  LoginResponseData,
  SignupResponseData,
} from '@drmayday/shared';
import { AppException, invalidReference } from '../common/app.exception.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import { requirePatientRoleId } from '../roles/patient-role.js';
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import {
  toCreateStaffData,
  toLoginUserInfo,
  toSignupData,
  type NewAccount,
} from '../users/user-mapping.js';
import { UsersRepository } from '../users/users.repository.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { SignedJwtPayload, VerifiedJwt } from './jwt-payload.js';
import { OtpSender } from './otp-sender.js';
import { PasswordService } from './password.service.js';
import { ResetOtp } from './reset-otp.js';
import { issuedAtFor } from './revocation.js';
import { TokenDenylist } from './token-denylist.js';

/** Xác thực và tài khoản (Sheet tab 1.1–1.6, spec A, mục 5.3, 6). */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly facilities: FacilitiesService,
    private readonly passwords: PasswordService,
    private readonly denylist: TokenDenylist,
    private readonly resetOtp: ResetOtp,
    private readonly jwt: JwtService,
    private readonly otpSender: OtpSender,
  ) {}

  /** Bệnh nhân = nguoi + benhnhan + taikhoan vai trò benh_nhan, một nested create. Số đã có tài khoản → 3006. */
  async signup(dto: SignupDto): Promise<SignupResponseData> {
    if (await this.users.loginExists(dto.phone)) throw new AppException('3006');
    const roleId = await requirePatientRoleId(this.roles, this.logger);
    const user = await this.users.create(await this.newAccount(dto, roleId), { kind: 'patient' });
    return toSignupData(user);
  }

  /**
   * Nhân viên = nguoi + nhanvien (chi nhánh) + taikhoan. Kiểm tra theo thứ tự: vai trò tồn tại và
   * khác benh_nhan (2003) → chi nhánh tồn tại (2003) → trùng số (3006).
   */
  async createStaff(dto: CreateStaffDto): Promise<CreateStaffResponseData> {
    const role = await this.roles.findById(dto.role_id);
    if (!role || role.name === PATIENT_ROLE_NAME) throw invalidReference('role_id');
    await this.facilities.assertBranchExists(dto.branch_id);
    if (await this.users.loginExists(dto.phone)) throw new AppException('3006');
    const user = await this.users.create(await this.newAccount(dto, role.id), {
      kind: 'staff',
      branchId: dto.branch_id,
    });
    return toCreateStaffData(user, dto.branch_id);
  }

  /**
   * Thứ tự: tồn tại (3007) → trang_thai_hoat_dong (3101, MT-61) → mật khẩu (3008). Vai trò nằm ở
   * taikhoan nên không còn 9901 khi thiếu bản ghi subtype. `iat` theo mốc thu hồi (D8).
   */
  async login(dto: LoginDto): Promise<LoginResponseData> {
    const user = await this.users.findByLogin(dto.phone);
    if (!user) throw new AppException('3007');
    if (!user.isActive) throw new AppException('3101');
    if (!(await this.passwords.verify(dto.password, user.passwordHash))) {
      throw new AppException('3008');
    }
    const payload: SignedJwtPayload = {
      sub: String(user.userId),
      role_id: String(user.roleId),
      jti: randomUUID(),
      iat: issuedAtFor(Date.now(), user.accountUpdatedAt),
    };
    return { token: await this.jwt.signAsync(payload), user_info: toLoginUserInfo(user) };
  }

  /** Chặn jti của token hiện tại tới lúc hết hạn (spec A, mục 6.3). Không chạm CSDL. */
  async logout(jwt: VerifiedJwt): Promise<void> {
    this.denylist.add(jwt.jti, jwt.exp * 1000);
  }

  /**
   * OTP khôi phục mật khẩu, không ghi CSDL (spec A, mục 6.4). Chưa có kênh gửi → 9903, kiểm tra trước
   * tiên; số chưa có tài khoản → 3007.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    if (!this.otpSender.isAvailable()) throw new AppException('9903');
    const user = await this.users.findByLogin(dto.phone);
    if (!user) throw new AppException('3007');
    if (!user.isActive) throw new AppException('3101');
    const otp = this.resetOtp.issue({ accountId: user.accountId, passwordHash: user.passwordHash });
    await this.otpSender.send(dto.phone, otp);
  }

  /** Đặt lại mật khẩu bằng OTP 6 chữ số không lưu trữ (MT-16 / tương thích mayday-test). */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.users.findByLogin(dto.phone);
    if (!user) throw new AppException('3007');
    if (!user.isActive) throw new AppException('3101');
    const check = this.resetOtp.verify(
      { accountId: user.accountId, passwordHash: user.passwordHash },
      dto.otp,
    );
    if (check === 'invalid') throw new AppException('3004');
    if (check === 'expired' || check === 'locked') throw new AppException('3005');
    const passwordHash = await this.passwords.hash(dto.new_password);
    await this.users.updatePasswordHash(user.userId, passwordHash);
  }

  /**
   * Thứ tự lỗi: confirm_password (2003) → tài khoản (3007) → mật khẩu cũ (3009). Ghi hash mới làm
   * trigger đổi thoi_diem_cap_nhat: mọi token cũ của tài khoản bị 3001 (MT-95). Thêm jti hiện tại vào
   * denylist phòng khi đồng hồ CSDL chậm hơn API (spec A, mục 6.2).
   */
  async changePassword(jwt: VerifiedJwt, dto: ChangePasswordDto): Promise<void> {
    if (dto.confirm_password !== dto.new_password) {
      throw new AppException('2003', { field: 'confirm_password' });
    }
    const userId = Number(jwt.sub);
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    if (!(await this.passwords.verify(dto.old_password, user.passwordHash))) {
      throw new AppException('3009');
    }
    const passwordHash = await this.passwords.hash(dto.new_password);
    this.denylist.add(jwt.jti, jwt.exp * 1000);
    await this.users.updatePasswordHash(userId, passwordHash);
  }

  private async newAccount(dto: SignupDto, roleId: number): Promise<NewAccount> {
    return {
      fullName: dto.full_name,
      phone: dto.phone,
      passwordHash: await this.passwords.hash(dto.password),
      gender: dto.gender ?? null,
      roleId,
    };
  }
}
