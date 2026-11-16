import { Logger } from '@nestjs/common';
import { Paginated } from '../common/paginated.js';
import {
  DOCTOR_ID,
  OTHER_DOCTOR_ID,
  OTHER_PATIENT_ID,
  PATIENT_ID,
  adminCaller,
  doctorCaller,
  nurseCaller,
  patientCaller,
} from './caller.fixture.js';
import type {
  CreateMedicalRecordDto,
  ListMedicalRecordsQuery,
  StatusCountsQuery,
  UpdateMedicalRecordDto,
} from './dto/medical-record.dto.js';
import type { AcceptMedicalRecordDto, CloseMedicalRecordDto } from './dto/transition.dto.js';
import type { MedicalRecord, RecordChanges } from './medical-record-mapping.js';
import { EMPTY_CORE, inProgressRecord, lockOf, medicalRecord } from './medical-record.fixture.js';
import type { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';
import type { Caller, RecordPermission } from './record-access.js';
import type { RecordTransitionsRepository, StatusChange } from './record-transitions.repository.js';

const NOW = new Date('2026-11-15T03:00:00.000Z');
const only = (...permissions: RecordPermission[]) => new Set<RecordPermission>(permissions);

/**
 * `current`: hồ sơ repository đọc sau khi khoá; `after`: hồ sơ đọc lại sau khi chuyển trạng thái (mặc
 * định như `current`). Mock `transition` gọi `decide` với RecordLock của `current`; phiên vừa mở là 31.
 */
function setup(current: MedicalRecord = medicalRecord(), after: MedicalRecord = current) {
  let decided: RecordChanges | undefined;
  let changed: StatusChange | undefined;
  const records = {
    findById: vi.fn<MedicalRecordsRepository['findById']>().mockResolvedValue(current),
    findOverview: vi.fn<MedicalRecordsRepository['findOverview']>().mockResolvedValue(current),
    create: vi.fn<MedicalRecordsRepository['create']>().mockResolvedValue(current),
    update: vi.fn<MedicalRecordsRepository['update']>(async (_id, decide) => {
      decided = decide(current);
      return current;
    }),
    delete: vi.fn<MedicalRecordsRepository['delete']>().mockResolvedValue(true),
    list: vi
      .fn<MedicalRecordsRepository['list']>()
      .mockResolvedValue({ items: [current], total: 41 }),
    countByStatus: vi.fn<MedicalRecordsRepository['countByStatus']>().mockResolvedValue({
      draft: 0,
      pending: 1,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    }),
    historyOf: vi.fn<MedicalRecordsRepository['historyOf']>().mockResolvedValue([current]),
  };
  const transitions = {
    transition: vi.fn<RecordTransitionsRepository['transition']>(async (_id, decide) => {
      changed = decide(lockOf(current));
      return { record: after, visitId: changed.newVisit ? 31 : null };
    }),
  };
  const service = new MedicalRecordsService(
    records as unknown as MedicalRecordsRepository,
    transitions as unknown as RecordTransitionsRepository,
  );
  return { service, records, transitions, decided: () => decided, changed: () => changed };
}

const createDto = (body: object) => ({ record_type: 'MAN', ...body }) as CreateMedicalRecordDto;
const updateDto = (body: object) => body as UpdateMedicalRecordDto;

/** Mã AppException mà promise bị từ chối. */
const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { code?: string; data?: unknown }) => ({ code: error.code, data: error.data }),
  );

