import { Injectable } from '@nestjs/common';
import { DASHBOARD_LIST_LIMIT, vietnamDate, type DashboardSummaryData } from '@drmayday/shared';
import type { PageWindow } from '../common/paginated.js';
import { toMedicalRecordListItem } from '../medical-records/medical-record-mapping.js';
import { MedicalRecordsRepository } from '../medical-records/medical-records.repository.js';
import {
  DOCTOR_ROLE,
  allowedActions,
  recordState,
  type Caller,
} from '../medical-records/record-access.js';
import { toTodayVisitItem } from '../medical-records/visit-mapping.js';
import { VisitsRepository } from '../medical-records/visits.repository.js';

/** Mỗi khối danh sách của Tổng quan lấy DASHBOARD_LIST_LIMIT phần tử đầu; `total` vẫn là tổng thật. */
const FIRST_ITEMS: PageWindow = { skip: 0, take: DASHBOARD_LIST_LIMIT };

/**
 * Tổng quan tối thiểu (spec B, mục 5.5, 8.8; MT-123 đã chốt): số hồ sơ theo trạng thái (như status-counts
 * không lọc), phiên khám có ngày khám là hôm nay giờ Việt Nam (D-B23), hồ sơ đang khám mà người gọi là bác
 * sĩ phụ trách (chỉ với bac_si). Đọc qua repository của bệnh án và phiên (mục 4.1); quyền
 * view_medical_records do route khai báo.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly records: MedicalRecordsRepository,
    private readonly visits: VisitsRepository,
  ) {}

  async summary(caller: Caller): Promise<DashboardSummaryData> {
    const today = vietnamDate();
    const [statusCounts, visitsToday, myQueue] = await Promise.all([
      this.records.countByStatus({}),
      this.visits.listOnDate(today, FIRST_ITEMS),
      caller.roleName === DOCTOR_ROLE
        ? this.records.list({ status: 'in_progress', doctorId: caller.userId }, FIRST_ITEMS)
        : null,
    ]);
    return {
      today,
      status_counts: statusCounts,
      visits_today: { total: visitsToday.total, items: visitsToday.items.map(toTodayVisitItem) },
      my_queue: myQueue && {
        total: myQueue.total,
        items: myQueue.items.map((record) =>
          toMedicalRecordListItem(record, allowedActions(caller, recordState(record))),
        ),
      },
    };
  }
}
