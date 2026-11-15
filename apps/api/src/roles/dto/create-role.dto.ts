import type { CreateRoleRequest } from '@drmayday/shared';
import { IsDefined, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IdRule } from '../../common/id.js';

/** POST /roles — Sheet tab "POST /api/roles" (role01). Vai trò cha tồn tại hay không do RolesService kiểm tra (2003). */
export class CreateRoleDto implements CreateRoleRequest {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255) // roles.name varchar(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IdRule()
  parent_role_id?: number | null;
}
