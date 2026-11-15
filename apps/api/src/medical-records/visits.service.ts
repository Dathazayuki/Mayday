import { Injectable } from '@nestjs/common';
import { vietnamDate, type VisitData } from '@drmayday/shared';
import { AppException, notFound } from '../common/app.exception.js';
import type { CreateVisitDto, UpdateVisitDto } from './dto/visit.dto.js';
import {
  assertAssignedDoctor,
  assertCanAddVisit,
  assertOwnRecord,
  requireStaffPermission,
  type Caller,
} from './record-access.js';
import { planVisitChanges, requireVisitChanges } from './visit-changes.js';
import { toVisitData } from './visit-mapping.js';
import { VisitsRepository } from './visits.repository.js';

/**
 * Phiên khám (spec B, mục 5.4): danh sách theo hồ sơ (route dùng chung: bệnh nhân chỉ hồ sơ của mình và
 * nhận `details: null`, D-B21), thêm và sửa phiên (route chỉ bac_si có examine_medical_records). Thao tác
 * ghi khoá hồ sơ (D-B2) rồi mới xét trạng thái và bác sĩ phụ trách (mục 6.3); hồ sơ đã hoàn tất khoá cả
 * phiên khám (4003, D-B7).
 */
@Injectable()
export class VisitsService {
  constructor(private readonly visits: VisitsRepository) {}

  /** GET /medical_records/:id/visits: nhân viên thiếu view_medical_records → 3101 trước khi đọc CSDL → 4001 → bệnh nhân khác → 3106. */
  async list(caller: Caller, recordId: number): Promise<VisitData[]> {
    requireStaffPermission(caller, 'view_medical_records');
    const found = await this.visits.listByRecord(recordId);
    if (!found) throw new AppException('4001');
    assertOwnRecord(caller, found.patientId);
    const view = caller.isPatient ? 'patient' : 'staff';
    return found.visits.map((visit) => toVisitData(visit, view));
  }

  /**
   * POST /medical_records/:id/visits: khoá (4001) → ô trạng thái (4003/4009) → bác sĩ phụ trách (3105) →
   * dòng nhanvien (3101) → phòng (2003) → phiên lan_kham_thu = MAX + 1, ngày = visit_date hoặc hôm nay giờ
   * Việt Nam, bác sĩ = người gọi (mục 6.2).
   */
  async add(caller: Caller, recordId: number, dto: CreateVisitDto): Promise<VisitData> {
    const today = vietnamDate();
    const visit = await this.visits.add(recordId, (lock) => {
      assertCanAddVisit(caller, lock);
      return {
        doctorId: caller.userId,
        roomId: dto.room_id ?? null,
        date: dto.visit_date ?? today,
      };
    });
    if (!visit) throw new AppException('4001');
    return toVisitData(visit, 'staff');
  }

  /**
   * PATCH /visits/:id: ít nhất 1 trường (2001) → không có phiên → 2003 (HTTP 404, F.7) → khoá → ô trạng thái
   * (4003/4009) → bác sĩ phụ trách (3105) → khối lệch loại, luật sau khi gộp (visit-changes.ts) → phòng
   * (2003) → UPDATE cột được gửi.
   */
  async update(caller: Caller, visitId: number, dto: UpdateVisitDto): Promise<VisitData> {
    requireVisitChanges(dto);
    const visit = await this.visits.update(visitId, (lock, current) => {
      assertAssignedDoctor(caller, lock, 'visit');
      return planVisitChanges(current, dto);
    });
    if (!visit) throw notFound();
    return toVisitData(visit, 'staff');
  }
}
