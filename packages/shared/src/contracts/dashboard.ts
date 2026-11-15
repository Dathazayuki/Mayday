import type {
  MedicalRecordListItem,
  MedicalRecordStatus,
  MedicalRecordStatusCounts,
  RecordType,
} from './medical-records.js';

/**
 * Contract trang Tổng quan (spec B, mục 5.5, 8.8; MT-123 đã chốt bản tối thiểu): chỉ từ dữ liệu của B.
 */

/** Số phần tử tối đa của mỗi khối danh sách ở Tổng quan; `total` vẫn là tổng số thật. */
export const DASHBOARD_LIST_LIMIT = 10;

/** Một khối danh sách của Tổng quan: tổng số và tối đa DASHBOARD_LIST_LIMIT phần tử đầu. */
export interface DashboardList<T> {
  total: number;
  items: T[];
}

/** Phần tử "Phiên khám hôm nay": phiên + hồ sơ của phiên (mới nhất trước). */
export interface TodayVisitItem {
  visit_id: number;
  medical_record_id: number;
  visit_number: number;
  record_type: RecordType;
  /** Trạng thái hiện tại của hồ sơ. */
  record_status: MedicalRecordStatus;
  patient_name: string;
  doctor_name: string;
  /** null "khi chưa phân phòng" (MT-115). */
  room_name: string | null;
}

/** data của GET /dashboard/summary (MT-123). */
export interface DashboardSummaryData {
  /** Hôm nay theo giờ Việt Nam, `YYYY-MM-DD` (D-B23). */
  today: string;
  /** Như GET /medical_records/status-counts không lọc. */
  status_counts: MedicalRecordStatusCounts;
  /** Phiên có ngày khám = `today`. */
  visits_today: DashboardList<TodayVisitItem>;
  /** Hồ sơ đang khám mà người gọi là bác sĩ phụ trách; null khi người gọi không phải `bac_si`. */
  my_queue: DashboardList<MedicalRecordListItem> | null;
}
