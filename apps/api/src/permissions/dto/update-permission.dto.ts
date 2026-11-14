import type { UpdatePermissionRequest } from '@drmayday/shared';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/** PUT /permissions/:id — Sheet perm03. Cần ít nhất 1 trường (PermissionsService kiểm tra, 2001). */
export class UpdatePermissionDto implements UpdatePermissionRequest {
  @ValidateIf((_dto, value) => value !== undefined) // khác @IsOptional: name null không hợp lệ
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional() // null xoá mô tả
  @IsString()
  @MaxLength(255)
  description?: string | null;
}
