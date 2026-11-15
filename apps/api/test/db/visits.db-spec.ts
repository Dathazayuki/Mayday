import type { INestApplication } from '@nestjs/common';
import {
  vietnamDate,
  type MedicalRecordData,
  type MedicalRecordStatus,
  type RecordType,
  type VisitData,
} from '@drmayday/shared';
import request from 'supertest';
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
  signIn,
  type SeedResult,
  type TestUser,
  type TestUserKind,
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

type Method = 'get' | 'post' | 'patch' | 'delete';

const VISIT_KEYS = [
  'visit_id',
  'medical_record_id',
  'visit_number',
  'visit_date',
  'doctor_id',
  'doctor_name',
  'room_id',
  'room_name',
  'next_appointment_date',
  'instructions',
  'details',
];

describe('API phiên khám /medical_records/:id/visits, /visits/:id (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let admin: TestUser;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let nurse: TestUser;
  let patient: TestUser;
  let otherPatient: TestUser;
  /** Hôm nay + 28 ngày giờ Việt Nam: ngày hẹn hợp lệ (≥ ngày khám hôm nay). */
  let inFourWeeks: string;

  const api = (method: Method, path: string, by: TestUser) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${by.token}`);
  const user = (roleId: number, phone: string, fullName: string, kind: TestUserKind) =>
    signIn(app, { roleId, phone, fullName, kind, branchId: seed.branchId });
  const createRecord = async (type: RecordType = 'MAN') =>
    (
      await api('post', '/medical_records', nurse)
        .send({ patient_id: patient.id, record_type: type })
        .expect(201)
    ).body.data.medical_record_id as number;
  /** Hồ sơ đang khám do bác sĩ A tiếp nhận ở phòng dev 1; trả mã hồ sơ và mã phiên 1. */
  const inProgress = async (type: RecordType = 'MAN') => {
    const id = await createRecord(type);
    const res = await api('post', `/medical_records/${id}/accept`, doctorA)
      .send({ room_id: seed.roomIds[0] })
      .expect(200);
    return { id, firstVisitId: res.body.data.visit_id as number };
  };
  const visitsOf = async (id: number, by: TestUser) =>
    (await api('get', `/medical_records/${id}/visits`, by).expect(200)).body.data as VisitData[];
  const addVisit = (id: number, by: TestUser, body: object = {}) =>
    api('post', `/medical_records/${id}/visits`, by).send(body);
  const patchVisit = (visitId: number, by: TestUser, body: object) =>
    api('patch', `/visits/${visitId}`, by).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app);
    admin = await user(seed.roles.admin, '0900000001', 'QUẢN TRỊ', 'none');
    doctorA = await user(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    doctorB = await user(seed.roles.bac_si, '0902000002', 'BÁC SĨ B', 'staff');
    nurse = await user(seed.roles.dieu_duong, '0902000003', 'ĐIỀU DƯỠNG', 'none');
    patient = await user(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
    otherPatient = await user(seed.roles.benh_nhan, '0922222222', 'TRẦN VĂN BÌNH', 'patient');
    inFourWeeks = vietnamDate(new Date(Date.now() + 28 * 86_400_000));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /medical_records/:id/visits', () => {
    it('nhân viên: lan_kham_thu tăng dần, đủ 11 khoá của VisitData; details theo loại hồ sơ (CAP: acute, chronic null)', async () => {
      const { id } = await inProgress('CAP');
      await addVisit(id, doctorA, { visit_date: inFourWeeks }).expect(201);
      const visits = await visitsOf(id, nurse);
      expect(visits.map((visit) => visit.visit_number)).toEqual([1, 2]);
      expect(Object.keys(visits[0]!)).toEqual(VISIT_KEYS);
      expect(visits[0]).toMatchObject({
        medical_record_id: id,
        doctor_id: doctorA.id,
        doctor_name: 'BÁC SĨ A',
        room_id: seed.roomIds[0],
        room_name: 'Phòng khám 1 (dữ liệu dev)',
        visit_date: vietnamDate(),
        next_appointment_date: null,
        instructions: null,
        details: {
          visit_kind: null,
          fever: null,
          acute: { has_wheals: null, vomiting_count: null },
          chronic: null,
        },
      });
      expect(visits[1]).toMatchObject({ visit_date: inFourWeeks, room_id: null, room_name: null });
    });

    it('bệnh nhân: hồ sơ của mình → details null (D-B21, MT-126), vẫn có ngày khám, phòng, hẹn, dặn dò; hồ sơ người khác → 403/3106', async () => {
      const { id, firstVisitId } = await inProgress();
      await patchVisit(firstVisitId, doctorA, {
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
        visit_summary: 'Ghi chú nội bộ',
        next_plan: 'Giảm liều',
      }).expect(200);
      const [visit] = await visitsOf(id, patient);
      expect(visit).toMatchObject({
        visit_number: 1,
        room_name: 'Phòng khám 1 (dữ liệu dev)',
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
        details: null,
      });
      expect(JSON.stringify(visit)).not.toContain('Ghi chú nội bộ');
      expect(JSON.stringify(visit)).not.toContain('Giảm liều');
      expect(
        (await api('get', `/medical_records/${id}/visits`, otherPatient).expect(403)).body.code,
      ).toBe('3106');
    });

    it('hồ sơ chưa có phiên → []; không có hồ sơ → 404/4001; id sai dạng → 400/2002; điều dưỡng bị thu hồi view_medical_records → 403/3101', async () => {
      const pending = await createRecord();
      await expect(visitsOf(pending, nurse)).resolves.toEqual([]);
      expect(
        (await api('get', '/medical_records/999999/visits', nurse).expect(404)).body.code,
      ).toBe('4001');
      expect((await api('get', '/medical_records/abc/visits', nurse).expect(400)).body.code).toBe(
        '2002',
      );
      await api(
        'delete',
        `/role_permissions/${seed.roles.dieu_duong}/${seed.permissions.view_medical_records}`,
        admin,
      ).expect(200);
      expect(
        (await api('get', `/medical_records/${pending}/visits`, nurse).expect(403)).body.code,
      ).toBe('3101');
    });
  });

  describe('POST /medical_records/:id/visits', () => {
    it('201/1001: lần 2, ngày hôm nay giờ Việt Nam khi vắng visit_date, bác sĩ = người gọi, phòng chọn; hồ sơ thấy visit_count 2', async () => {
      const { id } = await inProgress();
      const res = await addVisit(id, doctorA, { room_id: seed.roomIds[1] }).expect(201);
      expect(res.body.code).toBe('1001');
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        visit_number: 2,
        visit_date: vietnamDate(),
        doctor_id: doctorA.id,
        room_id: seed.roomIds[1],
        room_name: 'Phòng khám 2 (dữ liệu dev)',
        details: { acute: null, chronic: { wheals_now: null } },
      });
      const detail = (await api('get', `/medical_records/${id}`, doctorA).expect(200)).body
        .data as MedicalRecordData;
      expect(detail).toMatchObject({ visit_count: 2, assigned_doctor_id: doctorA.id });
    });

    it('hai request thêm phiên song song → số khác nhau (2 và 3) nhờ khoá hồ sơ (D-B2)', async () => {
      const { id } = await inProgress();
      const responses = await Promise.all([addVisit(id, doctorA), addVisit(id, doctorA)]);
      expect(responses.map((res) => res.status)).toEqual([201, 201]);
      expect(
        responses.map((res) => res.body.data.visit_number as number).sort((a, b) => a - b),
      ).toEqual([2, 3]);
    });

    it('mã: chờ tiếp nhận → 400/4009; bác sĩ khác → 403/3105; điều dưỡng, admin → 403/3103; phòng không tồn tại → 400/2003 room_id; visit_date sai dạng → 400/2006; không có hồ sơ → 404/4001; không ghi gì', async () => {
      const pending = await createRecord();
      expect((await addVisit(pending, doctorA).expect(400)).body.code).toBe('4009');
      const { id } = await inProgress();
      expect((await addVisit(id, doctorB).expect(403)).body.code).toBe('3105');
      for (const by of [nurse, admin]) {
        expect((await addVisit(id, by).expect(403)).body.code).toBe('3103');
      }
      expect((await addVisit(id, doctorA, { room_id: 999_999 }).expect(400)).body).toMatchObject({
        code: '2003',
        data: { field: 'room_id' },
      });
      expect(
        (await addVisit(id, doctorA, { visit_date: '16/11/2026' }).expect(400)).body,
      ).toMatchObject({ code: '2006', data: { field: 'visit_date' } });
      expect((await addVisit(999_999, doctorA).expect(404)).body.code).toBe('4001');
      expect(await prisma.phienkham.count()).toBe(1);
    });
  });

  describe('PATCH /visits/:id', () => {
    it('lõi + khối chronic: chỉ trường gửi đổi; tắt cờ phù vị trí khác xoá ghi rõ (D-B14); dặn dò và ngày hẹn thành của hồ sơ (D-B8)', async () => {
      const { id, firstVisitId } = await inProgress();
      const res = await patchVisit(firstVisitId, doctorA, {
        fever: true,
        fever_temperature_c: 38.5,
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
        chronic: {
          wheals_now: true,
          aas7_score: 12,
          angioedema_other_site: true,
          angioedema_other_site_detail: 'Mu bàn chân',
        },
      }).expect(200);
      expect(res.body.data).toMatchObject({
        visit_id: firstVisitId,
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
        details: {
          fever: true,
          fever_temperature_c: 38.5,
          visit_kind: null,
          chronic: {
            wheals_now: true,
            aas7_score: 12,
            angioedema_other_site: true,
            angioedema_other_site_detail: 'Mu bàn chân',
            angioedema_eyelid: null,
          },
        },
      });
      const off = await patchVisit(firstVisitId, doctorA, {
        chronic: { angioedema_other_site: false },
      }).expect(200);
      expect(off.body.data.details.chronic).toMatchObject({
        angioedema_other_site: false,
        angioedema_other_site_detail: null,
        aas7_score: 12,
      });
      const detail = (await api('get', `/medical_records/${id}`, nurse).expect(200)).body
        .data as MedicalRecordData;
      expect(detail).toMatchObject({
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
      });
    });

    it('CAP: khối acute; room_id null xoá phòng (MT-115); đổi sang phòng 2', async () => {
      const { firstVisitId } = await inProgress('CAP');
      const res = await patchVisit(firstVisitId, doctorA, {
        room_id: null,
        acute: { has_wheals: true, vomiting_count: 2 },
      }).expect(200);
      expect(res.body.data).toMatchObject({
        room_id: null,
        room_name: null,
        details: { acute: { has_wheals: true, vomiting_count: 2 }, chronic: null },
      });
      const moved = await patchVisit(firstVisitId, doctorA, { room_id: seed.roomIds[1] }).expect(
        200,
      );
      expect(moved.body.data).toMatchObject({
        room_id: seed.roomIds[1],
        room_name: 'Phòng khám 2 (dữ liệu dev)',
      });
    });

    it('luật sau khi gộp: hẹn sớm hơn ngày khám → 2003; đổi ngày khám sau ngày hẹn đang lưu → 2003; bật cờ thiếu ghi rõ → 2001; ghi rõ khi cờ tắt → 2003; khối acute cho hồ sơ MAN → 2003; phòng không tồn tại → 2003; CSDL không đổi', async () => {
      const { id, firstVisitId } = await inProgress();
      await patchVisit(firstVisitId, doctorA, { next_appointment_date: inFourWeeks }).expect(200);
      const cases: [Record<string, unknown>, string, string][] = [
        [{ next_appointment_date: '2000-01-01' }, '2003', 'next_appointment_date'],
        [{ visit_date: '2099-01-01' }, '2003', 'next_appointment_date'],
        [
          { chronic: { angioedema_other_site: true } },
          '2001',
          'chronic.angioedema_other_site_detail',
        ],
        [
          { chronic: { angioedema_other_site_detail: 'Tai' } },
          '2003',
          'chronic.angioedema_other_site_detail',
        ],
        [{ acute: { has_wheals: true } }, '2003', 'acute'],
        [{ room_id: 999_999 }, '2003', 'room_id'],
      ];
      for (const [body, code, field] of cases) {
        expect((await patchVisit(firstVisitId, doctorA, body).expect(400)).body).toMatchObject({
          code,
          data: { field },
        });
      }
      const [visit] = await visitsOf(id, nurse);
      expect(visit).toMatchObject({
        visit_date: vietnamDate(),
        next_appointment_date: inFourWeeks,
        room_id: seed.roomIds[0],
        details: { chronic: { angioedema_other_site: null, angioedema_other_site_detail: null } },
      });
    });

    it('mã: body rỗng → 2001; không có phiên → 404/2003 (F.7); bác sĩ khác → 403/3105; điều dưỡng → 403/3103; fever sai kiểu → 2002; aas7 106 → 2003', async () => {
      const { firstVisitId } = await inProgress();
      expect((await patchVisit(firstVisitId, doctorA, {}).expect(400)).body.code).toBe('2001');
      expect((await patchVisit(999_999, doctorA, { fever: true }).expect(404)).body).toEqual({
        code: '2003',
        message: 'Invalid parameter value',
      });
      expect((await patchVisit(firstVisitId, doctorB, { fever: true }).expect(403)).body.code).toBe(
        '3105',
      );
      expect((await patchVisit(firstVisitId, nurse, { fever: true }).expect(403)).body.code).toBe(
        '3103',
      );
      expect(
        (await patchVisit(firstVisitId, doctorA, { fever: 'có' }).expect(400)).body,
      ).toMatchObject({ code: '2002', data: { field: 'fever' } });
      expect(
        (await patchVisit(firstVisitId, doctorA, { chronic: { aas7_score: 106 } }).expect(400))
          .body,
      ).toMatchObject({ code: '2003', data: { field: 'chronic.aas7_score' } });
    });
  });
});
