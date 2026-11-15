import { FIELD_LIMITS, type CreateRoleRequest } from '@drmayday/shared';
import { IsDefined, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Cột TEXT `vaitro.mo_ta_vai_tro`: giữ giới hạn API. */
const DESCRIPTION_MAX_LENGTH = 255;

/**
 * POST /roles — Sheet role01. Không còn parent_role_id (spec A, quyết định 7): client vẫn gửi thì bị
 * whitelist lược bỏ. Tên không chỉ gồm khoảng trắng (khớp `ck_vai_tro_ten`, `ck_vai_tro_hien_thi`).
 */
export class CreateRoleDto implements CreateRoleRequest {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_LIMITS.role_name)
  @Matches(/\S/)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(FIELD_LIMITS.role_display_name)
  @Matches(/\S/)
  display_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string;
}
