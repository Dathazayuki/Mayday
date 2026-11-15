import type { AssignUserRequest } from '@drmayday/shared';
import { IsDefined } from 'class-validator';
import { IdRule } from '../../common/id.js';

/**
 * Nơi công tác trong body (create-staff, PUT admin/users/:id/assign): chỉ còn chi nhánh (spec A,
 * quyết định 11). Chi nhánh tồn tại hay không do FacilitiesService kiểm tra (2003).
 */
export class PlacementDto implements AssignUserRequest {
  @IsDefined()
  @IdRule()
  branch_id: number;
}
