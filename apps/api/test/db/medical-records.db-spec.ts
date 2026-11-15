import { Logger, type ArgumentsHost, type INestApplication } from '@nestjs/common';
import type { MedicalRecordData, MedicalRecordStatus, RecordType } from '@drmayday/shared';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type {
  NewMedicalRecord,
  RecordFilter,
} from '../../src/medical-records/medical-record-mapping.js';
import {
  MedicalRecordsRepository,
  lockRecord,
} from '../../src/medical-records/medical-records.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createPatientRow,
  createStaffRow,
  createTestApp,
  createVisit,
  resetData,
  setRecordStatus,
  type SeedResult,
} from './helpers.js';

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const PASSWORD = 'matkhau123';
const DENIED = { code: '3101', message: 'Permission denied' };
/** Khoá của MedicalRecordListItem theo đúng thứ tự contract (spec B, mục 5.3). */
const LIST_ITEM_KEYS = [
  'medical_record_id',
  'patient_id',
  'patient_name',
  'patient_phone',
  'record_type',
  'status',
  'assigned_doctor_id',
  'assigned_doctor_name',
  'first_visit_at',
  'visit_count',
  'last_visit_date',
  'next_appointment_date',
  'allowed_actions',
];

type Method = 'get' | 'post' | 'patch' | 'delete';

/** Người dùng test đã đăng nhập. */
interface TestUser {
  id: number;
  token: string;
}

