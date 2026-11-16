import { Injectable, Logger } from '@nestjs/common';
import {
  vietnamDate,
  type AcceptMedicalRecordData,
  type MedicalRecordData,
  type MedicalRecordHistoryItem,
  type MedicalRecordListItem,
  type MedicalRecordStatusCounts,
  type MedicalRecordStatusData,
  type MedicalRecordSummary,
} from '@drmayday/shared';
import { AppException, corruptData } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
import type {
  CreateMedicalRecordDto,
  ListMedicalRecordsQuery,
  StatusCountsQuery,
  UpdateMedicalRecordDto,
} from './dto/medical-record.dto.js';
import type { AcceptMedicalRecordDto, CloseMedicalRecordDto } from './dto/transition.dto.js';
import {
  toAcceptMedicalRecordData,
  toMedicalRecordData,
  toMedicalRecordHistoryItem,
  toMedicalRecordListItem,
  toMedicalRecordStatusData,
  toMedicalRecordSummary,
  type MedicalRecord,
  type NewMedicalRecord,
  type RecordFilter,
} from './medical-record-mapping.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import {
  allowedActions,
  assertAssignedDoctor,
  assertCanAccept,
  assertCanCancel,
  assertCanEdit,
  assertOwnRecord,
  assertPatientBody,
  recordState,
  requireStaffPermission,
  type Caller,
} from './record-access.js';
import { planNewRecord, planRecordChanges, requireRecordChanges } from './record-changes.js';
import { RecordTransitionsRepository } from './record-transitions.repository.js';
import { TRANSITION_TARGETS } from './record-transitions.js';

/** Bộ lọc chung của danh sách và số đếm (spec B, mục 5.3). */
function filterOf(query: StatusCountsQuery): Omit<RecordFilter, 'status'> {
  return { patientId: query.patient_id, type: query.record_type, doctorId: query.doctor_id };
}

/**
 * Hồ sơ nhân viên tạo (medrec03): thiếu manage_medical_records → 3101 (trước khi đọc CSDL) → thiếu
 * patient_id → 2001 → khối lệch loại, cặp ghi rõ, cặp ngày (2003/2001). first_visit_at vắng → bây giờ (D-B9).
 */
function staffRecord(caller: Caller, dto: CreateMedicalRecordDto): NewMedicalRecord {
  requireStaffPermission(caller, 'manage_medical_records');
  if (dto.patient_id === undefined) throw new AppException('2001', { field: 'patient_id' });
  return {
    patientId: dto.patient_id,
    type: dto.record_type,
    status: 'pending',
    firstVisitAt: dto.first_visit_at ? new Date(dto.first_visit_at) : new Date(),
    ...planNewRecord(dto),
  };
}

/**
 * Hồ sơ bệnh nhân tự khai (D-B30): chỉ record_type + self_report (khác → 3101) → biểu hiện bệnh với hồ sơ
 * CAP (2003). Của chính người gọi: patient_id trong body bị bỏ qua (medrec03); first_visit_at để NULL tới
 * lúc tiếp nhận (D-B9).
 */
function selfReportedRecord(caller: Caller, dto: CreateMedicalRecordDto): NewMedicalRecord {
  assertPatientBody(dto);
  return {
    patientId: caller.userId,
    type: dto.record_type,
    status: 'pending',
    firstVisitAt: null,
    ...planNewRecord(dto),
  };
}

/**
 * Hồ sơ bệnh án (spec B, mục 5.3): tạo, danh sách, số đếm, chi tiết, tóm tắt, lịch sử, sửa, xoá (B2); tiếp
 * nhận, hoàn tất/huỷ khi đang khám, huỷ (B3, mục 6.2). Thứ tự kiểm tra theo mục 6.3: quyền nhân viên (3101)
 * trước khi đọc CSDL; bệnh nhân chỉ hồ sơ của mình (3106); thao tác ghi khoá hồ sơ rồi mới xét trạng thái,
 * bác sĩ phụ trách và luật sau khi gộp. Route ghi dùng chung có nhánh bệnh nhân: tạo hồ sơ của mình, sửa
 * phần tự khai, tự huỷ khi hồ sơ chưa tiếp nhận (D-B30 → D-B32). Phiên khám ở VisitsService.
 */
