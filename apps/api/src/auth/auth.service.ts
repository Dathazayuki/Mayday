import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  CreateStaffResponseData,
  LoginResponseData,
  SignupResponseData,
} from '@drmayday/shared';
import { AppException, corruptData, invalidReference } from '../common/app.exception.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import { PATIENT_ROLE } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { requireRoleId } from '../users/require-role-id.js';
import {
  toCreateStaffData,
  toLoginUserInfo,
  toSignupData,
  type StaffAssignment,
} from '../users/user-mapping.js';
import { UsersRepository } from '../users/users.repository.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { JwtPayload, VerifiedJwt } from './jwt-payload.js';
import { OtpSender } from './otp-sender.js';
import { PasswordService } from './password.service.js';
import { ResetOtp } from './reset-otp.js';
import { TokenDenylist } from './token-denylist.js';

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

  /** Tạo tài khoản bệnh nhân (users + patients). Trùng số điện thoại → 3006. */
  async signup(dto: SignupDto): Promise<SignupResponseData> {
    if (await this.users.phoneExists(dto.phone)) throw new AppException('3006');
    const role = await this.roles.findByName(PATIENT_ROLE);
    if (!role) {
      throw corruptData(this.logger, `Bảng roles chưa có vai trò "${PATIENT_ROLE}" (chưa seed?)`);
    }

    const user = await this.users.createPatient({
      fullName: dto.full_name,
      phone: dto.phone,
      passwordHash: await this.passwords.hash(dto.password),
      gender: dto.gender ?? null,
      patientRoleId: role.role_id,
    });
    return toSignupData(user, role.role_id);
  }

  /**
   * Admin tạo tài khoản nhân viên (users + staffs). Kiểm tra theo thứ tự: vai trò tồn tại và không
   * phải patient → nơi công tác (FacilitiesService) → trùng số điện thoại; sai → 2003, trùng → 3006.
   */
  async createStaff(dto: CreateStaffDto): Promise<CreateStaffResponseData> {
    const role = await this.roles.findById(dto.role_id);
    if (!role || role.name === PATIENT_ROLE) throw invalidReference('role_id');
    const assignment: StaffAssignment = {
      roleId: role.role_id,
      branchId: dto.branch_id,
      departmentId: dto.department_id,
      roomId: dto.room_id ?? null,
    };
    await this.facilities.assertPlacement(assignment);
    if (await this.users.phoneExists(dto.phone)) throw new AppException('3006');

    const user = await this.users.createStaff({
      fullName: dto.full_name,
      phone: dto.phone,
      passwordHash: await this.passwords.hash(dto.password),
      gender: dto.gender ?? null,
      ...assignment,
    });
    return toCreateStaffData(user, assignment);
  }

  /** Kiểm tra theo thứ tự: tồn tại (3007) → is_active (3101, MT-61) → mật khẩu (3008). */
  async login(dto: LoginDto): Promise<LoginResponseData> {
    const user = await this.users.findByPhone(dto.phone);
    if (!user) throw new AppException('3007');
    if (!user.is_active) throw new AppException('3101');
    if (!(await this.passwords.verify(dto.password, user.password_hash))) {
      throw new AppException('3008');
    }
    const roleId = requireRoleId(user, this.logger);

    const payload: JwtPayload = {
      sub: String(user.user_id),
      role_id: String(roleId),
      jti: randomUUID(),
    };
    return { token: await this.jwt.signAsync(payload), user_info: toLoginUserInfo(user, roleId) };
  }

  /** Chặn jti của token hiện tại tới lúc hết hạn (spec A, mục 6.3). Không còn xoá FCM token (quyết định 14). */
  async logout(jwt: VerifiedJwt): Promise<void> {
    this.denylist.add(jwt.jti, jwt.exp * 1000);
  }

  /**
   * Gửi OTP khôi phục mật khẩu, không ghi CSDL (spec A, mục 6.4). Chưa có kênh gửi → 9903, kiểm tra
   * trước tiên; số chưa có tài khoản → 3007.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    if (!this.otpSender.isAvailable()) throw new AppException('9903');
    const user = await this.users.findByPhone(dto.phone);
    if (!user) throw new AppException('3007');
    const otp = this.resetOtp.issue({ accountId: user.user_id, passwordHash: user.password_hash });
    await this.otpSender.send(dto.phone, otp);
  }

  /**
   * Kiểm tra theo thứ tự: confirm_password khớp new_password (2003) → người dùng tồn tại (3007) →
   * mật khẩu cũ (3009). Thành công thì chặn jti hiện tại rồi ghi hash mới.
   */
  async changePassword(jwt: VerifiedJwt, dto: ChangePasswordDto): Promise<void> {
    if (dto.confirm_password !== dto.new_password) {
      throw new AppException('2003', { field: 'confirm_password' });
    }
    const userId = Number(jwt.sub);
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    if (!(await this.passwords.verify(dto.old_password, user.password_hash))) {
      throw new AppException('3009');
    }
    const passwordHash = await this.passwords.hash(dto.new_password);
    this.denylist.add(jwt.jti, jwt.exp * 1000);
    await this.users.updatePasswordHash(userId, passwordHash);
  }
}