describe('MedicalRecordsRepository: khoá, tạo, đọc, sửa, xoá (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let records: MedicalRecordsRepository;
  let seed: SeedResult;
  let patientId: number;
  let doctorId: number;

  const newRecord = (
    type: RecordType,
    extra: Partial<NewMedicalRecord> = {},
  ): NewMedicalRecord => ({
    patientId,
    type,
    status: 'pending',
    firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
    selfReport: {},
    core: {},
    acute: {},
    chronic: {},
    ...extra,
  });
  const created = async (type: RecordType, extra: Partial<NewMedicalRecord> = {}) => {
    const record = await records.create(newRecord(type, extra));
    if (!record) throw new Error('không tạo được hồ sơ test');
    return record;
  };
  /** Ba cột INTERVAL đọc thẳng bằng ::text, không qua repository. */
  const intervalsOf = async (recordId: number) =>
    (
      await prisma.$queryRaw<
        { tiep_xuc: string | null; keo_dai: string | null; gan_nhat: string | null }[]
      >`
        SELECT thoi_gian_tiep_xuc_den_khoi_phat::text AS tiep_xuc,
               thoi_gian_keo_dai_tb::text AS keo_dai,
               dot_gan_nhat_cach::text AS gan_nhat
        FROM benhanmaydaycap WHERE ma_ho_so = ${BigInt(recordId)}`
    )[0];
  const counts = async () => [
    await prisma.hosobenhan.count(),
    await prisma.benhanmaydaycap.count(),
    await prisma.benhanmaydayman.count(),
    await prisma.phienkham.count(),
    await prisma.phienkhamcap.count(),
    await prisma.phienkhamman.count(),
  ];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    // MedicalRecordsModule đăng ký vào AppModule ở Task 11.
    records = new MedicalRecordsRepository(app.get(PrismaService));
  });

  beforeEach(async () => {
    seed = await resetData(app);
    patientId = await createPatientRow(prisma, '0911111111', 'LÊ THỊ MAI');
    doctorId = await createStaffRow(prisma, '0902000001', 'BÁC SĨ A', seed.branchId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('create (D-B1, D-B4, D-B15)', () => {
    it('CAP: hosobenhan pending + đúng một dòng benhanmaydaycap; cột lõi, self_report; INTERVAL ghi bằng make_interval', async () => {
      const record = await created('CAP', {
        selfReport: { referral_diagnosis: 'Mày đay cấp', onset_weeks: 1.5 },
        core: { outpatient_start_date: '2026-11-15', family_history: 'Khong' },
        acute: {
          hospitalized: true,
          suspected_trigger_group: 'Thuc an',
          exposure_to_onset_seconds: 1800,
          last_episode_ago_seconds: 86_400,
          first_onset_age: 25,
        },
      });
      expect(record).toMatchObject({
        type: 'CAP',
        status: 'pending',
        patientId,
        firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
        selfReport: {
          referral_diagnosis: 'Mày đay cấp',
          initial_clinic_diagnosis: null,
          onset_weeks: 1.5,
          disease_manifestation: null,
        },
        core: {
          outpatient_start_date: '2026-11-15',
          family_history: 'Khong',
          family_history_detail: null,
        },
        acute: {
          hospitalized: true,
          suspected_trigger_group: 'Thuc an',
          exposure_to_onset_seconds: 1800,
          mean_duration_seconds: null,
          last_episode_ago_seconds: 86_400,
          first_onset_age: 25,
        },
        chronic: null,
        summary: {
          patientName: 'LÊ THỊ MAI',
          assignedDoctorId: null,
          visitCount: 0,
          lastVisitDate: null,
        },
      });
      expect(record.acute?.updated_at).toMatch(ISO_DATE_TIME);
      expect(await counts()).toEqual([1, 1, 0, 0, 0, 0]);
      await expect(intervalsOf(record.id)).resolves.toEqual({
        tiep_xuc: '00:30:00',
        keo_dai: null,
        gan_nhat: '24:00:00',
      });
    });

    it('MAN: benhanmaydayman nhận biểu hiện bệnh của self_report và cột chronic', async () => {
      const record = await created('MAN', {
        selfReport: { disease_manifestation: 'San phu + phu mach', onset_weeks: 10 },
        chronic: {
          main_diagnosis: 'CSU',
          csu_subtype: 'CSU Type I',
          cindu_other: true,
          cindu_other_detail: 'Do nóng',
        },
      });
      expect(record).toMatchObject({
        type: 'MAN',
        acute: null,
        selfReport: { disease_manifestation: 'San phu + phu mach', onset_weeks: 10 },
        chronic: {
          main_diagnosis: 'CSU',
          csu_subtype: 'CSU Type I',
          cindu_other: true,
          cindu_other_detail: 'Do nóng',
          cindu_cold: null,
        },
      });
      await expect(
        prisma.benhanmaydayman.findUniqueOrThrow({ where: { ma_ho_so: BigInt(record.id) } }),
      ).resolves.toMatchObject({
        bieu_hien_qua_trinh_benh: 'San phu + phu mach',
        may_day_cam_ung_khac_ghi_ro: 'Do nóng',
      });
      expect(await counts()).toEqual([1, 0, 1, 0, 0, 0]);
    });

    it('trạng thái ghi tường minh (seed của B3 ghi được draft, MT-113)', async () => {
      await expect(created('MAN', { status: 'draft', firstVisitAt: null })).resolves.toMatchObject({
        status: 'draft',
        firstVisitAt: null,
      });
    });

    it('không có dòng benhnhan (nhân viên, id không tồn tại) → null, không ghi gì', async () => {
      await expect(
        records.create({ ...newRecord('MAN'), patientId: doctorId }),
      ).resolves.toBeNull();
      await expect(records.create({ ...newRecord('CAP'), patientId: 999_999 })).resolves.toBeNull();
      expect(await counts()).toEqual([0, 0, 0, 0, 0, 0]);
    });
  });

  describe('findById (trường suy ra, D-B6, D-B8)', () => {
    it('bác sĩ phụ trách = bác sĩ của phiên lan_kham_thu nhỏ nhất; ngày khám, hẹn, dặn dò của phiên lớn nhất; đếm phiên', async () => {
      const otherDoctor = await createStaffRow(prisma, '0902000002', 'BÁC SĨ B', seed.branchId);
      const { id } = await created('MAN');
      await createVisit(prisma, {
        recordId: id,
        type: 'MAN',
        doctorId,
        number: 1,
        date: '2026-11-01',
        instructions: 'Lần 1',
      });
      await createVisit(prisma, {
        recordId: id,
        type: 'MAN',
        doctorId: otherDoctor,
        number: 2,
        date: '2026-11-15',
        nextAppointment: '2026-12-13',
        instructions: 'Lần 2',
      });
      await expect(records.findById(id)).resolves.toMatchObject({
        summary: {
          assignedDoctorId: doctorId,
          assignedDoctorName: 'BÁC SĨ A',
          visitCount: 2,
          lastVisitDate: new Date('2026-11-15T00:00:00.000Z'),
          nextAppointmentDate: new Date('2026-12-13T00:00:00.000Z'),
          latestInstructions: 'Lần 2',
        },
      });
    });

    it('không có hồ sơ → null', async () => {
      await expect(records.findById(999_999)).resolves.toBeNull();
    });

    it('hồ sơ bị xoá giữa lúc đọc (tổng quan còn, dòng chi tiết đã mất) → null, không ném P2025', async () => {
      const { id } = await created('CAP');
      vi.spyOn(prisma.hosobenhan, 'findUnique').mockResolvedValueOnce(null);
      await expect(records.findById(id)).resolves.toBeNull();
    });
  });

  describe('update (D-B2: khoá trước khi đọc; chỉ ghi cột được gửi)', () => {
    it('sửa self_report không chạm benhanmaydaycap: INTERVAL và updated_at giữ nguyên', async () => {
      const before = await created('CAP', { acute: { exposure_to_onset_seconds: 3600 } });
      const after = await records.update(before.id, () => ({ selfReport: { onset_weeks: 2 } }));
      expect(after).toMatchObject({
        selfReport: { onset_weeks: 2 },
        acute: { exposure_to_onset_seconds: 3600, updated_at: before.acute!.updated_at },
      });
    });

    it('khối acute: cột thường và INTERVAL (null = xoá); trigger đổi updated_at', async () => {
      const before = await created('CAP', {
        acute: { exposure_to_onset_seconds: 3600, mean_duration_seconds: 600 },
      });
      const after = await records.update(before.id, () => ({
        acute: {
          hospitalized: false,
          exposure_to_onset_seconds: null,
          mean_duration_seconds: 7200,
        },
      }));
      expect(after?.acute).toMatchObject({
        hospitalized: false,
        exposure_to_onset_seconds: null,
        mean_duration_seconds: 7200,
      });
      expect(after!.acute!.updated_at > before.acute!.updated_at).toBe(true);
    });

    it('MAN: biểu hiện bệnh (self_report) và chronic vào benhanmaydayman; lõi và thời điểm khám lần đầu vào hosobenhan', async () => {
      const before = await created('MAN', {
        chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' },
      });
      const after = await records.update(before.id, () => ({
        firstVisitAt: new Date('2026-11-16T02:00:00.000Z'),
        selfReport: { disease_manifestation: 'Chi phu mach' },
        core: { family_history: 'Co', family_history_detail: 'Bố bị hen' },
        chronic: { cindu_other: false, cindu_other_detail: null },
      }));
      expect(after).toMatchObject({
        firstVisitAt: new Date('2026-11-16T02:00:00.000Z'),
        selfReport: { disease_manifestation: 'Chi phu mach' },
        core: { family_history: 'Co', family_history_detail: 'Bố bị hen' },
        chronic: { cindu_other: false, cindu_other_detail: null },
      });
    });

    it('decide nhận bản ghi đang lưu; decide ném lỗi → rollback, không ghi gì', async () => {
      const { id } = await created('MAN', { selfReport: { onset_weeks: 3 } });
      const decide = vi.fn(() => {
        throw new Error('dừng');
      });
      await expect(records.update(id, decide)).rejects.toThrow('dừng');
      expect(decide).toHaveBeenCalledWith(
        expect.objectContaining({ id, selfReport: expect.objectContaining({ onset_weeks: 3 }) }),
      );
      await expect(records.findById(id)).resolves.toMatchObject({ selfReport: { onset_weeks: 3 } });
    });

    it('không có hồ sơ → null, decide không được gọi', async () => {
      const decide = vi.fn(() => ({}));
      await expect(records.update(999_999, decide)).resolves.toBeNull();
      expect(decide).not.toHaveBeenCalled();
    });

    it('khoá dòng giữ tới hết transaction: lần sửa thứ hai chờ lần khoá trước nhả (D-B2)', async () => {
      const { id } = await created('MAN');
      const order: string[] = [];
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      let markLocked!: () => void;
      const locked = new Promise<void>((resolve) => (markLocked = resolve));
      const first = prisma.$transaction(
        async (tx) => {
          await lockRecord(tx, id);
          order.push('khoá lần 1');
          markLocked();
          await released;
          order.push('xong lần 1');
        },
        { timeout: 10_000 },
      );
      await locked;
      const second = records.update(id, () => {
        order.push('khoá lần 2');
        return {};
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      release();
      await Promise.all([first, second]);
      expect(order).toEqual(['khoá lần 1', 'xong lần 1', 'khoá lần 2']);
    });

    it('vi phạm CHECK lọt qua repository (onset_weeks âm) → AllExceptionsFilter trả 2003 (HTTP 400), log có tên ràng buộc (D9)', async () => {
      const { id } = await created('MAN');
      const error = await records
        .update(id, () => ({ selfReport: { onset_weeks: -1 } }))
        .catch((caught: unknown) => caught);
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      new AllExceptionsFilter().catch(error, {
        switchToHttp: () => ({ getResponse: () => response }),
      } as unknown as ArgumentsHost);
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        code: '2003',
        message: 'Invalid parameter value',
      });
      expect(warn.mock.calls.map(([message]) => String(message)).join('\n')).toContain(
        'ck_hosobenhan_thoi_gian',
      );
    });
  });

  describe('lockRecord (spec B, mục 4.2, 4.3)', () => {
    it('trạng thái, bác sĩ phụ trách, phiên mới nhất, MAX(lan_kham_thu); chưa có phiên → 0', async () => {
      const { id } = await created('CAP');
      await expect(prisma.$transaction((tx) => lockRecord(tx, id))).resolves.toEqual({
        id,
        patientId,
        type: 'CAP',
        status: 'pending',
        assignedDoctorId: null,
        latestVisitId: null,
        maxVisitNumber: 0,
      });
      await createVisit(prisma, {
        recordId: id,
        type: 'CAP',
        doctorId,
        number: 1,
        date: '2026-11-15',
      });
      const latest = await createVisit(prisma, {
        recordId: id,
        type: 'CAP',
        doctorId,
        number: 2,
        date: '2026-11-16',
      });
      await expect(prisma.$transaction((tx) => lockRecord(tx, id))).resolves.toMatchObject({
        assignedDoctorId: doctorId,
        latestVisitId: latest,
        maxVisitNumber: 2,
      });
    });

    it('không có hồ sơ → null', async () => {
      await expect(prisma.$transaction((tx) => lockRecord(tx, 999_999))).resolves.toBeNull();
    });
  });

  describe('delete (D-B22)', () => {
    it('MAN: xoá phienkhamman → phienkham → benhanmaydayman → hosobenhan', async () => {
      const { id } = await created('MAN');
      await createVisit(prisma, {
        recordId: id,
        type: 'MAN',
        doctorId,
        number: 1,
        date: '2026-11-15',
      });
      await expect(records.delete(id)).resolves.toBe(true);
      expect(await counts()).toEqual([0, 0, 0, 0, 0, 0]);
    });

    it('CAP: xoá phienkhamcap, phienkham, benhanmaydaycap, hosobenhan; hồ sơ khác giữ nguyên', async () => {
      const { id } = await created('CAP');
      const other = await created('MAN');
      await createVisit(prisma, {
        recordId: id,
        type: 'CAP',
        doctorId,
        number: 1,
        date: '2026-11-15',
      });
      await expect(records.delete(id)).resolves.toBe(true);
      expect(await counts()).toEqual([1, 0, 1, 0, 0, 0]);
      await expect(records.findById(other.id)).resolves.not.toBeNull();
    });

    it('phiên còn dauhieusinhton (bảng của C) tham chiếu → 2003 (409), CSDL không đổi', async () => {
      const { id } = await created('MAN');
      const visitId = await createVisit(prisma, {
        recordId: id,
        type: 'MAN',
        doctorId,
        number: 1,
        date: '2026-11-15',
      });
      await prisma.dauhieusinhton.create({ data: { ma_phien_kham: BigInt(visitId) } });
      await expect(records.delete(id)).rejects.toMatchObject({ code: '2003', httpStatus: 409 });
      expect(await counts()).toEqual([1, 0, 1, 1, 0, 1]);
    });

    it('không có hồ sơ → false', async () => {
      await expect(records.delete(999_999)).resolves.toBe(false);
    });
  });
});

describe('MedicalRecordsRepository: danh sách, số đếm, lịch sử (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let records: MedicalRecordsRepository;
  const WINDOW = { skip: 0, take: 20 };
  /** Hồ sơ r1…r5 của bối cảnh (id theo thứ tự tạo vì RESTART IDENTITY). */
  let ids: Record<'r1' | 'r2' | 'r3' | 'r4' | 'r5', number>;
  let mai: number;
  let binh: number;
  let doctorA: number;
  let doctorB: number;

  const record = async (
    type: RecordType,
    patientId: number,
    status: NewMedicalRecord['status'] = 'pending',
  ) => {
    const created = await records.create({
      patientId,
      type,
      status,
      firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
      selfReport: {},
      core: {},
      acute: {},
      chronic: {},
    });
    if (!created) throw new Error('không tạo được hồ sơ test');
    return created.id;
  };
  const idsOf = async (filter: RecordFilter, window = WINDOW) => {
    const page = await records.list(filter, window);
    return { ids: page.items.map((item) => item.id), total: page.total };
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    records = new MedicalRecordsRepository(app.get(PrismaService));
  });

  /**
   * r1 MAN chờ (Mai); r2 CAP đang khám (Mai, BS A phụ trách); r3 MAN đang khám (Bình, BS B phụ trách,
   * BS A khám lần 2); r4 CAP hoàn tất (Bình, BS A); r5 MAN nháp (Mai).
   */
  beforeEach(async () => {
    const seed = await resetData(app);
    mai = await createPatientRow(prisma, '0911111111', 'LÊ THỊ MAI');
    binh = await createPatientRow(prisma, '0922222222', 'TRẦN VĂN BÌNH');
    doctorA = await createStaffRow(prisma, '0902000001', 'BÁC SĨ A', seed.branchId);
    doctorB = await createStaffRow(prisma, '0902000002', 'BÁC SĨ B', seed.branchId);
    const r1 = await record('MAN', mai);
    const r2 = await record('CAP', mai, 'in_progress');
    await createVisit(prisma, {
      recordId: r2,
      type: 'CAP',
      doctorId: doctorA,
      number: 1,
      date: '2026-11-15',
    });
    const r3 = await record('MAN', binh, 'in_progress');
    await createVisit(prisma, {
      recordId: r3,
      type: 'MAN',
      doctorId: doctorB,
      number: 1,
      date: '2026-11-10',
    });
    await createVisit(prisma, {
      recordId: r3,
      type: 'MAN',
      doctorId: doctorA,
      number: 2,
      date: '2026-11-16',
      nextAppointment: '2026-12-14',
      instructions: 'Tái khám sau 4 tuần',
    });
    const r4 = await record('CAP', binh);
    await createVisit(prisma, {
      recordId: r4,
      type: 'CAP',
      doctorId: doctorA,
      number: 1,
      date: '2026-11-01',
    });
    await setRecordStatus(prisma, r4, 'completed');
    const r5 = await record('MAN', mai, 'draft');
    ids = { r1, r2, r3, r4, r5 };
  });

  afterAll(async () => {
    await app.close();
  });

  it('không lọc: mọi hồ sơ, ma_ho_so giảm dần (D-B10), total đếm hết', async () => {
    await expect(idsOf({})).resolves.toEqual({
      ids: [ids.r5, ids.r4, ids.r3, ids.r2, ids.r1],
      total: 5,
    });
  });

  it('lọc trạng thái, loại, bệnh nhân; kết hợp được', async () => {
    await expect(idsOf({ status: 'in_progress' })).resolves.toEqual({
      ids: [ids.r3, ids.r2],
      total: 2,
    });
    await expect(idsOf({ type: 'CAP' })).resolves.toEqual({ ids: [ids.r4, ids.r2], total: 2 });
    await expect(idsOf({ patientId: mai })).resolves.toEqual({
      ids: [ids.r5, ids.r2, ids.r1],
      total: 3,
    });
    await expect(idsOf({ patientId: mai, type: 'MAN', status: 'pending' })).resolves.toEqual({
      ids: [ids.r1],
      total: 1,
    });
  });

  it('lọc bác sĩ phụ trách theo phiên đầu (D-B6): BS A phụ trách r2, r4; khám r3 lần 2 nhưng không phụ trách', async () => {
    await expect(idsOf({ doctorId: doctorA })).resolves.toEqual({
      ids: [ids.r4, ids.r2],
      total: 2,
    });
    await expect(idsOf({ doctorId: doctorB })).resolves.toEqual({ ids: [ids.r3], total: 1 });
    await expect(idsOf({ doctorId: doctorA, status: 'in_progress' })).resolves.toEqual({
      ids: [ids.r2],
      total: 1,
    });
  });

  it('phân trang theo ma_ho_so giảm dần; trang rất xa → rỗng, total giữ nguyên', async () => {
    await expect(idsOf({}, { skip: 1, take: 2 })).resolves.toEqual({
      ids: [ids.r4, ids.r3],
      total: 5,
    });
    await expect(idsOf({}, { skip: 214_748_364_600, take: 100 })).resolves.toEqual({
      ids: [],
      total: 5,
    });
  });

  it('phần tử có trường suy ra: bác sĩ phụ trách của phiên đầu, ngày khám, hẹn, dặn dò của phiên cuối, số phiên', async () => {
    const page = await records.list({ patientId: binh, status: 'in_progress' }, WINDOW);
    expect(page.items).toEqual([
      {
        id: ids.r3,
        patientId: binh,
        type: 'MAN',
        status: 'in_progress',
        firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
        summary: {
          patientName: 'TRẦN VĂN BÌNH',
          patientPhone: '0922222222',
          assignedDoctorId: doctorB,
          assignedDoctorName: 'BÁC SĨ B',
          visitCount: 2,
          lastVisitDate: new Date('2026-11-16T00:00:00.000Z'),
          nextAppointmentDate: new Date('2026-12-14T00:00:00.000Z'),
          latestInstructions: 'Tái khám sau 4 tuần',
        },
      },
    ]);
  });

  it('countByStatus: đủ 5 trạng thái (0 khi không có), cùng bộ lọc, khớp total của danh sách theo từng trạng thái', async () => {
    await expect(records.countByStatus({})).resolves.toEqual({
      draft: 1,
      pending: 1,
      in_progress: 2,
      completed: 1,
      cancelled: 0,
    });
    await expect(records.countByStatus({ doctorId: doctorA })).resolves.toEqual({
      draft: 0,
      pending: 0,
      in_progress: 1,
      completed: 1,
      cancelled: 0,
    });
    const filter = { patientId: mai, type: 'MAN' as const };
    const counts = await records.countByStatus(filter);
    for (const status of ['draft', 'pending', 'in_progress', 'completed', 'cancelled'] as const) {
      expect((await idsOf({ ...filter, status })).total).toBe(counts[status]);
    }
  });

  it('findOverview: có → tổng quan (không đọc subtype); không có → null', async () => {
    await expect(records.findOverview(ids.r2)).resolves.toMatchObject({
      id: ids.r2,
      type: 'CAP',
      summary: { assignedDoctorId: doctorA, visitCount: 1 },
    });
    await expect(records.findOverview(999_999)).resolves.toBeNull();
  });

  it('historyOf: hồ sơ của bệnh nhân, ma_ho_so giảm dần; bệnh nhân chưa có hồ sơ → []; không phải bệnh nhân → null', async () => {
    expect((await records.historyOf(mai))?.map((item) => item.id)).toEqual([
      ids.r5,
      ids.r2,
      ids.r1,
    ]);
    const newcomer = await createPatientRow(prisma, '0933333333', 'NGƯỜI MỚI');
    await expect(records.historyOf(newcomer)).resolves.toEqual([]);
    await expect(records.historyOf(doctorA)).resolves.toBeNull();
    await expect(records.historyOf(999_999)).resolves.toBeNull();
  });
});

