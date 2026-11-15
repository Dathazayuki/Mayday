import type {
  AcceptMedicalRecordRequest,
  CloseMedicalRecordRequest,
  UpdateMedicalRecordStatusRequest,
} from '@drmayday/shared';
import { IsDefined, IsString } from 'class-validator';
import { IsStatusTarget } from '../../common/is-status-target.decorator.js';
import { ClinicalText, OptionalRoomId } from './clinical-field.decorators.js';

/** Trạng thái đích của PUT /medical_records/:id (medrec11). */
const CLOSE_STATUSES = ['completed', 'cancelled'] as const;

/** POST /medical_records/:id/accept (medrec07): body tuỳ chọn, chỉ có phòng của phiên đầu (MT-115). */
export class AcceptMedicalRecordDto implements AcceptMedicalRecordRequest {
  @OptionalRoomId()
  room_id?: number | null;
}

/**
 * PUT /medical_records/:id (medrec11): `status` thiếu → 2001, không phải chuỗi → 2002, ngoài {completed,
 * cancelled} → 4009; `instructions` như cột TEXT (D-B29): vắng = giữ dan_do, chuỗi rỗng = xoá.
 */
export class CloseMedicalRecordDto implements CloseMedicalRecordRequest {
  @IsDefined()
  @IsString()
  @IsStatusTarget(CLOSE_STATUSES)
  status: CloseMedicalRecordRequest['status'];

  @ClinicalText()
  instructions?: string | null;
}

/** PATCH /medical_records/:id/status (tab chỉ có trong Sheet): chỉ `cancelled` (khác → 4009). */
export class UpdateMedicalRecordStatusDto implements UpdateMedicalRecordStatusRequest {
  @IsDefined()
  @IsString()
  @IsStatusTarget(['cancelled'])
  status: 'cancelled';
}
