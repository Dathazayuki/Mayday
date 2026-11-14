import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponseData, SignupResponseData } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { genderFromDb, genderToDb, normalizeFullName, roleIdOf } from '../users/user-mapping.js';
import { UsersRepository } from '../users/users.repository.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { JwtPayload } from './jwt-payload.js';
import { PasswordService } from './password.service.js';
import { TokenBlacklistRepository } from './token-blacklist.repository.js';

/** Vai trò của tài khoản tự đăng ký (tên theo seed). */
const PATIENT_ROLE = 'patient';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly passwords: PasswordService,
    private readonly blacklist: TokenBlacklistRepository,
    private readonly jwt: JwtService,
  ) {}

  /** Tạo tài khoản bệnh nhân (users + patients). Trùng số điện thoại → 3006. */
  async signup(dto: SignupDto): Promise<SignupResponseData> {
    if (await this.users.phoneExists(dto.phone)) throw new AppException('3006');
    const patientRole = await this.roles.findByName(PATIENT_ROLE);
    if (!patientRole) {
      throw this.corruptData(`Bảng roles chưa có vai trò "${PATIENT_ROLE}" (chưa seed?)`);
    }

    const user = await this.users.createPatient({
      fullName: normalizeFullName(dto.full_name),
      phone: dto.phone,
      passwordHash: await this.passwords.hash(dto.password),
      gender: dto.gender ? genderToDb(dto.gender) : null,
      patientRoleId: patientRole.role_id,
    });
    return {
      user_id: user.user_id,
      full_name: user.ho_ten,
      phone: user.so_dien_thoai,
      gender: genderFromDb(user.gioi_tinh),
      role_id: patientRole.role_id,
      is_active: user.is_active ? 1 : 0,
      created_at: user.created_at.toISOString(),
    };
  }

  /** Kiểm tra theo thứ tự: tồn tại (3007) → is_active (3101, MT-61) → mật khẩu (3008). */
  async login(dto: LoginDto): Promise<LoginResponseData> {
    const user = await this.users.findByPhone(dto.phone);
    if (!user) throw new AppException('3007');
    if (!user.is_active) throw new AppException('3101');
    if (!(await this.passwords.verify(dto.password, user.password_hash))) {
      throw new AppException('3008');
    }
    const roleId = roleIdOf(user);
    if (roleId === null) {
      throw this.corruptData(`Người dùng ${user.user_id} không có bản ghi staffs hoặc patients`);
    }

    // Login trả mọi trường kiểu string (MT-06).
    const payload: JwtPayload = {
      sub: String(user.user_id),
      role_id: String(roleId),
      jti: randomUUID(),
    };
    return {
      token: await this.jwt.signAsync(payload),
      user_info: {
        user_id: payload.sub,
        full_name: user.ho_ten,
        phone: user.so_dien_thoai,
        role_id: payload.role_id,
      },
    };
  }

  /** Thu hồi token hiện tại tới lúc nó hết hạn, xoá mọi FCM token của người dùng (MT-60). */
  async logout(payload: JwtPayload & { exp: number }): Promise<void> {
    const userId = Number(payload.sub);
    await this.blacklist.add({ jti: payload.jti, userId, expiresAt: new Date(payload.exp * 1000) });
    await this.users.deleteFcmTokens(userId);
  }

  /** Dữ liệu trong CSDL không nhất quán: ghi log để xử lý, client nhận 9901. */
  private corruptData(detail: string): AppException {
    this.logger.error(detail);
    return new AppException('9901');
  }
}
