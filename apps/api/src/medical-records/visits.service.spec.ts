import {
  DOCTOR_ID,
  OTHER_DOCTOR_ID,
  OTHER_PATIENT_ID,
  PATIENT_ID,
  doctorCaller,
  nurseCaller,
  patientCaller,
} from './caller.fixture.js';
import type { CreateVisitDto, UpdateVisitDto } from './dto/visit.dto.js';
import type { RecordLock } from './medical-record-mapping.js';
import { inProgressRecord, lockOf, medicalRecord } from './medical-record.fixture.js';
import type { Caller, RecordPermission } from './record-access.js';
import type { VisitChanges, VisitRecord, VisitStart } from './visit-mapping.js';
import { EMPTY_CHRONIC_VISIT, visitRecord } from './visit.fixture.js';
import type { VisitsRepository } from './visits.repository.js';
import { VisitsService } from './visits.service.js';

const only = (...permissions: RecordPermission[]) => new Set<RecordPermission>(permissions);
const createDto = (body: object = {}) => body as CreateVisitDto;
const updateDto = (body: object) => body as UpdateVisitDto;

/** Mã, data, HTTP status của AppException mà promise bị từ chối (null nếu thành công). */
const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { code?: string; data?: unknown; httpStatus?: number }) => ({
      code: error.code,
      data: error.data,
      httpStatus: error.httpStatus,
    }),
  );

/** Hồ sơ 12 đang khám do bác sĩ 5 phụ trách, đã có 1 phiên. */
const IN_PROGRESS = lockOf(inProgressRecord(DOCTOR_ID));

/** `lock`: RecordLock repository đọc sau khoá; `current`: phiên đang lưu (sửa phiên). */
function setup(lock: RecordLock = IN_PROGRESS, current: VisitRecord = visitRecord()) {
  let started: VisitStart | undefined;
  let changed: VisitChanges | undefined;
  const visits = {
    listByRecord: vi
      .fn<VisitsRepository['listByRecord']>()
      .mockResolvedValue({ patientId: PATIENT_ID, visits: [current] }),
    add: vi.fn<VisitsRepository['add']>(async (_id, decide) => {
      started = decide(lock);
      return visitRecord({
        id: 31,
        number: lock.maxVisitNumber + 1,
        date: started.date,
        roomId: started.roomId,
        roomName: null,
      });
    }),
    update: vi.fn<VisitsRepository['update']>(async (_id, decide) => {
      changed = decide(lock, current);
      return current;
    }),
  };
  const service = new VisitsService(visits as unknown as VisitsRepository);
  return { service, visits, started: () => started, changed: () => changed };
}