describe('MedicalRecordsService (spec B, mục 5.3, 6.3)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create (medrec03)', () => {
    it('nhân viên có manage: trạng thái pending (D-B4), first_visit_at gửi lên, khối theo loại; trả dạng nhân viên kèm allowed_actions', async () => {
      const { service, records } = setup();
      const data = await service.create(
        nurseCaller(),
        createDto({
          patient_id: PATIENT_ID,
          first_visit_at: '2026-11-15T08:30:00+07:00',
          self_report: { onset_weeks: 10 },
          chronic: { main_diagnosis: 'CSU' },
        }),
      );
      expect(records.create).toHaveBeenCalledWith({
        patientId: PATIENT_ID,
        type: 'MAN',
        status: 'pending',
        firstVisitAt: new Date('2026-11-15T01:30:00.000Z'),
        selfReport: { onset_weeks: 10 },
        core: {},
        acute: {},
        chronic: { main_diagnosis: 'CSU' },
      });
      expect(data).toMatchObject({
        medical_record_id: 12,
        status: 'pending',
        allowed_actions: ['edit', 'cancel'],
      });
      expect(data.details).not.toBeNull();
    });

    it('vắng hoặc null first_visit_at → thời điểm hiện tại (D-B9: bệnh nhân đang ở viện)', async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, records } = setup();
      await service.create(doctorCaller(), createDto({ patient_id: PATIENT_ID }));
      await service.create(
        doctorCaller(),
        createDto({ patient_id: PATIENT_ID, first_visit_at: null }),
      );
      for (const [record] of records.create.mock.calls) expect(record.firstVisitAt).toEqual(NOW);
    });

    it('thứ tự mã của nhân viên: thiếu manage → 3101; thiếu patient_id → 2001; khối lệch loại → 2003; không gọi repository', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(
          service.create(
            nurseCaller({ permissions: only('view_medical_records') }),
            createDto({ patient_id: PATIENT_ID }),
          ),
        ),
      ).resolves.toMatchObject({ code: '3101' });
      await expect(codeOf(service.create(nurseCaller(), createDto({})))).resolves.toEqual({
        code: '2001',
        data: { field: 'patient_id' },
      });
      await expect(
        codeOf(
          service.create(
            nurseCaller(),
            createDto({ patient_id: PATIENT_ID, acute: { hospitalized: true } }),
          ),
        ),
      ).resolves.toEqual({ code: '2003', data: { field: 'acute' } });
      expect(records.create).not.toHaveBeenCalled();
    });

    it('không có dòng benhnhan → 3007', async () => {
      const { service, records } = setup();
      records.create.mockResolvedValue(null);
      await expect(
        codeOf(service.create(nurseCaller(), createDto({ patient_id: 99 }))),
      ).resolves.toMatchObject({
        code: '3007',
      });
    });
  });

  describe('create: bệnh nhân tự khai (D-B30)', () => {
    it('hồ sơ của chính người gọi (patient_id trong body bị bỏ qua), pending, first_visit_at NULL (D-B9), chỉ khối tự khai; trả dạng bệnh nhân kèm edit, cancel', async () => {
      const { service, records } = setup();
      const data = await service.create(
        patientCaller(),
        createDto({
          patient_id: OTHER_PATIENT_ID,
          self_report: { onset_weeks: 2, disease_manifestation: 'Chi san phu' },
        }),
      );
      expect(records.create).toHaveBeenCalledWith({
        patientId: PATIENT_ID,
        type: 'MAN',
        status: 'pending',
        firstVisitAt: null,
        selfReport: { onset_weeks: 2, disease_manifestation: 'Chi san phu' },
        core: {},
        acute: {},
        chronic: {},
      });
      expect(data).toMatchObject({ details: null, allowed_actions: ['edit', 'cancel'] });
    });

    it.each<object>([
      { first_visit_at: '2026-11-15T08:30:00+07:00' },
      { first_visit_at: null },
      { family_history: 'Co' },
      { acute: {} },
      { chronic: { main_diagnosis: 'CSU' } },
    ])('gửi %j (ngoài record_type, self_report) → 3101, không gọi repository', async (body) => {
      const { service, records } = setup();
      await expect(
        codeOf(service.create(patientCaller(), createDto({ self_report: {}, ...body }))),
      ).resolves.toEqual({ code: '3101', data: undefined });
      expect(records.create).not.toHaveBeenCalled();
    });

    it('biểu hiện bệnh với hồ sơ CAP → 2003 (field); gửi kèm trường của nhân viên thì 3101 xét trước', async () => {
      const { service } = setup();
      const selfReport = { disease_manifestation: 'Chi san phu' };
      await expect(
        codeOf(
          service.create(
            patientCaller(),
            createDto({ record_type: 'CAP', self_report: selfReport }),
          ),
        ),
      ).resolves.toEqual({ code: '2003', data: { field: 'self_report.disease_manifestation' } });
      await expect(
        codeOf(
          service.create(
            patientCaller(),
            createDto({ record_type: 'CAP', self_report: selfReport, treated_before_visit: true }),
          ),
        ),
      ).resolves.toMatchObject({ code: '3101' });
    });

    it('tài khoản benh_nhan không có dòng benhnhan → 9901, ghi log (MT-112)', async () => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { service, records } = setup();
      records.create.mockResolvedValue(null);
      await expect(codeOf(service.create(patientCaller(), createDto({})))).resolves.toMatchObject({
        code: '9901',
      });
      expect(String(error.mock.calls[0]?.[0])).toContain('không có dòng benhnhan');
      error.mockRestore();
    });
  });

  describe('get (medrec05)', () => {
    it('nhân viên thiếu view_medical_records → 3101 trước khi đọc CSDL', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(service.get(nurseCaller({ permissions: only() }), 12)),
      ).resolves.toMatchObject({
        code: '3101',
      });
      expect(records.findById).not.toHaveBeenCalled();
    });

    it('không có hồ sơ → 4001', async () => {
      const { service, records } = setup();
      records.findById.mockResolvedValue(null);
      await expect(codeOf(service.get(doctorCaller(), 12))).resolves.toMatchObject({
        code: '4001',
      });
    });

    it('bệnh nhân: hồ sơ của mình chờ tiếp nhận → self_report có, details null (D-B21), allowed_actions [edit, cancel] (D-B30, D-B32); của người khác → 3106', async () => {
      const { service } = setup(
        medicalRecord({ selfReport: { ...medicalRecord().selfReport, onset_weeks: 3 } }),
      );
      await expect(service.get(patientCaller(), 12)).resolves.toMatchObject({
        self_report: { onset_weeks: 3 },
        details: null,
        allowed_actions: ['edit', 'cancel'],
      });
      await expect(
        codeOf(service.get(patientCaller({ userId: OTHER_PATIENT_ID }), 12)),
      ).resolves.toMatchObject({ code: '3106' });
    });

    it('bác sĩ phụ trách hồ sơ đang khám: details đầy đủ, allowed_actions của mục 6.4', async () => {
      const { service } = setup(inProgressRecord(DOCTOR_ID));
      const data = await service.get(doctorCaller(), 12);
      expect(data.details).toMatchObject({ ...EMPTY_CORE, acute: null });
      expect(data.allowed_actions).toEqual([
        'edit',
        'add_visit',
        'edit_visits',
        'complete',
        'cancel',
      ]);
    });
  });

  describe('summary (medrec06), history (medrec13)', () => {
    it('summary: 4001; bệnh nhân khác → 3106; trả 5 khoá', async () => {
      const { service, records } = setup();
      await expect(service.summary(patientCaller(), 12)).resolves.toEqual({
        medical_record_id: 12,
        status: 'pending',
        record_type: 'MAN',
        patient_name: 'LÊ THỊ MAI',
        first_visit_at: '2026-11-15T01:00:00.000Z',
      });
      await expect(
        codeOf(service.summary(patientCaller({ userId: OTHER_PATIENT_ID }), 12)),
      ).resolves.toMatchObject({ code: '3106' });
      records.findOverview.mockResolvedValue(null);
      await expect(codeOf(service.summary(doctorCaller(), 12))).resolves.toMatchObject({
        code: '4001',
      });
    });

    it('history: bệnh nhân truyền id người khác → 3106 trước khi đọc CSDL; nhân viên với id không phải bệnh nhân → 3007', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(service.history(patientCaller(), OTHER_PATIENT_ID)),
      ).resolves.toMatchObject({
        code: '3106',
      });
      expect(records.historyOf).not.toHaveBeenCalled();
      await expect(service.history(patientCaller(), PATIENT_ID)).resolves.toEqual([
        {
          medical_record_id: 12,
          record_type: 'MAN',
          status: 'pending',
          instructions: null,
          first_visit_at: '2026-11-15T01:00:00.000Z',
          last_visit_date: null,
        },
      ]);
      records.historyOf.mockResolvedValue(null);
      await expect(codeOf(service.history(doctorCaller(), DOCTOR_ID))).resolves.toMatchObject({
        code: '3007',
      });
      await expect(
        codeOf(service.history(nurseCaller({ permissions: only() }), PATIENT_ID)),
      ).resolves.toMatchObject({ code: '3101' });
    });
  });

  describe('list (medrec04), statusCounts', () => {
    it('đổi query sang bộ lọc và cửa sổ trang; phần tử có allowed_actions theo người gọi; total giữ nguyên', async () => {
      const { service, records } = setup();
      const page = await service.list(adminCaller(), {
        page: 3,
        limit: 20,
        status: 'pending',
        patient_id: PATIENT_ID,
        record_type: 'MAN',
        doctor_id: DOCTOR_ID,
      } as ListMedicalRecordsQuery);
      expect(records.list).toHaveBeenCalledWith(
        { status: 'pending', patientId: PATIENT_ID, type: 'MAN', doctorId: DOCTOR_ID },
        { skip: 40, take: 20 },
      );
      expect(page).toBeInstanceOf(Paginated);
      expect(page.total).toBe(41);
      expect(page.items[0]).toMatchObject({
        medical_record_id: 12,
        allowed_actions: ['edit', 'cancel', 'delete'],
      });
      expect(page.items[0]).not.toHaveProperty('details');
    });

    it('statusCounts: cùng bộ lọc (không có trạng thái)', async () => {
      const { service, records } = setup();
      await expect(
        service.statusCounts({ record_type: 'CAP', doctor_id: DOCTOR_ID } as StatusCountsQuery),
      ).resolves.toMatchObject({ pending: 1 });
      expect(records.countByStatus).toHaveBeenCalledWith({
        patientId: undefined,
        type: 'CAP',
        doctorId: DOCTOR_ID,
      });
    });
  });

  describe('update (PATCH /medical_records/:id)', () => {
    it('trước khi đọc CSDL: nhân viên thiếu manage → 3101; body không có trường nào → 2001 (kể cả bệnh nhân)', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(service.update(patientCaller(), 12, updateDto({ self_report: {} }))),
      ).resolves.toMatchObject({ code: '2001' });
      await expect(
        codeOf(
          service.update(
            nurseCaller({ permissions: only('view_medical_records') }),
            12,
            updateDto({ treated_before_visit: true }),
          ),
        ),
      ).resolves.toMatchObject({ code: '3101' });
      await expect(
        codeOf(service.update(nurseCaller(), 12, updateDto({ self_report: {} }))),
      ).resolves.toMatchObject({
        code: '2001',
      });
      expect(records.update).not.toHaveBeenCalled();
    });

    it('body rỗng thắng thiếu quyền: nhân viên thiếu manage gửi body không có trường → 2001 (mục 6.3)', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(
          service.update(
            nurseCaller({ permissions: only('view_medical_records') }),
            12,
            updateDto({ self_report: {} }),
          ),
        ),
      ).resolves.toMatchObject({ code: '2001' });
      expect(records.update).not.toHaveBeenCalled();
    });

    it('không có hồ sơ → 4001', async () => {
      const { service, records } = setup();
      records.update.mockResolvedValue(null);
      await expect(
        codeOf(service.update(nurseCaller(), 12, updateDto({ treated_before_visit: true }))),
      ).resolves.toMatchObject({
        code: '4001',
      });
    });

    it('sau khi khoá: completed → 4003, cancelled → 4009, đang khám mà không phải bác sĩ phụ trách → 3105', async () => {
      const dto = updateDto({ treated_before_visit: true });
      await expect(
        codeOf(
          setup(medicalRecord({ status: 'completed' })).service.update(nurseCaller(), 12, dto),
        ),
      ).resolves.toMatchObject({
        code: '4003',
      });
      await expect(
        codeOf(
          setup(medicalRecord({ status: 'cancelled' })).service.update(nurseCaller(), 12, dto),
        ),
      ).resolves.toMatchObject({
        code: '4009',
      });
      await expect(
        codeOf(setup(inProgressRecord(OTHER_DOCTOR_ID)).service.update(doctorCaller(), 12, dto)),
      ).resolves.toMatchObject({ code: '3105' });
    });

    it('hợp lệ: thay đổi theo luật gộp (tắt cờ xoá ghi rõ đang lưu), trả dạng nhân viên', async () => {
      const current = inProgressRecord(DOCTOR_ID, {
        core: { ...EMPTY_CORE, family_history: 'Co', family_history_detail: 'Mẹ' },
      });
      const { service, decided } = setup(current);
      const data = await service.update(doctorCaller(), 12, updateDto({ family_history: 'Khong' }));
      expect(decided()).toMatchObject({
        core: { family_history: 'Khong', family_history_detail: null },
      });
      expect(data.details).not.toBeNull();
    });
  });

  describe('update: bệnh nhân sửa phần tự khai (D-B30)', () => {
    it.each(['pending', 'draft'] as const)(
      'hồ sơ của mình ở %s: chỉ ghi khối tự khai; trả dạng bệnh nhân',
      async (status) => {
        const { service, decided } = setup(medicalRecord({ status }));
        const data = await service.update(
          patientCaller(),
          12,
          updateDto({ self_report: { onset_weeks: 3, referral_diagnosis: null } }),
        );
        expect(decided()).toEqual({
          selfReport: { onset_weeks: 3, referral_diagnosis: null },
          core: {},
          acute: {},
          chronic: {},
        });
        expect(data.details).toBeNull();
      },
    );

    it('sau khi khoá, theo mục 6.3: hồ sơ người khác → 3106 (trước ô trạng thái) → hoàn tất 4003, đã huỷ 4009 → đã tiếp nhận 3101 → trường ngoài self_report 3101 → biểu hiện bệnh với CAP 2003', async () => {
      const staffField = { family_history: 'Co' };
      const selfReport = { self_report: { onset_weeks: 1 } };
      const cases: [MedicalRecord, object, string][] = [
        [
          inProgressRecord(DOCTOR_ID, { patientId: OTHER_PATIENT_ID, status: 'completed' }),
          staffField,
          '3106',
        ],
        [inProgressRecord(DOCTOR_ID, { status: 'completed' }), staffField, '4003'],
        [medicalRecord({ status: 'cancelled' }), staffField, '4009'],
        [inProgressRecord(DOCTOR_ID), selfReport, '3101'],
        [medicalRecord(), { ...selfReport, ...staffField }, '3101'],
        [
          medicalRecord({ type: 'CAP', chronic: null }),
          { self_report: { disease_manifestation: 'Chi san phu' } },
          '2003',
        ],
      ];
      for (const [current, body, code] of cases) {
        const { service, records } = setup(current);
        await expect(
          codeOf(service.update(patientCaller(), 12, updateDto(body))),
        ).resolves.toMatchObject({ code });
        expect(records.update).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('remove (medrec14)', () => {
    it('xoá được → không ném; không có hồ sơ → 4001', async () => {
      const { service, records } = setup();
      await expect(service.remove(12)).resolves.toBeUndefined();
      records.delete.mockResolvedValue(false);
      await expect(codeOf(service.remove(12))).resolves.toMatchObject({ code: '4001' });
    });
  });

  describe('accept (medrec07)', () => {
    /** 01:30 ngày 2026-11-16 giờ Việt Nam: "hôm nay" là 2026-11-16 dù UTC vẫn là ngày 15 (D-B23). */
    const LATE_EVENING_UTC = new Date('2026-11-15T18:30:00.000Z');
    const acceptDto = (body: object = {}) => body as AcceptMedicalRecordDto;

    it('chờ tiếp nhận: in_progress, phiên mới do người gọi khám hôm nay giờ Việt Nam ở phòng gửi lên (D-B5); first_visit_at trống thì ghi lúc tiếp nhận (D-B9); data 4 khoá', async () => {
      vi.useFakeTimers({ now: LATE_EVENING_UTC });
      const { service, changed } = setup(medicalRecord(), inProgressRecord(DOCTOR_ID));
      await expect(service.accept(doctorCaller(), 12, acceptDto({ room_id: 2 }))).resolves.toEqual({
        medical_record_id: 12,
        assigned_doctor_id: DOCTOR_ID,
        status: 'in_progress',
        visit_id: 31,
      });
      expect(changed()).toEqual({
        status: 'in_progress',
        firstVisitAtIfEmpty: LATE_EVENING_UTC,
        newVisit: { doctorId: DOCTOR_ID, roomId: 2, date: '2026-11-16' },
      });
    });

    it('room_id vắng hoặc null → phiên chưa phân phòng (MT-115)', async () => {
      for (const body of [{}, { room_id: null }]) {
        const { service, changed } = setup(medicalRecord(), inProgressRecord(DOCTOR_ID));
        await service.accept(doctorCaller(), 12, acceptDto(body));
        expect(changed()?.newVisit?.roomId).toBeNull();
      }
    });

    it('sau khi khoá: ô trạng thái trước dòng nhanvien — nháp, hoàn tất, đã huỷ → 4004; đang khám của người khác → 4005, của chính mình → 4004; chưa phân công → 3101 (MT-106)', async () => {
      const cases: [MedicalRecord, Caller, string][] = [
        [medicalRecord({ status: 'draft' }), doctorCaller(), '4004'],
        [inProgressRecord(DOCTOR_ID, { status: 'completed' }), doctorCaller(), '4004'],
        [medicalRecord({ status: 'cancelled' }), doctorCaller(), '4004'],
        [inProgressRecord(OTHER_DOCTOR_ID), doctorCaller(), '4005'],
        [inProgressRecord(DOCTOR_ID), doctorCaller(), '4004'],
        [inProgressRecord(OTHER_DOCTOR_ID), doctorCaller({ hasStaffRow: false }), '4005'],
        [medicalRecord(), doctorCaller({ hasStaffRow: false }), '3101'],
      ];
      for (const [current, caller, code] of cases) {
        await expect(
          codeOf(setup(current).service.accept(caller, 12, acceptDto())),
        ).resolves.toMatchObject({ code });
      }
    });

    it('không có hồ sơ → 4001', async () => {
      const { service, transitions } = setup();
      transitions.transition.mockResolvedValue(null);
      await expect(codeOf(service.accept(doctorCaller(), 12, acceptDto()))).resolves.toMatchObject({
        code: '4001',
      });
    });
  });

  describe('close (medrec11, PUT /:id)', () => {
    const closeDto = (body: object) => body as CloseMedicalRecordDto;

    it('completed kèm dặn dò: bác sĩ phụ trách; dặn dò ghi vào phiên mới nhất (D-B8); data là MedicalRecordData của người gọi', async () => {
      const done = inProgressRecord(DOCTOR_ID, { status: 'completed' });
      const { service, changed } = setup(inProgressRecord(DOCTOR_ID), done);
      const data = await service.close(
        doctorCaller(),
        12,
        closeDto({ status: 'completed', instructions: 'Tái khám sau 4 tuần' }),
      );
      expect(changed()).toEqual({ status: 'completed', instructions: 'Tái khám sau 4 tuần' });
      expect(data).toMatchObject({
        medical_record_id: 12,
        status: 'completed',
        allowed_actions: [],
      });
      expect(data.details).not.toBeNull();
    });

    it('cancelled không gửi dặn dò → instructions vắng (giữ dan_do)', async () => {
      const { service, changed } = setup(inProgressRecord(DOCTOR_ID));
      await service.close(doctorCaller(), 12, closeDto({ status: 'cancelled' }));
      expect(changed()).toEqual({ status: 'cancelled', instructions: undefined });
    });

    it('sau khi khoá: chờ tiếp nhận, nháp, đã huỷ → 4009; hoàn tất → 4003; bác sĩ khác → 3105; không có hồ sơ → 4001', async () => {
      const dto = closeDto({ status: 'completed' });
      const cases: [MedicalRecord, string][] = [
        [medicalRecord(), '4009'],
        [medicalRecord({ status: 'draft' }), '4009'],
        [inProgressRecord(DOCTOR_ID, { status: 'cancelled' }), '4009'],
        [inProgressRecord(DOCTOR_ID, { status: 'completed' }), '4003'],
        [inProgressRecord(OTHER_DOCTOR_ID), '3105'],
      ];
      for (const [current, code] of cases) {
        await expect(
          codeOf(setup(current).service.close(doctorCaller(), 12, dto)),
        ).resolves.toMatchObject({ code });
      }
      const { service, transitions } = setup();
      transitions.transition.mockResolvedValue(null);
      await expect(codeOf(service.close(doctorCaller(), 12, dto))).resolves.toMatchObject({
        code: '4001',
      });
    });
  });

  describe('cancel (PATCH /:id/status)', () => {
    it('điều dưỡng huỷ hồ sơ chờ tiếp nhận hoặc nháp (MT-113) → cancelled; data {id chuỗi, status} (MT-06)', async () => {
      for (const current of [medicalRecord(), medicalRecord({ status: 'draft' })]) {
        const { service, changed } = setup(current, medicalRecord({ status: 'cancelled' }));
        await expect(service.cancel(nurseCaller(), 12)).resolves.toEqual({
          id: '12',
          status: 'cancelled',
        });
        expect(changed()).toEqual({ status: 'cancelled' });
      }
    });

    it('đang khám: bác sĩ phụ trách huỷ được; bác sĩ khác, điều dưỡng → 3105 (mục 6.1, 7.2)', async () => {
      const { service } = setup(
        inProgressRecord(DOCTOR_ID),
        inProgressRecord(DOCTOR_ID, { status: 'cancelled' }),
      );
      await expect(service.cancel(doctorCaller(), 12)).resolves.toEqual({
        id: '12',
        status: 'cancelled',
      });
      for (const caller of [doctorCaller({ userId: OTHER_DOCTOR_ID }), nurseCaller()]) {
        await expect(
          codeOf(setup(inProgressRecord(DOCTOR_ID)).service.cancel(caller, 12)),
        ).resolves.toMatchObject({ code: '3105' });
      }
    });

    it('nhân viên thiếu manage_medical_records → 3101 trước khi khoá', async () => {
      const { service, transitions } = setup();
      await expect(
        codeOf(service.cancel(nurseCaller({ permissions: only('view_medical_records') }), 12)),
      ).resolves.toMatchObject({ code: '3101' });
      expect(transitions.transition).not.toHaveBeenCalled();
    });

    it('bệnh nhân tự huỷ hồ sơ của mình ở chờ tiếp nhận hoặc nháp → cancelled (D-B32, MT-131)', async () => {
      for (const current of [medicalRecord(), medicalRecord({ status: 'draft' })]) {
        const { service, changed } = setup(current, medicalRecord({ status: 'cancelled' }));
        await expect(service.cancel(patientCaller(), 12)).resolves.toEqual({
          id: '12',
          status: 'cancelled',
        });
        expect(changed()).toEqual({ status: 'cancelled' });
      }
    });

    it('bệnh nhân, sau khi khoá: hồ sơ người khác → 3106 (trước ô trạng thái); đã tiếp nhận → 3101; hoàn tất → 4003; đã huỷ → 4009', async () => {
      const cases: [MedicalRecord, string][] = [
        [inProgressRecord(DOCTOR_ID, { patientId: OTHER_PATIENT_ID, status: 'completed' }), '3106'],
        [inProgressRecord(DOCTOR_ID), '3101'],
        [inProgressRecord(DOCTOR_ID, { status: 'completed' }), '4003'],
        [medicalRecord({ status: 'cancelled' }), '4009'],
      ];
      for (const [current, code] of cases) {
        const { service, transitions } = setup(current);
        await expect(codeOf(service.cancel(patientCaller(), 12))).resolves.toMatchObject({ code });
        expect(transitions.transition).toHaveBeenCalledTimes(1);
      }
    });

    it('hoàn tất → 4003; đã huỷ → 4009; không có hồ sơ → 4001', async () => {
      await expect(
        codeOf(
          setup(inProgressRecord(DOCTOR_ID, { status: 'completed' })).service.cancel(
            nurseCaller(),
            12,
          ),
        ),
      ).resolves.toMatchObject({ code: '4003' });
      await expect(
        codeOf(setup(medicalRecord({ status: 'cancelled' })).service.cancel(nurseCaller(), 12)),
      ).resolves.toMatchObject({ code: '4009' });
      const { service, transitions } = setup();
      transitions.transition.mockResolvedValue(null);
      await expect(codeOf(service.cancel(nurseCaller(), 12))).resolves.toMatchObject({
        code: '4001',
      });
    });
  });
});
