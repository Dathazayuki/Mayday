import type {
  CreateTemplateRequest,
  Flag,
  TemplateListQuery,
  UpdateTemplateRequest,
} from '@drmayday/shared';
import { Transform } from 'class-transformer';
import { IsDefined, IsOptional, ValidateIf } from 'class-validator';
import { isPresent } from '../../common/is-present.js';
import { PaginationQuery } from '../../common/paginated.js';
import { isBlank } from '../../common/text.js';
import {
  CODE_TEMPLATE_MAX_LENGTH,
  CodeRule,
  FlagRule,
  LongTextRule,
  NonBlankTextRule,
  VARCHAR_MAX_LENGTH,
  VERSION_MAX_LENGTH,
} from './field-rules.js';

/** POST /templates (tmpl01): version mặc định "1.0", is_active mặc định "1" (do CSDL đặt). */
export class CreateTemplateDto implements CreateTemplateRequest {
  @IsDefined()
  @CodeRule(CODE_TEMPLATE_MAX_LENGTH)
  code_template: string;

  @IsDefined()
  @NonBlankTextRule(VARCHAR_MAX_LENGTH)
  name: string;

  @IsOptional()
  @LongTextRule()
  description?: string;

  @ValidateIf(isPresent)
  @NonBlankTextRule(VERSION_MAX_LENGTH)
  version?: string;

  @ValidateIf(isPresent)
  @FlagRule()
  is_active?: Flag;
}

/**
 * PUT /templates/:id (tmpl04): ít nhất một trường (TemplatesService kiểm tra, 2001);
 * `description: null` xoá mô tả.
 */
export class UpdateTemplateDto implements UpdateTemplateRequest {
  @ValidateIf(isPresent)
  @NonBlankTextRule(VARCHAR_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @LongTextRule()
  description?: string | null;

  @ValidateIf(isPresent)
  @NonBlankTextRule(VERSION_MAX_LENGTH)
  version?: string;

  @ValidateIf(isPresent)
  @FlagRule()
  is_active?: Flag;
}

/** GET /templates/all?page=&limit=&is_active= (is_active vắng hoặc rỗng = không lọc). */
export class ListTemplatesQuery extends PaginationQuery implements TemplateListQuery {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (isBlank(value) ? undefined : value))
  @FlagRule()
  is_active?: Flag;
}
