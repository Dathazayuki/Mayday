import type { DashboardSummaryData } from '@drmayday/shared';
import { medicalRecordListItem } from './medical-record-fixture';

/**
 * data mẫu của GET /dashboard/summary: hôm nay 16/11/2026; hai phiên hôm nay (một chưa phân phòng); bác sĩ
 * đăng nhập phụ trách hồ sơ 12 đang khám. Ghi đè từng phần bằng `overrides`.
 */
export function dashboardSummary(
  overrides: Partial<DashboardSummaryData> = {},
): DashboardSummaryData {
  return {
    today: '2026-11-16',
    status_counts: { draft: 1, pending: 2, in_progress: 3, completed: 4, cancelled: 5 },
    visits_today: {
      total: 2,
      items: [
        {
          visit_id: 32,
          medical_record_id: 14,
          visit_number: 1,
          record_type: 'CAP',
          record_status: 'in_progress',
          patient_name: 'TRẦN VĂN BÌNH',
          doctor_name: 'BÁC SĨ MẪU HAI',
          room_name: null,
        },
        {
          visit_id: 31,
          medical_record_id: 12,
          visit_number: 2,
          record_type: 'MAN',
          record_status: 'in_progress',
          patient_name: 'LÊ THỊ MAI',
          doctor_name: 'NGUYỄN VĂN AN',
          room_name: 'Phòng khám 1',
        },
      ],
    },
    my_queue: { total: 1, items: [medicalRecordListItem()] },
    ...overrides,
  };
}
