import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  CreateStaffResponseData,
  LoginResponseData,
  SignupResponseData,
} from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import type { RoleName } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import {
  roleIdOf,
  toCreateStaffData,
  toLoginUserInfo,
  toSignupData,
  type StaffAssignment,
} from '../users/user-mapping.js';
import { UsersRepository } from '../users/users.repository.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { JwtPayload } from './jwt-payload.js';
import { PasswordService } from './password.service.js';
import { TokenBlacklistRepository } from './token-blacklist.repository.js';

/** Vai trò của tài khoản tự đăng ký; create-staff không được tạo tài khoản vai trò này. */
const PATIENT_ROLE: RoleName = 'patient';

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
    const roleId = roleIdOf(user);
    if (roleId === null) {
      throw this.corruptData(`Người dùng ${user.user_id} không có bản ghi staffs hoặc patients`);
    }

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

  /** Dữ liệu trong CSDL không nhất quán: ghi log để xử lý, client nhận 9901. */
  private corruptData(detail: string): AppException {
    this.logger.error(detail);
    return new AppException('9901');
  }
}