describe('VisitsService (spec B, mục 5.4, 6.3)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('list (GET /medical_records/:id/visits)', () => {
    it('nhân viên có view_medical_records: dạng đầy đủ (details có lõi và khối theo loại hồ sơ)', async () => {
      const { service } = setup();
      const [visit] = await service.list(nurseCaller(), 12);
      expect(visit).toMatchObject({
        visit_id: 30,
        visit_number: 1,
        details: { visit_kind: null, acute: null, chronic: EMPTY_CHRONIC_VISIT },
      });
    });

    it('bệnh nhân: hồ sơ của mình → details null (D-B21, MT-126); hồ sơ người khác → 3106', async () => {
      const { service } = setup();
      const [visit] = await service.list(patientCaller(), 12);
      expect(visit).toMatchObject({ visit_id: 30, details: null });
      await expect(
        codeOf(service.list(patientCaller({ userId: OTHER_PATIENT_ID }), 12)),
      ).resolves.toMatchObject({ code: '3106' });
    });

    it('nhân viên thiếu view_medical_records → 3101 trước khi đọc CSDL; không có hồ sơ → 4001', async () => {
      const { service, visits } = setup();
      await expect(
        codeOf(service.list(nurseCaller({ permissions: only() }), 12)),
      ).resolves.toMatchObject({ code: '3101' });
      expect(visits.listByRecord).not.toHaveBeenCalled();
      visits.listByRecord.mockResolvedValue(null);
      await expect(codeOf(service.list(nurseCaller(), 12))).resolves.toMatchObject({
        code: '4001',
      });
    });
  });

  describe('add (POST /medical_records/:id/visits)', () => {
    it('bác sĩ phụ trách: phiên do người gọi khám, ngày hôm nay giờ Việt Nam khi vắng visit_date (D-B23), phòng gửi lên', async () => {
      vi.useFakeTimers({ now: new Date('2026-11-15T17:00:00.000Z') });
      const { service, started } = setup();
      const data = await service.add(doctorCaller(), 12, createDto({ room_id: 2 }));
      expect(started()).toEqual({ doctorId: DOCTOR_ID, roomId: 2, date: '2026-11-16' });
      expect(data).toMatchObject({
        visit_id: 31,
        visit_number: 2,
        visit_date: '2026-11-16',
        room_id: 2,
      });
      expect(data.details).not.toBeNull();
    });

    it('visit_date gửi lên được dùng; room_id vắng → chưa phân phòng (MT-115)', async () => {
      const { service, started } = setup();
      await service.add(doctorCaller(), 12, createDto({ visit_date: '2026-11-20' }));
      expect(started()).toEqual({ doctorId: DOCTOR_ID, roomId: null, date: '2026-11-20' });
    });

    it('sau khi khoá: chờ tiếp nhận, nháp, đã huỷ → 4009; hoàn tất → 4003; bác sĩ khác → 3105; chưa có dòng nhanvien → 3101; không có hồ sơ → 4001', async () => {
      const cases: [RecordLock, Caller, string][] = [
        [lockOf(medicalRecord()), doctorCaller(), '4009'],
        [lockOf(medicalRecord({ status: 'draft' })), doctorCaller(), '4009'],
        [lockOf(inProgressRecord(DOCTOR_ID, { status: 'cancelled' })), doctorCaller(), '4009'],
        [lockOf(inProgressRecord(DOCTOR_ID, { status: 'completed' })), doctorCaller(), '4003'],
        [lockOf(inProgressRecord(OTHER_DOCTOR_ID)), doctorCaller(), '3105'],
        [IN_PROGRESS, doctorCaller({ hasStaffRow: false }), '3101'],
      ];
      for (const [lock, caller, code] of cases) {
        await expect(
          codeOf(setup(lock).service.add(caller, 12, createDto())),
        ).resolves.toMatchObject({ code });
      }
      const { service, visits } = setup();
      visits.add.mockResolvedValue(null);
      await expect(codeOf(service.add(doctorCaller(), 12, createDto()))).resolves.toMatchObject({
        code: '4001',
      });
    });
  });

  describe('update (PATCH /visits/:id)', () => {
    it('body không có trường → 2001 trước khi đọc CSDL', async () => {
      const { service, visits } = setup();
      await expect(
        codeOf(service.update(doctorCaller(), 30, updateDto({ chronic: {} }))),
      ).resolves.toMatchObject({ code: '2001' });
      expect(visits.update).not.toHaveBeenCalled();
    });

    it('không có phiên → 2003, HTTP 404 (F.7)', async () => {
      const { service, visits } = setup();
      visits.update.mockResolvedValue(null);
      await expect(
        codeOf(service.update(doctorCaller(), 30, updateDto({ fever: true }))),
      ).resolves.toEqual({ code: '2003', data: undefined, httpStatus: 404 });
    });

    it('sau khi khoá: hoàn tất → 4003 (D-B7 khoá cả phiên); chờ tiếp nhận → 4009; bác sĩ khác → 3105', async () => {
      const dto = updateDto({ fever: true });
      const cases: [RecordLock, string][] = [
        [lockOf(inProgressRecord(DOCTOR_ID, { status: 'completed' })), '4003'],
        [lockOf(medicalRecord()), '4009'],
        [lockOf(inProgressRecord(OTHER_DOCTOR_ID)), '3105'],
      ];
      for (const [lock, code] of cases) {
        await expect(
          codeOf(setup(lock).service.update(doctorCaller(), 30, dto)),
        ).resolves.toMatchObject({ code });
      }
    });

    it('hợp lệ: thay đổi theo luật gộp (tắt cờ phù vị trí khác xoá ghi rõ đang lưu); trả dạng nhân viên', async () => {
      const current = visitRecord({
        chronic: {
          ...EMPTY_CHRONIC_VISIT,
          angioedema_other_site: true,
          angioedema_other_site_detail: 'Mu bàn chân',
        },
      });
      const { service, changed } = setup(IN_PROGRESS, current);
      const data = await service.update(
        doctorCaller(),
        30,
        updateDto({ instructions: 'Uống thuốc đều', chronic: { angioedema_other_site: false } }),
      );
      expect(changed()).toEqual({
        instructions: 'Uống thuốc đều',
        core: {},
        acute: {},
        chronic: { angioedema_other_site: false, angioedema_other_site_detail: null },
      });
      expect(data.details).not.toBeNull();
    });
  });
});
