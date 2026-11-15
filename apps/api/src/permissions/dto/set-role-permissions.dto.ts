import type { SetRolePermissionsRequest } from '@drmayday/shared';
import { ArrayNotEmpty, IsArray, IsDefined } from 'class-validator';
import { IdRule } from '../../common/id.js';

/**
 * POST /role_permissions — Sheet roleperm01. Mảng rỗng → 2001, phần tử không phải số nguyên → 2002,
 * vượt INT tối đa → 2003 (luật id chung, common/id.ts);
 * vai trò và các quyền tồn tại hay không do RolePermissionsService kiểm tra (2003).
 */
export class SetRolePermissionsDto implements SetRolePermissionsRequest {
  @IsDefined()
  @IdRule()
  role_id: number;

  @IsDefined()
  @IsArray()
  @ArrayNotEmpty()
  @IdRule({ each: true })
  permissions: number[];
}
