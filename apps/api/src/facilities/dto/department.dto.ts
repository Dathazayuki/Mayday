import type { CreateDepartmentRequest, UpdateDepartmentRequest } from '@drmayday/shared';
import { Type } from 'class-transformer';
import { IsDefined, IsInt, IsOptional, ValidateIf } from 'class-validator';
import { isPresent } from '../../common/is-present.js';
import { NameRule, TextRule } from './field-rules.js';

/** POST /departments. */
export class CreateDepartmentDto implements CreateDepartmentRequest {
  @IsDefined()
  @NameRule()
  name: string;

  @IsOptional()
  @TextRule()
  description?: string;

  @IsDefined()
  @IsInt()
  branch_id: number;
}

/** PUT /departments/:id: ít nhất một trường; `description: null` xoá mô tả. */
export class UpdateDepartmentDto implements UpdateDepartmentRequest {
  @ValidateIf(isPresent)
  @NameRule()
  name?: string;

  @IsOptional()
  @TextRule()
  description?: string | null;

  @ValidateIf(isPresent)
  @IsInt()
  branch_id?: number;
}

/** GET /departments?branch_id= (query luôn là chuỗi nên cần chuyển sang số). */
export class ListDepartmentsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branch_id?: number;
}
