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
import type { MedicalRecord, RecordChanges } from './medical-record-mapping.js';
import { EMPTY_CORE, inProgressRecord, medicalRecord } from './medical-record.fixture.js';
import type { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';
import type { RecordPermission } from './record-access.js';

const NOW = new Date('2026-11-15T03:00:00.000Z');
const only = (...permissions: RecordPermission[]) => new Set<RecordPermission>(permissions);

function setup(current: MedicalRecord = medicalRecord()) {
  let decided: RecordChanges | undefined;
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
  const service = new MedicalRecordsService(records as unknown as MedicalRecordsRepository);
  return { service, records, decided: () => decided };
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

    it('thứ tự mã: bệnh nhân → 3101 (nhánh tự khai ở B6); thiếu manage → 3101; thiếu patient_id → 2001; khối lệch loại → 2003; không gọi repository', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(service.create(patientCaller(), createDto({ patient_id: PATIENT_ID }))),
      ).resolves.toEqual({
        code: '3101',
        data: undefined,
      });
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

    it('bệnh nhân: hồ sơ của mình → self_report có, details null, allowed_actions [] (D-B21); của người khác → 3106', async () => {
      const { service } = setup(
        medicalRecord({ selfReport: { ...medicalRecord().selfReport, onset_weeks: 3 } }),
      );
      await expect(service.get(patientCaller(), 12)).resolves.toMatchObject({
        self_report: { onset_weeks: 3 },
        details: null,
        allowed_actions: [],
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
    it('trước khi đọc CSDL: bệnh nhân → 3101 (tới B6); thiếu manage → 3101; body không có trường nào → 2001', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(service.update(patientCaller(), 12, updateDto({ self_report: { onset_weeks: 1 } }))),
      ).resolves.toMatchObject({
        code: '3101',
      });
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

  describe('remove (medrec14)', () => {
    it('xoá được → không ném; không có hồ sơ → 4001', async () => {
      const { service, records } = setup();
      await expect(service.remove(12)).resolves.toBeUndefined();
      records.delete.mockResolvedValue(false);
      await expect(codeOf(service.remove(12))).resolves.toMatchObject({ code: '4001' });
    });
  });
});
