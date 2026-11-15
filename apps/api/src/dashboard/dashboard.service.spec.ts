import type { MedicalRecordStatusCounts } from '@drmayday/shared';
import {
  DOCTOR_ID,
  adminCaller,
  doctorCaller,
  nurseCaller,
} from '../medical-records/caller.fixture.js';
import { inProgressRecord } from '../medical-records/medical-record.fixture.js';
import type { MedicalRecordsRepository } from '../medical-records/medical-records.repository.js';
import type { DayVisit } from '../medical-records/visit-mapping.js';
import type { VisitsRepository } from '../medical-records/visits.repository.js';
import { DashboardService } from './dashboard.service.js';

const COUNTS: MedicalRecordStatusCounts = {
  draft: 1,
  pending: 2,
  in_progress: 3,
  completed: 4,
  cancelled: 5,
};

/** Phiên 31 (lần 2) hôm nay của hồ sơ 12 đang khám, chưa phân phòng. */
const DAY_VISIT: DayVisit = {
  id: 31,
  recordId: 12,
  number: 2,
  recordType: 'MAN',
  recordStatus: 'in_progress',
  patientName: 'LÊ THỊ MAI',
  doctorName: 'NGUYỄN VĂN AN',
  roomName: null,
};

function setup() {
  const records = {
    countByStatus: vi.fn<MedicalRecordsRepository['countByStatus']>().mockResolvedValue(COUNTS),
    list: vi
      .fn<MedicalRecordsRepository['list']>()
      .mockResolvedValue({ items: [inProgressRecord(DOCTOR_ID)], total: 11 }),
  };
  const visits = {
    listOnDate: vi
      .fn<VisitsRepository['listOnDate']>()
      .mockResolvedValue({ items: [DAY_VISIT], total: 23 }),
  };
  const service = new DashboardService(
    records as unknown as MedicalRecordsRepository,
    visits as unknown as VisitsRepository,
  );
  return { service, records, visits };
}

describe('DashboardService (spec B, mục 5.5, 8.8; MT-123)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hôm nay theo giờ Việt Nam (17:30 UTC ngày 15 là ngày 16, D-B23); số đếm không lọc; phiên hôm nay 10 phần tử đầu kèm tổng', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T17:30:00.000Z'));
    const { service, records, visits } = setup();

    const data = await service.summary(nurseCaller());

    expect(data.today).toBe('2026-11-16');
    expect(records.countByStatus).toHaveBeenCalledWith({});
    expect(visits.listOnDate).toHaveBeenCalledWith('2026-11-16', { skip: 0, take: 10 });
    expect(data.status_counts).toEqual(COUNTS);
    expect(data.visits_today).toEqual({
      total: 23,
      items: [
        {
          visit_id: 31,
          medical_record_id: 12,
          visit_number: 2,
          record_type: 'MAN',
          record_status: 'in_progress',
          patient_name: 'LÊ THỊ MAI',
          doctor_name: 'NGUYỄN VĂN AN',
          room_name: null,
        },
      ],
    });
  });

  it('bác sĩ: my_queue = hồ sơ đang khám mình phụ trách (10 đầu, tổng thật), allowed_actions của chính người gọi', async () => {
    const { service, records } = setup();

    const data = await service.summary(doctorCaller());

    expect(records.list).toHaveBeenCalledWith(
      { status: 'in_progress', doctorId: DOCTOR_ID },
      { skip: 0, take: 10 },
    );
    expect(data.my_queue?.total).toBe(11);
    expect(data.my_queue?.items).toHaveLength(1);
    expect(data.my_queue?.items[0]).toMatchObject({
      medical_record_id: 12,
      status: 'in_progress',
      assigned_doctor_id: DOCTOR_ID,
      allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
    });
  });

  it('không phải bac_si (điều dưỡng, admin) → my_queue null, không đọc danh sách', async () => {
    for (const caller of [nurseCaller(), adminCaller()]) {
      const { service, records } = setup();
      expect((await service.summary(caller)).my_queue).toBeNull();
      expect(records.list).not.toHaveBeenCalled();
    }
  });
});
