import { FIELD_LIMITS, type CreatePermissionRequest } from '@drmayday/shared';
import { IsDefined, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** POST /permissions — Sheet perm01. */
export class CreatePermissionDto implements CreatePermissionRequest {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_LIMITS.permission_name)
  @Matches(/\S/) // khớp ck_quyen_han_ten
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255) // quyenhan.mo_ta TEXT: giữ giới hạn API
  description?: string;
}
