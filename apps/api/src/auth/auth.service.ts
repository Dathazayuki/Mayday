import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  CreateStaffResponseData,
  LoginResponseData,
  SignupResponseData,
} from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import type { Env } from '../config/env.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import type { RoleName } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import {
  requireRoleId,
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
import { OTP_SENDER, type OtpSender } from './otp-sender.js';
import { PasswordService } from './password.service.js';
import { TokenBlacklistRepository } from './token-blacklist.repository.js';

/** Vai trò của tài khoản tự đăng ký; create-staff không được tạo tài khoản vai trò này. */
const PATIENT_ROLE: RoleName = 'patient';

/** OTP khôi phục mật khẩu: 6 chữ số, hết hạn sau 10 phút (bảng mã 3005 "Sau 10 phút"). */
const OTP_DIGITS = 6;
const OTP_TTL_MS = 10 * 60 * 1000;

/** OTP ngẫu nhiên an toàn (crypto), đệm 0 ở đầu cho đủ OTP_DIGITS chữ số. */
function generateOtp(): string {
  return randomInt(0, 10 ** OTP_DIGITS)
    .toString()
    .padStart(OTP_DIGITS, '0');
}

/** Tách miền: khoá HMAC của OTP là JWT_SECRET, cũng là khoá ký JWT. */
const OTP_HMAC_PREFIX = 'otp-reset:';

/**
 * Giá trị lưu ở `users.reset_token`: HMAC-SHA256 (hex, 64 ký tự) của OTP với khoá bí mật của server,
 * không lưu OTP gốc. OTP chỉ có 10^6 giá trị nên SHA-256 trần dò ngược được ngay khi lộ CSDL; HMAC
 * thì cần thêm khoá. Mọi chỗ băm/đối chiếu OTP (reset-password sau này, MT-16) dùng hàm này.
 */
function hashOtp(otp: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(OTP_HMAC_PREFIX + otp)
    .digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly facilities: FacilitiesService,
    private readonly passwords: PasswordService,
    private readonly blacklist: TokenBlacklistRepository,
    private readonly jwt: JwtService,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Tạo tài khoản bệnh nhân (users + patients). Trùng số điện thoại → 3006. */
  async signup(dto: SignupDto): Promise<SignupResponseData> {
    if (await this.users.phoneExists(dto.phone)) throw new AppException('3006');
    const role = await this.roles.findByName(PATIENT_ROLE);
    if (!role) throw this.corruptData(`Bảng roles chưa có vai trò "${PATIENT_ROLE}" (chưa seed?)`);

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
    if (!role || role.name === PATIENT_ROLE) throw new AppException('2003', { field: 'role_id' });
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

  /**
   * Xoá mọi FCM token của người dùng (MT-60) rồi thu hồi token hiện tại tới lúc nó hết hạn.
   * Thu hồi là bước cuối: bước nào lỗi thì token vẫn dùng được để client gọi lại logout (cả hai
   * bước đều idempotent). Làm ngược lại, lỗi khi xoá FCM sẽ để thiết bị tiếp tục nhận thông báo
   * mà không đăng xuất lại được.
   */
  async logout(payload: JwtPayload & { exp: number }): Promise<void> {
    const userId = Number(payload.sub);
    await this.users.deleteFcmTokens(userId);
    await this.blacklist.add({ jti: payload.jti, userId, expiresAt: new Date(payload.exp * 1000) });
  }

  /**
   * Cấp OTP khôi phục mật khẩu (reset-password chờ MT-16). Chưa có kênh gửi → 9903 trước khi ghi gì,
   * để không đè reset_token đang dùng; không có số điện thoại → 3007. Lưu mã băm trước rồi mới gửi,
   * để OTP đã tới tay người dùng luôn có bản ghi để đối chiếu.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    if (!this.otpSender.isAvailable()) throw new AppException('9903');
    const user = await this.users.findByPhone(dto.phone);
    if (!user) throw new AppException('3007');

    const otp = generateOtp();
    const tokenHash = hashOtp(otp, this.config.get('JWT_SECRET', { infer: true }));
    await this.users.setResetToken(user.user_id, tokenHash, new Date(Date.now() + OTP_TTL_MS));
    await this.otpSender.send(dto.phone, otp);
  }

  /**
   * Kiểm tra theo thứ tự: confirm_password khớp new_password (2003) → người dùng tồn tại (3007) →
   * mật khẩu cũ (3009). Thành công thì thu hồi token hiện tại rồi mới ghi mật khẩu mới: nếu ghi lỗi,
   * người dùng chỉ phải đăng nhập lại bằng mật khẩu cũ. Làm ngược lại, lỗi khi thu hồi sẽ để mật
   * khẩu đã đổi trong khi client báo thất bại.
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
    await this.blacklist.add({ jti: jwt.jti, userId, expiresAt: new Date(jwt.exp * 1000) });
    await this.users.updatePasswordHash(userId, passwordHash);
  }

  /** Dữ liệu trong CSDL không nhất quán: ghi log để xử lý, client nhận 9901. */
  private corruptData(detail: string): AppException {
    this.logger.error(detail);
    return new AppException('9901');
  }
}
