import type { SetRolePermissionsRequest } from '@drmayday/shared';
import { ArrayNotEmpty, IsArray, IsDefined, IsInt } from 'class-validator';

/**
 * POST /role_permissions — Sheet roleperm01. Mảng rỗng → 2001, phần tử không phải số nguyên → 2002;
 * vai trò và các quyền tồn tại hay không do RolePermissionsService kiểm tra (2003).
 */
export class SetRolePermissionsDto implements SetRolePermissionsRequest {
  @IsDefined()
  @IsInt()
  role_id: number;

  @IsDefined()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  permissions: number[];
}
