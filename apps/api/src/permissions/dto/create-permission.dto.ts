import type { CreatePermissionRequest } from '@drmayday/shared';
import { IsDefined, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /permissions — Sheet perm01. */
export class CreatePermissionDto implements CreatePermissionRequest {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255) // permissions.name varchar(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
