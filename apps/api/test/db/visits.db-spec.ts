import type { INestApplication } from '@nestjs/common';
import type { MedicalRecordStatus, RecordType } from '@drmayday/shared';
import type { App } from 'supertest/types.js';
import type { AppException } from '../../src/common/app.exception.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { RecordLock } from '../../src/medical-records/medical-record-mapping.js';
import { MedicalRecordsRepository } from '../../src/medical-records/medical-records.repository.js';
import type {
  NewVisit,
  VisitChanges,
  VisitRecord,
} from '../../src/medical-records/visit-mapping.js';
import {
  VisitsRepository,
  insertVisit,
  withVisitWriteErrors,
} from '../../src/medical-records/visits.repository.js';
import { checkConstraintName, isCheckViolation } from '../../src/prisma/prisma-errors.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createPatientRow,
  createStaffRow,
  createTestApp,
  resetData,
  type SeedResult,
} from './helpers.js';

describe('VisitsRepository: đọc, thêm, sửa phiên (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let records: MedicalRecordsRepository;
  let visits: VisitsRepository;
  let seed: SeedResult;
  let patientId: number;
  let doctorId: number;

  /** Hồ sơ ở `status` (repository của B2 ghi trạng thái tường minh), chưa có phiên. */
  const recordOf = async (type: RecordType, status: MedicalRecordStatus = 'in_progress') => {
    const record = await records.create({
      patientId,
      type,
      status,
      firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
      selfReport: {},
      core: {},
      acute: {},
      chronic: {},
    });
    if (!record) throw new Error('không tạo được hồ sơ test');
    return record.id;
  };
  const newVisit = (
    recordId: number,
    type: RecordType,
    number: number,
    extra: Partial<NewVisit> = {},
  ): NewVisit => ({
    recordId,
    type,
    number,
    doctorId,
    roomId: null,
    date: '2026-11-15',
    nextAppointmentDate: null,
    instructions: null,
    core: {},
    acute: {},
    chronic: {},
    ...extra,
  });
  /** insertVisit trong transaction riêng (như seed lâm sàng gọi). */
  const insert = (visit: NewVisit) => prisma.$transaction((tx) => insertVisit(tx, visit));
  const subtypeCounts = async () => [
    await prisma.phienkham.count(),
    await prisma.phienkhamcap.count(),
    await prisma.phienkhamman.count(),
  ];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    // Đăng ký vào MedicalRecordsModule ở Task 9.
    records = new MedicalRecordsRepository(app.get(PrismaService));
    visits = new VisitsRepository(app.get(PrismaService));
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

  describe('insertVisit, listByRecord (D-B1)', () => {
    it('MAN: phienkham + đúng một phienkhamman; đọc lại lõi, khối chronic, tên bác sĩ, tên phòng; lan_kham_thu tăng dần', async () => {
      const id = await recordOf('MAN');
      await insert(
        newVisit(id, 'MAN', 2, {
          date: '2026-11-20',
          roomId: seed.roomIds[1]!,
          nextAppointmentDate: '2026-12-18',
          instructions: 'Uống thuốc đều',
          core: { fever: true, fever_temperature_c: 38.5, visit_summary: 'Đỡ ngứa' },
          chronic: {
            wheals_now: true,
            spontaneous_weeks: 6.25,
            aas7_score: 12,
            angioedema_other_site: true,
            angioedema_other_site_detail: 'Mu bàn chân',
          },
        }),
      );
      await insert(newVisit(id, 'MAN', 1));
      const found = await visits.listByRecord(id);
      expect(found?.patientId).toBe(patientId);
      expect(found?.visits.map((visit) => visit.number)).toEqual([1, 2]);
      expect(found?.visits[1]).toMatchObject({
        recordId: id,
        type: 'MAN',
        number: 2,
        date: '2026-11-20',
        doctorId,
        doctorName: 'BÁC SĨ A',
        roomId: seed.roomIds[1],
        roomName: 'Phòng khám 2 (dữ liệu dev)',
        nextAppointmentDate: '2026-12-18',
        instructions: 'Uống thuốc đều',
        core: {
          visit_kind: null,
          serum_stored: null,
          fever: true,
          fever_temperature_c: 38.5,
          visit_summary: 'Đỡ ngứa',
          next_plan: null,
        },
        acute: null,
        chronic: {
          wheals_now: true,
          spontaneous_weeks: 6.25,
          aas7_score: 12,
          angioedema_other_site: true,
          angioedema_other_site_detail: 'Mu bàn chân',
          angioedema_eyelid: null,
        },
      });
      expect(found?.visits[0]).toMatchObject({ roomId: null, roomName: null, instructions: null });
      expect(await subtypeCounts()).toEqual([2, 0, 2]);
    });

    it('CAP: phienkhamcap nhận khối acute; chronic null', async () => {
      const id = await recordOf('CAP');
      const visitId = await insert(
        newVisit(id, 'CAP', 1, {
          core: { fever: false },
          acute: { has_wheals: true, vomiting_count: 0, skin_symptoms: 'Sẩn phù' },
        }),
      );
      const [visit] = (await visits.listByRecord(id))!.visits;
      expect(visit).toMatchObject({
        id: visitId,
        type: 'CAP',
        chronic: null,
        core: { fever: false },
        acute: {
          has_wheals: true,
          vomiting_count: 0,
          skin_symptoms: 'Sẩn phù',
          has_wheal_photo: null,
        },
      });
      expect(await subtypeCounts()).toEqual([1, 1, 0]);
    });

    it('hồ sơ chưa có phiên → visits []; không có hồ sơ → null', async () => {
      const id = await recordOf('MAN', 'pending');
      await expect(visits.listByRecord(id)).resolves.toEqual({ patientId, visits: [] });
      await expect(visits.listByRecord(999_999)).resolves.toBeNull();
    });
  });

  describe('add (D-B2: khoá rồi mới đánh số)', () => {
    it('lan_kham_thu = MAX + 1; decide nhận RecordLock đọc sau khoá; phiên chỉ có khoá và cột của VisitStart', async () => {
      const id = await recordOf('CAP');
      await insert(newVisit(id, 'CAP', 1));
      const decide = vi.fn((_lock: RecordLock) => ({
        doctorId,
        roomId: seed.roomIds[0]!,
        date: '2026-11-16',
      }));
      const visit = await visits.add(id, decide);
      expect(decide).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          status: 'in_progress',
          assignedDoctorId: doctorId,
          maxVisitNumber: 1,
        }),
      );
      expect(visit).toMatchObject({
        recordId: id,
        number: 2,
        date: '2026-11-16',
        roomId: seed.roomIds[0],
        roomName: 'Phòng khám 1 (dữ liệu dev)',
        nextAppointmentDate: null,
        instructions: null,
        acute: { has_wheals: null },
      });
      expect(await subtypeCounts()).toEqual([2, 2, 0]);
    });

    it('hai lần thêm song song → số khác nhau (2 và 3): lần sau chờ khoá rồi đọc MAX mới', async () => {
      const id = await recordOf('MAN');
      await insert(newVisit(id, 'MAN', 1));
      const start = () => ({ doctorId, roomId: null, date: '2026-11-16' });
      const added = await Promise.all([visits.add(id, start), visits.add(id, start)]);
      expect(added.map((visit) => visit?.number).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
        2, 3,
      ]);
    });

    it('phòng không tồn tại → 2003 room_id, không ghi gì; không có hồ sơ → null, decide không được gọi; decide ném → rollback', async () => {
      const id = await recordOf('MAN');
      await expect(
        visits.add(id, () => ({ doctorId, roomId: 999_999, date: '2026-11-16' })),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'room_id' } });
      const missing = vi.fn(() => ({ doctorId, roomId: null, date: '2026-11-16' }));
      await expect(visits.add(999_999, missing)).resolves.toBeNull();
      expect(missing).not.toHaveBeenCalled();
      await expect(
        visits.add(id, () => {
          throw new Error('dừng');
        }),
      ).rejects.toThrow('dừng');
      expect(await subtypeCounts()).toEqual([0, 0, 0]);
    });
  });

  describe('update (D-B2: khoá hồ sơ của phiên; chỉ ghi cột được gửi)', () => {
    it('lõi và khối chronic: cột được gửi đổi, null = xoá, cột khác giữ; decide nhận lock và phiên đang lưu', async () => {
      const id = await recordOf('MAN');
      const visitId = await insert(
        newVisit(id, 'MAN', 1, {
          instructions: 'Cũ',
          core: { visit_summary: 'Giữ nguyên' },
          chronic: { aas7_score: 5, wheals_now: true },
        }),
      );
      const decide = vi.fn((_lock: RecordLock, _current: VisitRecord): VisitChanges => ({
        instructions: null,
        core: { fever: true },
        chronic: { aas7_score: 12 },
      }));
      const updated = await visits.update(visitId, decide);
      expect(decide).toHaveBeenCalledWith(
        expect.objectContaining({ id, maxVisitNumber: 1, latestVisitId: visitId }),
        expect.objectContaining({ id: visitId, instructions: 'Cũ' }),
      );
      expect(updated).toMatchObject({
        instructions: null,
        core: { fever: true, visit_summary: 'Giữ nguyên' },
        chronic: { aas7_score: 12, wheals_now: true },
      });
    });

    it('ngày khám, phòng, ngày hẹn; phòng không tồn tại → 2003 room_id, CSDL không đổi', async () => {
      const id = await recordOf('CAP');
      const visitId = await insert(newVisit(id, 'CAP', 1, { roomId: seed.roomIds[0]! }));
      await expect(
        visits.update(visitId, () => ({
          date: '2026-11-17',
          roomId: null,
          nextAppointmentDate: '2026-12-01',
        })),
      ).resolves.toMatchObject({
        date: '2026-11-17',
        roomId: null,
        nextAppointmentDate: '2026-12-01',
      });
      await expect(
        visits.update(visitId, () => ({ roomId: 999_999, instructions: 'Mới' })),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'room_id' } });
      expect((await visits.listByRecord(id))?.visits[0]).toMatchObject({
        roomId: null,
        instructions: null,
      });
    });

    it('không có phiên → null, decide không được gọi; decide ném → rollback', async () => {
      const decide = vi.fn((): VisitChanges => ({}));
      await expect(visits.update(999_999, decide)).resolves.toBeNull();
      expect(decide).not.toHaveBeenCalled();
      const id = await recordOf('MAN');
      const visitId = await insert(newVisit(id, 'MAN', 1, { instructions: 'Cũ' }));
      await expect(
        visits.update(visitId, () => {
          throw new Error('dừng');
        }),
      ).rejects.toThrow('dừng');
      expect((await visits.listByRecord(id))?.visits[0]?.instructions).toBe('Cũ');
    });

    it('vi phạm CHECK lọt qua repository (aas7 200) → lỗi CHECK có tên ck_phienkhamman_aas7 (AllExceptionsFilter trả 2003, D9)', async () => {
      const id = await recordOf('MAN');
      const visitId = await insert(newVisit(id, 'MAN', 1));
      const error = await visits
        .update(visitId, () => ({ chronic: { aas7_score: 200 } }))
        .catch((caught: unknown) => caught);
      expect(isCheckViolation(error)).toBe(true);
      expect(checkConstraintName(error)).toBe('ck_phienkhamman_aas7');
    });
  });

  describe('withVisitWriteErrors (spec B, mục 4.5)', () => {
    const codeOf = (work: () => Promise<unknown>) =>
      withVisitWriteErrors(work).then(
        () => null,
        (error: AppException) => ({
          code: error.code,
          data: error.data,
          httpStatus: error.httpStatus,
        }),
      );

    it('trùng lan_kham_thu (nơi ghi không qua khoá) → 2003 (409); bác sĩ không có dòng nhanvien → 3101; phòng không tồn tại (FK) → 2003 room_id; không ghi gì', async () => {
      const id = await recordOf('MAN');
      await insert(newVisit(id, 'MAN', 1));
      await expect(codeOf(() => insert(newVisit(id, 'MAN', 1)))).resolves.toEqual({
        code: '2003',
        data: undefined,
        httpStatus: 409,
      });
      await expect(
        codeOf(() => insert(newVisit(id, 'MAN', 2, { doctorId: patientId }))),
      ).resolves.toMatchObject({ code: '3101' });
      await expect(
        codeOf(() => insert(newVisit(id, 'MAN', 2, { roomId: 999_999 }))),
      ).resolves.toEqual({ code: '2003', data: { field: 'room_id' }, httpStatus: undefined });
      expect(await subtypeCounts()).toEqual([1, 0, 1]);
    });
  });
});
