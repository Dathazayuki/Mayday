import type { AssignUserRequest } from '@drmayday/shared';
import { IsDefined, IsOptional } from 'class-validator';
import { IdRule } from '../../common/id.js';

/**
 * Nơi công tác trong body (create-staff, PUT admin/users/:id/assign): chi nhánh và khoa bắt buộc,
 * phòng không bắt buộc. Quan hệ cha–con do FacilitiesService.assertPlacement kiểm tra (sai → 2003).
 */
export class PlacementDto implements AssignUserRequest {
  @IsDefined()
  @IdRule()
  branch_id: number;

  @IsDefined()
  @IdRule()
  department_id: number;

  @IsOptional() // "Có thể null nếu không có phòng cố định"
  @IdRule()
  room_id?: number | null;
}
