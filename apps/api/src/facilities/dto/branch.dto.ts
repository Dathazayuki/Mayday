import type { CreateBranchRequest, UpdateBranchRequest } from '@drmayday/shared';
import { IsDefined, ValidateIf } from 'class-validator';
import { isPresent } from '../../common/is-present.js';
import { IsVietnamPhone } from '../../common/is-vietnam-phone.decorator.js';
import { NameRule, TextRule } from './field-rules.js';

/** POST /branches: cả ba trường bắt buộc. */
export class CreateBranchDto implements CreateBranchRequest {
  @IsDefined()
  @NameRule()
  name: string;

  @IsDefined()
  @TextRule()
  address: string;

  @IsDefined()
  @IsVietnamPhone()
  phone: string;
}

/** PUT /branches/:id: ít nhất một trường (BranchesService kiểm tra, 2001). */
export class UpdateBranchDto implements UpdateBranchRequest {
  @ValidateIf(isPresent)
  @NameRule()
  name?: string;

  @ValidateIf(isPresent)
  @TextRule()
  address?: string;

  @ValidateIf(isPresent)
  @IsVietnamPhone()
  phone?: string;
}
