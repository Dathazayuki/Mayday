import { FIELD_LIMITS, type CreateBranchRequest, type UpdateBranchRequest } from '@drmayday/shared';
import { IsDefined, ValidateIf } from 'class-validator';
import { isPresent } from '../../common/is-present.js';
import { IsVietnamPhone } from '../../common/is-vietnam-phone.decorator.js';
import { NonBlankTextRule } from './field-rules.js';

/** chinhanh.dia_chi là TEXT: giữ giới hạn API. */
const ADDRESS_MAX_LENGTH = 255;

/** POST /branches: cả ba trường bắt buộc. */
export class CreateBranchDto implements CreateBranchRequest {
  @IsDefined()
  @NonBlankTextRule(FIELD_LIMITS.branch_name)
  name: string;

  @IsDefined()
  @NonBlankTextRule(ADDRESS_MAX_LENGTH)
  address: string;

  @IsDefined()
  @IsVietnamPhone()
  phone: string;
}

/** PUT /branches/:id: ít nhất một trường (BranchesService kiểm tra, 2001). */
export class UpdateBranchDto implements UpdateBranchRequest {
  @ValidateIf(isPresent)
  @NonBlankTextRule(FIELD_LIMITS.branch_name)
  name?: string;

  @ValidateIf(isPresent)
  @NonBlankTextRule(ADDRESS_MAX_LENGTH)
  address?: string;

  @ValidateIf(isPresent)
  @IsVietnamPhone()
  phone?: string;
}
