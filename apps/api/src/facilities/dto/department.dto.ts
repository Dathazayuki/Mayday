import type { CreateDepartmentRequest, UpdateDepartmentRequest } from '@drmayday/shared';
import { IsDefined, IsOptional, ValidateIf } from 'class-validator';
import { IdQuery, IdRule } from '../../common/id.js';
import { isPresent } from '../../common/is-present.js';
import { NonBlankTextRule, TextRule } from './field-rules.js';

/** POST /departments. */
export class CreateDepartmentDto implements CreateDepartmentRequest {
  @IsDefined()
  @NonBlankTextRule()
  name: string;

  @IsOptional()
  @TextRule()
  description?: string;

  @IsDefined()
  @IdRule()
  branch_id: number;
}

/** PUT /departments/:id: ít nhất một trường; `description: null` xoá mô tả. */
export class UpdateDepartmentDto implements UpdateDepartmentRequest {
  @ValidateIf(isPresent)
  @NonBlankTextRule()
  name?: string;

  @IsOptional()
  @TextRule()
  description?: string | null;

  @ValidateIf(isPresent)
  @IdRule()
  branch_id?: number;
}

/** GET /departments?branch_id= (vắng hoặc rỗng = không lọc). */
export class ListDepartmentsQuery {
  @IdQuery()
  branch_id?: number;
}
