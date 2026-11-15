import {
  FILLED_BY_VALUES,
  type CreateSectionRequest,
  type FilledBy,
  type Flag,
  type UpdateSectionRequest,
} from '@drmayday/shared';
import { IsDefined, IsIn, ValidateIf } from 'class-validator';
import { isPresent } from '../../common/is-present.js';
import { FlagRule, NonBlankTextRule, OrderRule, VARCHAR_MAX_LENGTH } from './field-rules.js';

/** POST /templates/:template_id/sections (sec01): is_required mặc định "0". */
export class CreateSectionDto implements CreateSectionRequest {
  @IsDefined()
  @NonBlankTextRule(VARCHAR_MAX_LENGTH)
  title: string;

  @IsDefined()
  @OrderRule()
  order: string | number;

  @ValidateIf(isPresent)
  @FlagRule()
  is_required?: Flag;

  @ValidateIf(isPresent)
  @IsIn(FILLED_BY_VALUES)
  filled_by?: FilledBy;
}

/** PUT /templates/sections/:id (sec02): ít nhất một trường (SectionsService kiểm tra, 2001). */
export class UpdateSectionDto implements UpdateSectionRequest {
  @ValidateIf(isPresent)
  @NonBlankTextRule(VARCHAR_MAX_LENGTH)
  title?: string;

  @ValidateIf(isPresent)
  @OrderRule()
  order?: string | number;

  @ValidateIf(isPresent)
  @FlagRule()
  is_required?: Flag;

  @ValidateIf(isPresent)
  @IsIn(FILLED_BY_VALUES)
  filled_by?: FilledBy;
}
