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
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { assertFullNameNotBlank } from '../users/assert-full-name.js';
import {
  toAdminUserDetail,
  toAssignUserData,
  toUserSummary,
  type ShapedUser,
} from '../users/user-mapping.js';
import { requireShape } from '../users/user-shape.js';
import { UsersRepository } from '../users/users.repository.js';
import type { ListUsersQuery } from './dto/admin-user.dto.js';

/**
 * Quản trị người dùng (spec A, mục 5.4). "Người dùng" = nguoi có taikhoan (D3); không có → 3007.
 * Tham chiếu (vai trò, chi nhánh) sai → 2003 kèm tên trường.
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

  /** Một trang người dùng (ma_nguoi tăng dần); `total` đếm mọi tài khoản khớp bộ lọc. */
  async list(query: ListUsersQuery): Promise<Paginated<AdminUserListItem>> {
    const page = await this.users.listPage({ roleId: query.role_id }, pageWindow(query));
    return new Paginated(page.items.map(toUserSummary), page.total);
  }

  async get(userId: number): Promise<AdminUserDetailData> {
    return toAdminUserDetail(await this.findUser(userId));
  }

  /**
   * Kiểm tra theo thứ tự: vai trò tồn tại (2003) → trùng số (3006). benh_nhan → nguoi + benhnhan +
   * taikhoan; vai trò khác → nguoi + taikhoan, chưa có nhanvien tới khi phân công (D5, MT-106).
   */
  async create(dto: CreateUserRequest): Promise<CreateUserResponseData> {
    const role = await this.roles.findById(dto.role_id);
    if (!role) throw invalidReference('role_id');
    if (await this.users.loginExists(dto.phone)) throw new AppException('3006');
    const user = await this.users.create(
      {
        fullName: dto.full_name,
        phone: dto.phone,
        passwordHash: await this.passwords.hash(dto.password),
        gender: dto.gender ?? null,
        roleId: role.id,
        isActive: dto.is_active !== 0,
      },
      role.name === PATIENT_ROLE_NAME ? { kind: 'patient' } : { kind: 'none' },
    );
    return toUserSummary(user);
  }

  /**
   * Kiểm tra theo thứ tự: ít nhất 1 trường (2001) → full_name không trống (2003) → tồn tại (3007) →
   * admin không tự khoá, không tự đổi vai trò (2003) → vai trò mới tồn tại và cùng nhóm (2003, MT-65).
   * Đổi vai trò, khoá, mở khoá làm mọi token cũ của người đó bị từ chối (spec A, mục 6.2).
   */
  async update(
    userId: number,
    dto: UpdateUserRequest,
    currentUserId: number,
  ): Promise<AdminUserDetailData> {
    requireChanges(dto);
    assertFullNameNotBlank(dto.full_name);
    const user = await this.findUser(userId);
    const roleChanged = dto.role_id !== undefined && dto.role_id !== user.roleId;
    if (userId === currentUserId && (dto.is_active === 0 || roleChanged)) {
      throw new AppException('2003', { field: 'id' });
    }
    if (dto.role_id !== undefined) await this.assertSameGroupRole(user, dto.role_id);
    const updated = await this.users.update(userId, dto);
    if (!updated) throw new AppException('3007');
    return toAdminUserDetail(requireShape(updated, this.logger));
  }

  /** Tự xoá → 2003; không có tài khoản → 3007; còn dữ liệu tham chiếu → 2003 (409) (D6, MT-107). */
  async remove(userId: number, currentUserId: number): Promise<void> {
    if (userId === currentUserId) throw new AppException('2003', { field: 'id' });
    if (!(await this.users.delete(userId))) throw new AppException('3007');
  }

  /** Tồn tại (3007) → không phải bệnh nhân (2003, id) → chi nhánh tồn tại (2003, branch_id). */
  async assign(userId: number, dto: AssignUserRequest): Promise<AssignUserResponseData> {
    const user = await this.findUser(userId);
    if (user.shape === 'patient') throw new AppException('2003', { field: 'id' });
    await this.facilities.assertBranchExists(dto.branch_id);
    await this.users.assign(userId, dto.branch_id);
    return toAssignUserData(userId, dto.branch_id);
  }

  /** Không có tài khoản → 3007; vai trò benh_nhan thiếu dòng benhnhan → 9901 (MT-112). */
  private async findUser(userId: number): Promise<ShapedUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    return requireShape(user, this.logger);
  }

  /** Chỉ đổi vai trò trong cùng nhóm: bệnh nhân ↔ benh_nhan, nhân viên ↔ vai trò khác (MT-65). */
  private async assertSameGroupRole(user: ShapedUser, roleId: number): Promise<void> {
    const role = await this.roles.findById(roleId);
    if (!role || (role.name === PATIENT_ROLE_NAME) !== (user.shape === 'patient')) {
      throw invalidReference('role_id');
    }
  }
}
