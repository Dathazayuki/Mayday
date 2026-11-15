import { Logger, type ArgumentsHost, type INestApplication } from '@nestjs/common';
import type { RecordType } from '@drmayday/shared';
import type { App } from 'supertest/types.js';
import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { NewMedicalRecord } from '../../src/medical-records/medical-record-mapping.js';
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
  type SeedResult,
} from './helpers.js';

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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