@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  constructor(
    private readonly records: MedicalRecordsRepository,
    private readonly transitions: RecordTransitionsRepository,
  ) {}

  /**
   * medrec03, luôn ghi `pending` (D-B4): nhân viên tạo cho bệnh nhân bất kỳ (staffRecord), bệnh nhân tự
   * khai cho chính mình (selfReportedRecord). Không có dòng benhnhan: nhân viên → 3007; bệnh nhân → 9901
   * kèm log (tài khoản benh_nhan thiếu dòng benhnhan, MT-112).
   */
  async create(caller: Caller, dto: CreateMedicalRecordDto): Promise<MedicalRecordData> {
    const record = caller.isPatient ? selfReportedRecord(caller, dto) : staffRecord(caller, dto);
    const created = await this.records.create(record);
    if (created) return this.toData(caller, created);
    if (!caller.isPatient) throw new AppException('3007');
    throw corruptData(
      this.logger,
      `Tài khoản của người ${caller.userId} có vai trò ${PATIENT_ROLE_NAME} nhưng không có dòng benhnhan (MT-112)`,
    );
  }

  /** medrec04 (route khai báo view_medical_records): phần tử kèm allowed_actions của người gọi. */
  async list(
    caller: Caller,
    query: ListMedicalRecordsQuery,
  ): Promise<Paginated<MedicalRecordListItem>> {
    const page = await this.records.list(
      { ...filterOf(query), status: query.status },
      pageWindow(query),
    );
    return new Paginated(
      page.items.map((record) =>
        toMedicalRecordListItem(record, allowedActions(caller, recordState(record))),
      ),
      page.total,
    );
  }

  /** status-counts (route khai báo view_medical_records): cùng bộ lọc với danh sách. */
  statusCounts(query: StatusCountsQuery): Promise<MedicalRecordStatusCounts> {
    return this.records.countByStatus(filterOf(query));
  }

  /** medrec05: nhân viên cần view_medical_records (3101); bệnh nhân chỉ hồ sơ của mình (3106). */
  async get(caller: Caller, recordId: number): Promise<MedicalRecordData> {
    requireStaffPermission(caller, 'view_medical_records');
    const record = await this.records.findById(recordId);
    if (!record) throw new AppException('4001');
    assertOwnRecord(caller, record.patientId);
    return this.toData(caller, record);
  }

  /** medrec06. */
  async summary(caller: Caller, recordId: number): Promise<MedicalRecordSummary> {
    requireStaffPermission(caller, 'view_medical_records');
    const record = await this.records.findOverview(recordId);
    if (!record) throw new AppException('4001');
    assertOwnRecord(caller, record.patientId);
    return toMedicalRecordSummary(record);
  }

  /** medrec13: bệnh nhân truyền id người khác → 3106 (trước khi đọc CSDL); id không phải bệnh nhân → 3007. */
  async history(caller: Caller, patientId: number): Promise<MedicalRecordHistoryItem[]> {
    requireStaffPermission(caller, 'view_medical_records');
    assertOwnRecord(caller, patientId);
    const records = await this.records.historyOf(patientId);
    if (!records) throw new AppException('3007');
    return records.map(toMedicalRecordHistoryItem);
  }

  /**
   * PATCH /medical_records/:id (spec B, mục 6.3): ít nhất 1 trường (2001) → nhân viên thiếu
   * manage_medical_records (3101) → khoá (4001) → bệnh nhân: hồ sơ người khác (3106) → ô trạng thái
   * (4003/4009) → người làm (nhân viên: bác sĩ phụ trách khi đang khám, 3105; bệnh nhân: hồ sơ đã tiếp
   * nhận, 3101) → bệnh nhân gửi trường ngoài self_report (3101, D-B30) → khối lệch loại, luật sau khi gộp
   * → ghi.
   */
  async update(
    caller: Caller,
    recordId: number,
    dto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    requireRecordChanges(dto);
    requireStaffPermission(caller, 'manage_medical_records');
    const updated = await this.records.update(recordId, (current) => {
      assertCanEdit(caller, recordState(current));
      if (caller.isPatient) assertPatientBody(dto);
      return planRecordChanges(current, dto);
    });
    if (!updated) throw new AppException('4001');
    return this.toData(caller, updated);
  }

  /** medrec14 (route chỉ admin): D-B22. */
  async remove(recordId: number): Promise<void> {
    if (!(await this.records.delete(recordId))) throw new AppException('4001');
  }

  /**
   * medrec07 (route chỉ bac_si có examine_medical_records): khoá (4001) → ô trạng thái (4004/4005) → dòng
   * nhanvien (3101, MT-106) → phòng (2003 room_id) → in_progress; phiên đầu do người gọi khám, ngày hôm
   * nay giờ Việt Nam, phòng gửi lên hoặc chưa phân phòng (D-B5, D-B23, MT-115); thoi_diem_kham_lan_dau
   * đang trống (hồ sơ tự khai) = lúc tiếp nhận (D-B9).
   */
  async accept(
    caller: Caller,
    recordId: number,
    dto: AcceptMedicalRecordDto,
  ): Promise<AcceptMedicalRecordData> {
    const acceptedAt = new Date();
    const result = await this.transitions.transition(recordId, (lock) => {
      assertCanAccept(caller, lock);
      return {
        status: TRANSITION_TARGETS.accept,
        firstVisitAtIfEmpty: acceptedAt,
        newVisit: {
          doctorId: caller.userId,
          roomId: dto.room_id ?? null,
          date: vietnamDate(acceptedAt),
        },
      };
    });
    if (!result) throw new AppException('4001');
    return toAcceptMedicalRecordData(result);
  }

  /**
   * medrec11 (route chỉ bac_si có examine_medical_records): khoá (4001) → ô trạng thái (4003/4009) → bác
   * sĩ phụ trách (3105) → completed/cancelled; instructions gửi lên ghi vào dan_do của phiên mới nhất
   * (D-B8), vắng thì giữ, chuỗi rỗng thì xoá.
   */
  async close(
    caller: Caller,
    recordId: number,
    dto: CloseMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    const transition = dto.status === 'completed' ? 'complete' : 'cancel_in_progress';
    const result = await this.transitions.transition(recordId, (lock) => {
      assertAssignedDoctor(caller, lock, transition);
      return { status: TRANSITION_TARGETS[transition], instructions: dto.instructions };
    });
    if (!result) throw new AppException('4001');
    return this.toData(caller, result.record);
  }

  /**
   * PATCH /medical_records/:id/status (route dùng chung; body đã qua ValidationPipe: chỉ `cancelled`, khác
   * → 4009): nhân viên thiếu manage_medical_records → 3101 trước khi đọc CSDL → khoá (4001) → bệnh nhân:
   * hồ sơ người khác (3106) → ô trạng thái (4003/4009) → người làm (nhân viên: bác sĩ phụ trách khi đang
   * khám, 3105; bệnh nhân: hồ sơ đã tiếp nhận, 3101) → cancelled (mục 6.1, 6.3, 7.2; D-B32).
   */
  async cancel(caller: Caller, recordId: number): Promise<MedicalRecordStatusData> {
    requireStaffPermission(caller, 'manage_medical_records');
    const result = await this.transitions.transition(recordId, (lock) => {
      assertCanCancel(caller, lock);
      return { status: TRANSITION_TARGETS.cancel };
    });
    if (!result) throw new AppException('4001');
    return toMedicalRecordStatusData(result.record);
  }

  private toData(caller: Caller, record: MedicalRecord): MedicalRecordData {
    return toMedicalRecordData(
      record,
      allowedActions(caller, recordState(record)),
      caller.isPatient ? 'patient' : 'staff',
    );
  }
}
