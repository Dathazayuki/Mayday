import { FIELD_LIMITS, type UpdatePermissionRequest } from '@drmayday/shared';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

/** PUT /permissions/:id — Sheet perm03. Cần ít nhất 1 trường (PermissionsService kiểm tra, 2001). */
export class UpdatePermissionDto implements UpdatePermissionRequest {
  @ValidateIf((_dto, value) => value !== undefined) // khác @IsOptional: name null không hợp lệ
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_LIMITS.permission_name)
  @Matches(/\S/) // khớp ck_quyen_han_ten
  name?: string;

  @IsOptional() // null xoá mô tả
  @IsString()
  @MaxLength(255) // quyenhan.mo_ta TEXT: giữ giới hạn API
  description?: string | null;
}