describe('API bệnh án /medical_records (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let passwordHash: string;
  let admin: TestUser;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let nurse: TestUser;
  let patient: TestUser;
  let otherPatient: TestUser;

  const login = (phone: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password: PASSWORD });
  const api = (method: Method, path: string, token: string) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

  /**
   * Tài khoản chèn thẳng (mật khẩu băm bcrypt cost 4 cho nhanh) rồi đăng nhập thật qua API. `subtype`:
   * dòng benhnhan, dòng nhanvien ở chi nhánh dev (đã phân công, MT-106) hoặc không có.
   */
  const account = async (
    roleId: number,
    phone: string,
    fullName: string,
    subtype: 'patient' | 'staff' | 'none',
  ): Promise<TestUser> => {
    const person = await prisma.nguoi.create({
      data: {
        ho_ten: fullName,
        so_dien_thoai: phone,
        taikhoan: {
          create: {
            ten_dang_nhap: phone,
            mat_khau_ma_hoa: passwordHash,
            ma_vai_tro: BigInt(roleId),
          },
        },
        ...(subtype === 'patient' ? { benhnhan: { create: {} } } : {}),
        ...(subtype === 'staff'
          ? { nhanvien: { create: { ma_chi_nhanh: BigInt(seed.branchId) } } }
          : {}),
      },
    });
    const token = (await login(phone).expect(200)).body.data.token as string;
    return { id: Number(person.ma_nguoi), token };
  };

  const createRecord = (body: Record<string, unknown>, token = nurse.token) =>
    api('post', '/medical_records', token).send(body);
  const recordOf = async (body: Record<string, unknown>, token?: string) =>
    (await createRecord(body, token).expect(201)).body.data as MedicalRecordData;
  /**
   * Hồ sơ của `patientId` ở trạng thái `status` (đặt thẳng trong CSDL; luồng chuyển trạng thái là của B3).
   * Đang khám hoặc hoàn tất thì có phiên 1 do `doctor` khám nên `doctor` là bác sĩ phụ trách (D-B6).
   */
  const recordIn = async (
    status: MedicalRecordStatus,
    type: RecordType = 'MAN',
    doctor: TestUser = doctorA,
    patientId = patient.id,
  ): Promise<number> => {
    const { medical_record_id: id } = await recordOf({ patient_id: patientId, record_type: type });
    if (status === 'in_progress' || status === 'completed') {
      await createVisit(prisma, {
        recordId: id,
        type,
        doctorId: doctor.id,
        number: 1,
        date: '2026-11-15',
        instructions: 'Uống thuốc đều',
      });
    }
    if (status !== 'pending') await setRecordStatus(prisma, id, status);
    return id;
  };
  const actionsOf = async (id: number, user: TestUser) =>
    (
      (await api('get', `/medical_records/${id}`, user.token).expect(200)).body
        .data as MedicalRecordData
    ).allowed_actions;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    passwordHash = await bcrypt.hash(PASSWORD, 4);
  });

  beforeEach(async () => {
    seed = await resetData(app);
    admin = await account(seed.roles.admin, '0900000001', 'QUẢN TRỊ', 'none');
    doctorA = await account(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    doctorB = await account(seed.roles.bac_si, '0902000002', 'BÁC SĨ B', 'staff');
    nurse = await account(seed.roles.dieu_duong, '0902000003', 'ĐIỀU DƯỠNG', 'none');
    patient = await account(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
    otherPatient = await account(seed.roles.benh_nhan, '0922222222', 'TRẦN VĂN BÌNH', 'patient');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /medical_records (medrec03)', () => {
    it('điều dưỡng tạo MAN: 201/1001, pending (D-B4), first_visit_at = lúc tạo (D-B9), đủ khoá của contract', async () => {
      const before = Date.now();
      const res = await createRecord({
        patient_id: patient.id,
        record_type: 'MAN',
        family_history: 'Co',
        family_history_detail: 'Mẹ bị mày đay mạn',
        self_report: {
          referral_diagnosis: 'Mày đay',
          onset_weeks: 10,
          disease_manifestation: 'San phu + phu mach',
        },
        chronic: { main_diagnosis: 'CSU', cindu_other: true, cindu_other_detail: 'Do nóng' },
      }).expect(201);
      expect(res.body).toMatchObject({ code: '1001' });
      const data = res.body.data as MedicalRecordData;
      expect(Object.keys(data)).toEqual([
        ...LIST_ITEM_KEYS,
        'instructions',
        'self_report',
        'details',
      ]);
      expect(data).toMatchObject({
        patient_id: patient.id,
        patient_name: 'LÊ THỊ MAI',
        patient_phone: '0911111111',
        record_type: 'MAN',
        status: 'pending',
        assigned_doctor_id: null,
        assigned_doctor_name: null,
        visit_count: 0,
        last_visit_date: null,
        next_appointment_date: null,
        instructions: null,
        allowed_actions: ['edit', 'cancel'],
        self_report: {
          referral_diagnosis: 'Mày đay',
          initial_clinic_diagnosis: null,
          onset_weeks: 10,
          disease_manifestation: 'San phu + phu mach',
        },
        details: {
          family_history: 'Co',
          family_history_detail: 'Mẹ bị mày đay mạn',
          acute: null,
          chronic: { main_diagnosis: 'CSU', cindu_other: true, cindu_other_detail: 'Do nóng' },
        },
      });
      expect(new Date(data.first_visit_at!).getTime()).toBeGreaterThanOrEqual(before - 1000);
      await expect(
        prisma.hosobenhan.findUniqueOrThrow({
          where: { ma_ho_so: BigInt(data.medical_record_id) },
        }),
      ).resolves.toMatchObject({ trang_thai: 'pending', loai_benh_an: 'MAN' });
    });

    it('bác sĩ tạo CAP có INTERVAL và first_visit_at gửi lên; GET trả lại đúng; bác sĩ đã phân công thấy [edit, accept, cancel]', async () => {
      const created = await recordOf(
        {
          patient_id: patient.id,
          record_type: 'CAP',
          first_visit_at: '2026-11-15T08:30:00+07:00',
          outpatient_start_date: '2026-11-15',
          acute: {
            dx_common_acute_urticaria: true,
            suspected_trigger_group: 'Thuc an',
            exposure_to_onset_seconds: 1800,
            first_onset_age: 25,
          },
        },
        doctorA.token,
      );
      expect(created).toMatchObject({
        first_visit_at: '2026-11-15T01:30:00.000Z',
        allowed_actions: ['edit', 'accept', 'cancel'],
        self_report: { disease_manifestation: null },
      });
      const res = await api(
        'get',
        `/medical_records/${created.medical_record_id}`,
        doctorA.token,
      ).expect(200);
      expect(res.body.data).toMatchObject({
        details: {
          outpatient_start_date: '2026-11-15',
          chronic: null,
          acute: {
            dx_common_acute_urticaria: true,
            suspected_trigger_group: 'Thuc an',
            exposure_to_onset_seconds: 1800,
            mean_duration_seconds: null,
            first_onset_age: 25,
          },
        },
      });
      expect(res.body.data.details.acute.updated_at).toMatch(ISO_DATE_TIME);
    });

    // Các lỗi dưới đây bị chặn trước khi đọc bệnh nhân (pipe hoặc luật thuần), nên patient_id nào cũng được.
    it.each<[string, Record<string, unknown>, string, string]>([
      ['thiếu patient_id', { record_type: 'MAN' }, '2001', 'patient_id'],
      ['thiếu record_type', { patient_id: 1 }, '2001', 'record_type'],
      ['record_type sai', { patient_id: 1, record_type: 'X' }, '2003', 'record_type'],
      [
        'khối chronic cho CAP',
        { patient_id: 1, record_type: 'CAP', chronic: { main_diagnosis: 'CSU' } },
        '2003',
        'chronic',
      ],
      [
        'biểu hiện bệnh cho CAP',
        {
          patient_id: 1,
          record_type: 'CAP',
          self_report: { disease_manifestation: 'Chi san phu' },
        },
        '2003',
        'self_report.disease_manifestation',
      ],
      [
        'tiền sử gia đình Co thiếu ghi rõ',
        { patient_id: 1, record_type: 'MAN', family_history: 'Co' },
        '2001',
        'family_history_detail',
      ],
      [
        'ghi rõ khi cờ tắt',
        {
          patient_id: 1,
          record_type: 'MAN',
          chronic: { cindu_other: false, cindu_other_detail: 'Do nóng' },
        },
        '2003',
        'chronic.cindu_other_detail',
      ],
      [
        'ngày kết thúc trước ngày bắt đầu',
        {
          patient_id: 1,
          record_type: 'MAN',
          outpatient_start_date: '2026-11-10',
          outpatient_end_date: '2026-11-01',
        },
        '2003',
        'outpatient_end_date',
      ],
      [
        'thời điểm thiếu múi giờ',
        { patient_id: 1, record_type: 'MAN', first_visit_at: '2026-11-15T08:30:00' },
        '2006',
        'first_visit_at',
      ],
      [
        'số tuần quá 2 chữ số thập phân',
        { patient_id: 1, record_type: 'MAN', self_report: { onset_weeks: 1.234 } },
        '2003',
        'self_report.onset_weeks',
      ],
      [
        'bool sai kiểu',
        { patient_id: 1, record_type: 'CAP', acute: { hospitalized: 'có' } },
        '2002',
        'acute.hospitalized',
      ],
    ])('%s → 400/%s (%s), không ghi gì', async (_title, body, code, field) => {
      const res = await createRecord(body).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('patient_id là nhân viên hoặc không tồn tại → 404/3007, không ghi gì', async () => {
      for (const patientId of [doctorA.id, 999_999]) {
        expect(
          (await createRecord({ patient_id: patientId, record_type: 'MAN' }).expect(404)).body,
        ).toEqual({
          code: '3007',
          message: 'User account not found',
        });
      }
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('bệnh nhân gọi POST → 403/3101 (nhánh tự khai làm ở B6), không ghi gì', async () => {
      const res = await createRecord(
        { record_type: 'MAN', self_report: { onset_weeks: 2 } },
        patient.token,
      ).expect(403);
      expect(res.body).toEqual(DENIED);
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('vai trò tạo thêm chưa được cấp manage_medical_records → 3101; cấp xong → 1001 (không giới hạn vai trò, D-B18)', async () => {
      const roleId = (await api('post', '/roles', admin.token).send({ name: 'le_tan' }).expect(201))
        .body.data.id as number;
      const receptionist = await account(roleId, '0902000009', 'LỄ TÂN', 'none');
      expect(
        (
          await createRecord(
            { patient_id: patient.id, record_type: 'MAN' },
            receptionist.token,
          ).expect(403)
        ).body,
      ).toEqual(DENIED);
      await api('post', '/role_permissions', admin.token)
        .send({ role_id: roleId, permissions: [seed.permissions.manage_medical_records] })
        .expect(200);
      await createRecord({ patient_id: patient.id, record_type: 'MAN' }, receptionist.token).expect(
        201,
      );
    });
  });

  describe('GET /medical_records/:id, /:id/summary (medrec05, medrec06)', () => {
    it('bệnh nhân xem hồ sơ của mình: self_report có, details null (D-B21, MT-126), allowed_actions []', async () => {
      const { medical_record_id: id } = await recordOf({
        patient_id: patient.id,
        record_type: 'MAN',
        self_report: { onset_weeks: 6 },
        chronic: { main_diagnosis: 'CSU' },
      });
      const res = await api('get', `/medical_records/${id}`, patient.token).expect(200);
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        self_report: { onset_weeks: 6 },
        details: null,
        allowed_actions: [],
      });
    });

    it('bệnh nhân xem hồ sơ người khác → 403/3106; không có → 404/4001; id sai dạng → 400/2002', async () => {
      const { medical_record_id: id } = await recordOf({
        patient_id: otherPatient.id,
        record_type: 'CAP',
      });
      expect(
        (await api('get', `/medical_records/${id}`, patient.token).expect(403)).body.code,
      ).toBe('3106');
      expect(
        (await api('get', `/medical_records/${id}/summary`, patient.token).expect(403)).body.code,
      ).toBe('3106');
      expect((await api('get', '/medical_records/999999', nurse.token).expect(404)).body.code).toBe(
        '4001',
      );
      expect(
        (await api('get', '/medical_records/abc', nurse.token).expect(400)).body,
      ).toMatchObject({
        code: '2002',
        data: { field: 'id' },
      });
    });

    it('tóm tắt: đúng 5 khoá (first_visit_at thay created_at, MT-116)', async () => {
      const { medical_record_id: id } = await recordOf({
        patient_id: patient.id,
        record_type: 'CAP',
      });
      const res = await api('get', `/medical_records/${id}/summary`, patient.token).expect(200);
      expect(Object.keys(res.body.data)).toEqual([
        'medical_record_id',
        'status',
        'record_type',
        'patient_name',
        'first_visit_at',
      ]);
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        status: 'pending',
        record_type: 'CAP',
        patient_name: 'LÊ THỊ MAI',
      });
    });

    it('thu hồi view_medical_records của điều dưỡng → 3101 ở chi tiết (service) và danh sách (guard); bệnh nhân vẫn xem được hồ sơ của mình', async () => {
      const id = await recordIn('pending');
      await api(
        'delete',
        `/role_permissions/${seed.roles.dieu_duong}/${seed.permissions.view_medical_records}`,
        admin.token,
      ).expect(200);
      expect((await api('get', `/medical_records/${id}`, nurse.token).expect(403)).body).toEqual(
        DENIED,
      );
      expect((await api('get', '/medical_records/all', nurse.token).expect(403)).body).toEqual(
        DENIED,
      );
      await api('get', `/medical_records/${id}`, patient.token).expect(200);
    });
  });

  describe('GET /medical_records/patients/:id/history (medrec13)', () => {
    it('ma_ho_so giảm dần (D-B10), đúng khoá; bệnh nhân xem của mình; id người khác → 3106; id không phải bệnh nhân → 404/3007', async () => {
      const first = await recordIn('completed', 'CAP');
      const second = await recordIn('pending');
      const res = await api(
        'get',
        `/medical_records/patients/${patient.id}/history`,
        nurse.token,
      ).expect(200);
      expect(res.body.data).toEqual([
        {
          medical_record_id: second,
          record_type: 'MAN',
          status: 'pending',
          instructions: null,
          first_visit_at: expect.stringMatching(ISO_DATE_TIME),
          last_visit_date: null,
        },
        {
          medical_record_id: first,
          record_type: 'CAP',
          status: 'completed',
          instructions: 'Uống thuốc đều',
          first_visit_at: expect.stringMatching(ISO_DATE_TIME),
          last_visit_date: '2026-11-15',
        },
      ]);
      await api('get', `/medical_records/patients/${patient.id}/history`, patient.token).expect(
        200,
      );
      expect(
        (
          await api(
            'get',
            `/medical_records/patients/${otherPatient.id}/history`,
            patient.token,
          ).expect(403)
        ).body.code,
      ).toBe('3106');
      expect(
        (
          await api('get', `/medical_records/patients/${doctorA.id}/history`, nurse.token).expect(
            404,
          )
        ).body.code,
      ).toBe('3007');
    });
  });

  describe('GET /medical_records/all, /medical_records/status-counts (medrec04, MT-120)', () => {
    it('lọc trạng thái, loại, bệnh nhân, bác sĩ phụ trách; ma_ho_so giảm dần; total ngoài data; status-counts khớp', async () => {
      const r1 = await recordIn('pending');
      const r2 = await recordIn('in_progress', 'CAP', doctorA);
      const r3 = await recordIn('in_progress', 'MAN', doctorB, otherPatient.id);
      const r4 = await recordIn('draft');
      const list = async (query: string) => {
        const res = await api('get', `/medical_records/all${query}`, nurse.token).expect(200);
        return {
          ids: (res.body.data as { medical_record_id: number }[]).map(
            (item) => item.medical_record_id,
          ),
          total: res.body.total as number,
        };
      };
      await expect(list('')).resolves.toEqual({ ids: [r4, r3, r2, r1], total: 4 });
      await expect(list('?status=in_progress')).resolves.toEqual({ ids: [r3, r2], total: 2 });
      await expect(list('?record_type=CAP')).resolves.toEqual({ ids: [r2], total: 1 });
      await expect(list(`?patient_id=${otherPatient.id}`)).resolves.toEqual({
        ids: [r3],
        total: 1,
      });
      await expect(list(`?doctor_id=${doctorA.id}`)).resolves.toEqual({ ids: [r2], total: 1 });
      await expect(list('?page=2&limit=3')).resolves.toEqual({ ids: [r1], total: 4 });
      const counts = await api('get', '/medical_records/status-counts', nurse.token).expect(200);
      expect(counts.body).toEqual({
        code: '1000',
        message: 'OK',
        data: { draft: 1, pending: 1, in_progress: 2, completed: 0, cancelled: 0 },
      });
      const mine = await api(
        'get',
        `/medical_records/status-counts?doctor_id=${doctorB.id}`,
        nurse.token,
      ).expect(200);
      expect(mine.body.data).toEqual({
        draft: 0,
        pending: 0,
        in_progress: 1,
        completed: 0,
        cancelled: 0,
      });
    });

    it('phần tử: đúng 13 khoá của contract, trường suy ra, allowed_actions theo người gọi', async () => {
      const id = await recordIn('in_progress', 'CAP', doctorA);
      const res = await api('get', '/medical_records/all', doctorA.token).expect(200);
      expect(Object.keys(res.body.data[0])).toEqual(LIST_ITEM_KEYS);
      expect(res.body.data[0]).toMatchObject({
        medical_record_id: id,
        assigned_doctor_id: doctorA.id,
        assigned_doctor_name: 'BÁC SĨ A',
        visit_count: 1,
        last_visit_date: '2026-11-15',
        allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
      });
    });

    it.each<[string, string, string]>([
      ['/medical_records/all?status=archived', '2003', 'status'],
      ['/medical_records/all?record_type=X', '2003', 'record_type'],
      ['/medical_records/all?doctor_id=abc', '2002', 'doctor_id'],
      ['/medical_records/status-counts?patient_id=1.5', '2002', 'patient_id'],
    ])('%s → 400/%s', async (path, code, field) => {
      expect((await api('get', path, nurse.token).expect(400)).body).toMatchObject({
        code,
        data: { field },
      });
    });

    it('bệnh nhân gọi danh sách, số đếm → 403/3101 (route chỉ cho nhân viên)', async () => {
      for (const path of ['/medical_records/all', '/medical_records/status-counts']) {
        expect((await api('get', path, patient.token).expect(403)).body).toEqual(DENIED);
      }
    });
  });

  describe('PATCH /medical_records/:id (mới, MT-120)', () => {
    it('điều dưỡng sửa hồ sơ chưa tiếp nhận (pending; draft theo MT-113): chỉ trường gửi đổi', async () => {
      for (const status of ['pending', 'draft'] as const) {
        const id = await recordIn(status);
        const res = await api('patch', `/medical_records/${id}`, nurse.token)
          .send({
            treated_before_visit: false,
            self_report: { referral_diagnosis: 'Mày đay mạn' },
            chronic: { csu_subtype: 'CSU Type IIb' },
          })
          .expect(200);
        expect(res.body.data).toMatchObject({
          status,
          self_report: { referral_diagnosis: 'Mày đay mạn', onset_weeks: null },
          details: {
            treated_before_visit: false,
            family_history: null,
            chronic: { csu_subtype: 'CSU Type IIb', main_diagnosis: null },
          },
        });
      }
    });

    it('tắt cờ thì ô ghi rõ tự xoá (D-B14); ngày kết thúc sớm hơn ngày bắt đầu đang lưu → 400/2003', async () => {
      const { medical_record_id: id } = await recordOf({
        patient_id: patient.id,
        record_type: 'MAN',
        family_history: 'Co',
        family_history_detail: 'Mẹ',
        outpatient_start_date: '2026-11-10',
        chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' },
      });
      const res = await api('patch', `/medical_records/${id}`, nurse.token)
        .send({ family_history: 'Khong', chronic: { cindu_other: false } })
        .expect(200);
      expect(res.body.data.details).toMatchObject({
        family_history: 'Khong',
        family_history_detail: null,
        chronic: { cindu_other: false, cindu_other_detail: null },
      });
      expect(
        (
          await api('patch', `/medical_records/${id}`, nurse.token)
            .send({ outpatient_end_date: '2026-11-01' })
            .expect(400)
        ).body,
      ).toMatchObject({ code: '2003', data: { field: 'outpatient_end_date' } });
    });

    it.each<[string, Record<string, unknown>]>([
      ['body rỗng', {}],
      ['chỉ có khối rỗng', { self_report: {}, chronic: {} }],
      [
        'chỉ có record_type, status (whitelist bỏ, D-B3, MT-127)',
        { record_type: 'CAP', status: 'completed' },
      ],
    ])('%s → 400/2001, hồ sơ không đổi', async (_title, body) => {
      const id = await recordIn('pending');
      expect(
        (await api('patch', `/medical_records/${id}`, nurse.token).send(body).expect(400)).body,
      ).toEqual({
        code: '2001',
        message: 'Missing required parameter',
      });
      const after = await api('get', `/medical_records/${id}`, nurse.token).expect(200);
      expect(after.body.data).toMatchObject({ record_type: 'MAN', status: 'pending' });
    });

    it('khối acute cho hồ sơ MAN → 400/2003 (field acute)', async () => {
      const id = await recordIn('pending');
      expect(
        (
          await api('patch', `/medical_records/${id}`, nurse.token)
            .send({ acute: { hospitalized: true } })
            .expect(400)
        ).body,
      ).toMatchObject({ code: '2003', data: { field: 'acute' } });
    });

    it('đang khám: bác sĩ phụ trách sửa được; bác sĩ khác, điều dưỡng → 403/3105 (D-B6)', async () => {
      const id = await recordIn('in_progress', 'MAN', doctorA);
      await api('patch', `/medical_records/${id}`, doctorA.token)
        .send({ chronic: { main_diagnosis: 'CSU' } })
        .expect(200);
      for (const user of [doctorB, nurse]) {
        expect(
          (
            await api('patch', `/medical_records/${id}`, user.token)
              .send({ treated_before_visit: true })
              .expect(403)
          ).body.code,
        ).toBe('3105');
      }
    });

    it('hoàn tất → 409/4003 (D-B7); đã huỷ → 400/4009; không có → 404/4001', async () => {
      const completed = await recordIn('completed', 'MAN', doctorA);
      const cancelled = await recordIn('cancelled');
      const body = { treated_before_visit: true };
      expect(
        (await api('patch', `/medical_records/${completed}`, doctorA.token).send(body).expect(409))
          .body.code,
      ).toBe('4003');
      expect(
        (await api('patch', `/medical_records/${cancelled}`, nurse.token).send(body).expect(400))
          .body.code,
      ).toBe('4009');
      expect(
        (await api('patch', '/medical_records/999999', nurse.token).send(body).expect(404)).body
          .code,
      ).toBe('4001');
    });

    it('bệnh nhân sửa hồ sơ của mình → 403/3101 (nhánh tự khai làm ở B6), không ghi gì', async () => {
      const { medical_record_id: id } = await recordOf({
        patient_id: patient.id,
        record_type: 'MAN',
        self_report: { onset_weeks: 6 },
      });
      expect(
        (
          await api('patch', `/medical_records/${id}`, patient.token)
            .send({ self_report: { onset_weeks: 8 } })
            .expect(403)
        ).body,
      ).toEqual(DENIED);
      const after = await api('get', `/medical_records/${id}`, patient.token).expect(200);
      expect(after.body.data.self_report.onset_weeks).toBe(6);
    });
  });

  describe('allowed_actions theo vai trò × trạng thái (mục 6.4, 7.5)', () => {
    it('chờ tiếp nhận: bác sĩ đã phân công tiếp nhận được; bác sĩ chưa phân công (MT-106), điều dưỡng chỉ sửa, huỷ; admin thêm xoá', async () => {
      const unassigned = await account(
        seed.roles.bac_si,
        '0902000004',
        'BÁC SĨ CHƯA PHÂN CÔNG',
        'none',
      );
      const id = await recordIn('pending');
      await expect(actionsOf(id, doctorA)).resolves.toEqual(['edit', 'accept', 'cancel']);
      await expect(actionsOf(id, unassigned)).resolves.toEqual(['edit', 'cancel']);
      await expect(actionsOf(id, nurse)).resolves.toEqual(['edit', 'cancel']);
      await expect(actionsOf(id, admin)).resolves.toEqual(['edit', 'cancel', 'delete']);
    });

    it('đang khám: bác sĩ phụ trách đủ thao tác khám; bác sĩ khác, điều dưỡng không có gì; admin chỉ xoá', async () => {
      const id = await recordIn('in_progress', 'MAN', doctorA);
      await expect(actionsOf(id, doctorA)).resolves.toEqual([
        'edit',
        'add_visit',
        'edit_visits',
        'complete',
        'cancel',
      ]);
      await expect(actionsOf(id, doctorB)).resolves.toEqual([]);
      await expect(actionsOf(id, nurse)).resolves.toEqual([]);
      await expect(actionsOf(id, admin)).resolves.toEqual(['delete']);
    });
  });

  describe('DELETE /medical_records/:id (medrec14, D-B22)', () => {
    it('admin xoá hồ sơ có phiên → 200, data {}; xem lại → 404/4001', async () => {
      const id = await recordIn('in_progress', 'MAN', doctorA);
      expect(
        (await api('delete', `/medical_records/${id}`, admin.token).expect(200)).body,
      ).toMatchObject({
        code: '1000',
        data: {},
      });
      expect((await api('get', `/medical_records/${id}`, admin.token).expect(404)).body.code).toBe(
        '4001',
      );
      expect(await prisma.phienkham.count()).toBe(0);
    });

    it('bác sĩ → 403/3102 (route chỉ cho admin); không có → 404/4001', async () => {
      const id = await recordIn('pending');
      expect(
        (await api('delete', `/medical_records/${id}`, doctorA.token).expect(403)).body.code,
      ).toBe('3102');
      expect(
        (await api('delete', '/medical_records/999999', admin.token).expect(404)).body.code,
      ).toBe('4001');
    });

    it('phiên còn dauhieusinhton (dữ liệu của C) → 409/2003, CSDL không đổi', async () => {
      const id = await recordIn('in_progress', 'MAN', doctorA);
      const [visit] = await prisma.phienkham.findMany({ where: { ma_ho_so: BigInt(id) } });
      await prisma.dauhieusinhton.create({ data: { ma_phien_kham: visit!.ma_phien_kham } });
      expect((await api('delete', `/medical_records/${id}`, admin.token).expect(409)).body).toEqual(
        {
          code: '2003',
          message: 'Invalid parameter value',
        },
      );
      expect(await prisma.hosobenhan.count()).toBe(1);
      expect(await prisma.phienkham.count()).toBe(1);
    });
  });
});
