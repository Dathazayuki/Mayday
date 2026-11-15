import { applyDecorators } from '@nestjs/common';
import { OmitType, PickType } from '@nestjs/swagger';
import type { AdminUserListQuery, CreateUserRequest, UpdateUserRequest } from '@drmayday/shared';
import { IsIn, IsInt, IsOptional, ValidateIf } from 'class-validator';
import { CreateStaffDto } from '../../auth/dto/create-staff.dto.js';
import { IdQuery, IdRule } from '../../common/id.js';
import { isPresent } from '../../common/is-present.js';
import { PaginationQuery } from '../../common/paginated.js';
import { UpdateProfileDto } from '../../profile/dto/update-profile.dto.js';

/** is_active của Sheet: 1 hoạt động, 0 khoá. Không phải số nguyên → 2002, ngoài {0, 1} → 2003. */
const IsActiveFlag = () => applyDecorators(IsInt(), IsIn([0, 1]));

/** GET /admin/users?page=&limit=&role_id= (role_id vắng hoặc rỗng = không lọc). */
export class ListUsersQuery extends PaginationQuery implements AdminUserListQuery {
  @IdQuery()
  role_id?: number;
}

/**
 * POST /admin/users (admin01): như create-staff (tài khoản + vai trò), bỏ nơi công tác. Vai trò do
 * AdminUsersService kiểm tra (không tồn tại → 2003).
 */
export class CreateUserDto
  extends OmitType(CreateStaffDto, ['branch_id', 'department_id', 'room_id'] as const)
  implements CreateUserRequest
{
  @IsOptional() // "Mặc định là 1: active"
  @IsActiveFlag()
  is_active?: 0 | 1;
}

/**
 * PUT /admin/users/:id (admin04): ít nhất một trường (AdminUsersService kiểm tra, 2001). full_name,
 * gender theo đúng luật của PUT profile (full_name null hoặc trống → 2003 ở service; gender rỗng
 * hoặc null xoá giới tính).
 */
export class UpdateUserDto
  extends PickType(UpdateProfileDto, ['full_name', 'gender'] as const)
  implements UpdateUserRequest
{
  @ValidateIf(isPresent)
  @IdRule()
  role_id?: number;

  @ValidateIf(isPresent)
  @IsActiveFlag()
  is_active?: 0 | 1;
}
