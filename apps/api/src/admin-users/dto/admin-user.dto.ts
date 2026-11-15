import { applyDecorators } from '@nestjs/common';
import {
  GENDER_VALUES,
  type AdminUserListQuery,
  type AssignUserRequest,
  type CreateUserRequest,
  type Gender,
  type UpdateUserRequest,
} from '@drmayday/shared';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SignupDto } from '../../auth/dto/signup.dto.js';
import { BlankAsNull } from '../../common/blank-as-null.decorator.js';
import { IdQuery, IdRule } from '../../common/id.js';
import { isPresent } from '../../common/is-present.js';
import { PaginationQuery } from '../../common/paginated.js';

/** is_active của Sheet: 1 hoạt động, 0 khoá. Không phải số nguyên → 2002, ngoài {0, 1} → 2003. */
const IsActiveFlag = () => applyDecorators(IsInt(), IsIn([0, 1]));

/** GET /admin/users?page=&limit=&role_id= (role_id vắng hoặc rỗng = không lọc). */
export class ListUsersQuery extends PaginationQuery implements AdminUserListQuery {
  @IdQuery()
  role_id?: number;
}

/**
 * POST /admin/users (admin01): các trường tài khoản như signup, cộng vai trò. Vai trò do
 * AdminUsersService kiểm tra (không tồn tại → 2003).
 */
export class CreateUserDto extends SignupDto implements CreateUserRequest {
  @IsDefined()
  @IdRule()
  role_id: number;

  @IsOptional() // "Mặc định là 1: active"
  @IsActiveFlag()
  is_active?: 0 | 1;
}

/**
 * PUT /admin/users/:id (admin04): ít nhất một trường (AdminUsersService kiểm tra, 2001). full_name
 * như PUT profile: null hoặc trống → 2003 ở service. gender rỗng hoặc null xoá giới tính.
 */
export class UpdateUserDto implements UpdateUserRequest {
  @IsOptional()
  @IsString()
  @MaxLength(255) // users.ho_ten varchar(255)
  full_name?: string;

  @BlankAsNull()
  @IsOptional()
  @IsIn(GENDER_VALUES)
  gender?: Gender | null;

  @ValidateIf(isPresent)
  @IdRule()
  role_id?: number;

  @ValidateIf(isPresent)
  @IsActiveFlag()
  is_active?: 0 | 1;
}

/**
 * PUT /admin/users/:id/assign (admin06): nơi công tác như create-staff, FacilitiesService kiểm tra
 * quan hệ cha–con (sai → 2003).
 */
export class AssignUserDto implements AssignUserRequest {
  @IsDefined()
  @IdRule()
  branch_id: number;

  @IsDefined()
  @IdRule()
  department_id: number;

  @IsOptional() // "ID phòng khám (nếu có)"
  @IdRule()
  room_id?: number | null;
}
