import type { CreateBranchRequest, UpdateBranchRequest } from '@drmayday/shared';
import { IsDefined, ValidateIf } from 'class-validator';
import { isPresent } from '../../common/is-present.js';
import { IsVietnamPhone } from '../../common/is-vietnam-phone.decorator.js';
import { NonBlankTextRule } from './field-rules.js';

/** POST /branches: cả ba trường bắt buộc. */
export class CreateBranchDto implements CreateBranchRequest {
  @IsDefined()
  @NonBlankTextRule()
  name: string;

  @IsDefined()
  @NonBlankTextRule()
  address: string;

  @IsDefined()
  @IsVietnamPhone()
  phone: string;
}

/** PUT /branches/:id: ít nhất một trường (BranchesService kiểm tra, 2001). */
export class UpdateBranchDto implements UpdateBranchRequest {
  @ValidateIf(isPresent)
  @NonBlankTextRule()
  name?: string;

  @ValidateIf(isPresent)
  @NonBlankTextRule()
  address?: string;

  @ValidateIf(isPresent)
  @IsVietnamPhone()
  phone?: string;
}
