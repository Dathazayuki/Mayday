import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminUserDetailData,
  AdminUserListItem,
  AssignUserRequest,
  AssignUserResponseData,
  CreateUserRequest,
  CreateUserResponseData,
  UpdateUserRequest,
} from '@drmayday/shared';
import { PasswordService } from '../auth/password.service.js';
import { AppException, invalidReference } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
import { requireChanges } from '../common/require-changes.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import type { Placement } from '../facilities/placement.js';
import { PATIENT_ROLE } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { assertFullNameNotBlank } from '../users/assert-full-name.js';
import { requireRoleId } from '../users/require-role-id.js';
import {
  isPatient,
  isStaff,
  toAdminUserDetail,
  toAssignUserData,
  toUserSummary,
  type NewUser,
  type UserRecord,
} from '../users/user-mapping.js';
import { UsersRepository } from '../users/users.repository.js';
import type { ListUsersQuery } from './dto/admin-user.dto.js';

/**
 * Quản trị người dùng (spec giai đoạn 2, mục 3.3). Người dùng không tồn tại → 3007; tham chiếu
 * (vai trò, nơi công tác) sai → 2003 kèm tên trường.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly facilities: FacilitiesService,
    private readonly passwords: PasswordService,
  ) {}

  /** Một trang người dùng (user_id tăng dần); `total` đếm mọi người dùng khớp bộ lọc. */
  async list(query: ListUsersQuery): Promise<Paginated<AdminUserListItem>> {
    const filter = { roleId: query.role_id };
    const [records, total] = await Promise.all([
      this.users.list(filter, pageWindow(query)),
      this.users.count(filter),
    ]);
    const items = records.map((record) =>
      toUserSummary(record, requireRoleId(record, this.logger)),
    );
    return new Paginated(items, total);
  }

  async get(userId: number): Promise<AdminUserDetailData> {
    return this.toDetail(await this.findUser(userId));
  }

  /**
   * Kiểm tra theo thứ tự: vai trò tồn tại (2003) → trùng số điện thoại (3006). Vai trò patient tạo
   * bản ghi `patients`, vai trò khác tạo `staffs` chưa có nơi công tác (phân công sau bằng assign).
   */
  async create(dto: CreateUserRequest): Promise<CreateUserResponseData> {
    const role = await this.roles.findById(dto.role_id);
    if (!role) throw invalidReference('role_id');
    if (await this.users.phoneExists(dto.phone)) throw new AppException('3006');

    const account: NewUser = {
      fullName: dto.full_name,
      phone: dto.phone,
      passwordHash: await this.passwords.hash(dto.password),
      gender: dto.gender ?? null,
      isActive: dto.is_active !== 0,
    };
    const user =
      role.name === PATIENT_ROLE
        ? await this.users.createPatient({ ...account, patientRoleId: role.role_id })
        : await this.users.createStaff({
            ...account,
            roleId: role.role_id,
            branchId: null,
            departmentId: null,
            roomId: null,
          });
    return toUserSummary(user, role.role_id);
  }

  /**
   * Kiểm tra theo thứ tự: có ít nhất 1 trường (2001) → full_name không trống (2003) → người dùng tồn
   * tại (3007) → vai trò mới tồn tại và cùng nhóm (2003). Trả chi tiết theo vai trò sau khi ghi.
   */
  async update(userId: number, dto: UpdateUserRequest): Promise<AdminUserDetailData> {
    requireChanges(dto);
    assertFullNameNotBlank(dto.full_name);
    const user = await this.findUser(userId);
    if (dto.role_id !== undefined) await this.assertSameGroupRole(user, dto.role_id);
    return this.toDetail(await this.users.update(user, dto));
  }

  /** Admin không được xoá chính mình (2003); người dùng không tồn tại → 3007. */
  async remove(userId: number, currentUserId: number): Promise<void> {
    if (userId === currentUserId) throw new AppException('2003', { field: 'id' });
    if (!(await this.users.delete(userId))) throw new AppException('3007');
  }

  /**
   * Kiểm tra theo thứ tự: người dùng tồn tại (3007) → là nhân viên (2003) → nơi công tác hợp lệ
   * (FacilitiesService, dùng chung với create-staff; 2003).
   */
  async assign(userId: number, dto: AssignUserRequest): Promise<AssignUserResponseData> {
    if (!isStaff(await this.findUser(userId))) throw new AppException('2003', { field: 'id' });
    const placement: Placement = {
      branchId: dto.branch_id,
      departmentId: dto.department_id,
      roomId: dto.room_id ?? null,
    };
    await this.facilities.assertPlacement(placement);
    await this.users.assign(userId, placement);
    return toAssignUserData(userId, placement);
  }

  private async findUser(userId: number): Promise<UserRecord> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    return user;
  }

  /** Chỉ đổi vai trò trong cùng nhóm: bệnh nhân ↔ patient, nhân viên ↔ vai trò khác (MT-65). */
  private async assertSameGroupRole(user: UserRecord, roleId: number): Promise<void> {
    const role = await this.roles.findById(roleId);
    if (!role || (role.name === PATIENT_ROLE) !== isPatient(user)) {
      throw invalidReference('role_id');
    }
  }

  /** Chi tiết theo vai trò; thiếu bản ghi staffs/patients → 9901 (requireRoleId). */
  private toDetail(record: UserRecord): AdminUserDetailData {
    return toAdminUserDetail(record, requireRoleId(record, this.logger));
  }
}
