import type { INestApplication } from '@nestjs/common';
import { vietnamDate, type MedicalRecordData, type RecordType } from '@drmayday/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppException } from '../../src/common/app.exception.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { RecordLock } from '../../src/medical-records/medical-record-mapping.js';
import { MedicalRecordsRepository } from '../../src/medical-records/medical-records.repository.js';
import {
  RecordTransitionsRepository,
  type StatusChange,
} from '../../src/medical-records/record-transitions.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createPatientRow,
  createStaffRow,
  createTestApp,
  createVisit,
  resetData,
  setRecordStatus,
  signIn,
  type SeedResult,
  type TestUser,
  type TestUserKind,
} from './helpers.js';

const FIRST_VISIT = new Date('2026-11-15T01:00:00.000Z');
const ACCEPTED_AT = new Date('2026-11-16T02:00:00.000Z');

describe('RecordTransitionsRepository: tiếp nhận, hoàn tất, huỷ (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let records: MedicalRecordsRepository;
  let transitions: RecordTransitionsRepository;
  let seed: SeedResult;
  let patientId: number;
  let doctorA: number;
  let doctorB: number;

  const pendingRecord = async (
    type: RecordType = 'MAN',
    firstVisitAt: Date | null = FIRST_VISIT,
  ) => {
    const record = await records.create({
      patientId,
      type,
      status: 'pending',
      firstVisitAt,
      selfReport: {},
      core: {},
      acute: {},
      chronic: {},
    });
    if (!record) throw new Error('không tạo được hồ sơ test');
    return record.id;
  };
  /** Thay đổi của tiếp nhận, như MedicalRecordsService dựng (spec B, mục 6.2). */
  const acceptBy = (doctorId: number, roomId: number | null = null): StatusChange => ({
    status: 'in_progress',
    firstVisitAtIfEmpty: ACCEPTED_AT,
    newVisit: { doctorId, roomId, date: '2026-11-16' },
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    // Đăng ký vào MedicalRecordsModule ở Task 7.
    records = new MedicalRecordsRepository(app.get(PrismaService));
    transitions = new RecordTransitionsRepository(app.get(PrismaService));
  });

  beforeEach(async () => {
    seed = await resetData(app);
    patientId = await createPatientRow(prisma, '0911111111', 'LÊ THỊ MAI');
    doctorA = await createStaffRow(prisma, '0902000001', 'BÁC SĨ A', seed.branchId);
    doctorB = await createStaffRow(prisma, '0902000002', 'BÁC SĨ B', seed.branchId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('tiếp nhận: in_progress, phiên 1 + đúng một subtype (bác sĩ, ngày, phòng); bác sĩ phụ trách = người tiếp nhận (D-B6); thoi_diem_kham_lan_dau đã có thì giữ', async () => {
    const id = await pendingRecord('CAP');
    const result = await transitions.transition(id, () => acceptBy(doctorA, seed.roomIds[0]!));
    expect(result?.record).toMatchObject({
      id,
      status: 'in_progress',
      firstVisitAt: FIRST_VISIT,
      summary: {
        assignedDoctorId: doctorA,
        assignedDoctorName: 'BÁC SĨ A',
        visitCount: 1,
        lastVisitDate: new Date('2026-11-16T00:00:00.000Z'),
      },
    });
    const visit = await prisma.phienkham.findUniqueOrThrow({
      where: { ma_phien_kham: BigInt(result!.visitId!) },
    });
    expect(visit).toMatchObject({
      ma_ho_so: BigInt(id),
      loai_benh_an: 'CAP',
      ma_bac_si: BigInt(doctorA),
      ma_phong_kham: BigInt(seed.roomIds[0]!),
      lan_kham_thu: 1,
      ngay_kham: new Date('2026-11-16T00:00:00.000Z'),
      dan_do: null,
    });
    expect([await prisma.phienkhamcap.count(), await prisma.phienkhamman.count()]).toEqual([1, 0]);
  });

  it('hồ sơ chưa có thoi_diem_kham_lan_dau (bệnh nhân tự khai): tiếp nhận ghi thời điểm tiếp nhận (D-B9)', async () => {
    const id = await pendingRecord('MAN', null);
    const result = await transitions.transition(id, () => acceptBy(doctorA));
    expect(result?.record.firstVisitAt).toEqual(ACCEPTED_AT);
    expect(await prisma.phienkhamman.count()).toBe(1);
  });

  it('decide nhận RecordLock đọc sau khoá; ném lỗi → rollback, không ghi gì; không có hồ sơ → null, decide không được gọi', async () => {
    const id = await pendingRecord();
    const decide = vi.fn((_lock: RecordLock): StatusChange => {
      throw new AppException('4004');
    });
    await expect(transitions.transition(id, decide)).rejects.toMatchObject({ code: '4004' });
    expect(decide).toHaveBeenCalledWith({
      id,
      patientId,
      type: 'MAN',
      status: 'pending',
      assignedDoctorId: null,
      latestVisitId: null,
      maxVisitNumber: 0,
    });
    await expect(records.findById(id)).resolves.toMatchObject({ status: 'pending' });
    expect(await prisma.phienkham.count()).toBe(0);
    const missing = vi.fn(() => acceptBy(doctorA));
    await expect(transitions.transition(999_999, missing)).resolves.toBeNull();
    expect(missing).not.toHaveBeenCalled();
  });

  it('phòng không tồn tại → 2003 room_id (mục 6.3) trước mọi lệnh ghi: hồ sơ vẫn pending, không có phiên', async () => {
    const id = await pendingRecord();
    await expect(
      transitions.transition(id, () => acceptBy(doctorA, 999_999)),
    ).rejects.toMatchObject({ code: '2003', data: { field: 'room_id' } });
    await expect(records.findById(id)).resolves.toMatchObject({
      status: 'pending',
      firstVisitAt: FIRST_VISIT,
    });
    expect(await prisma.phienkham.count()).toBe(0);
  });

  it('bác sĩ không có dòng nhanvien (vừa bị xoá) → FK fk_phienkham_bacsi → 3101, rollback cả trạng thái', async () => {
    const id = await pendingRecord();
    await expect(transitions.transition(id, () => acceptBy(patientId))).rejects.toMatchObject({
      code: '3101',
    });
    await expect(records.findById(id)).resolves.toMatchObject({ status: 'pending' });
  });

  it('hai lần tiếp nhận song song chạy tuần tự nhờ khoá: lần sau thấy in_progress, bác sĩ phụ trách và MAX(lan_kham_thu) của lần trước (D-B2)', async () => {
    const id = await pendingRecord();
    const seen: RecordLock[] = [];
    const acceptOnce =
      (doctorId: number) =>
      (lock: RecordLock): StatusChange => {
        seen.push(lock);
        if (lock.status !== 'pending') throw new AppException('4005');
        return acceptBy(doctorId);
      };
    const results = await Promise.allSettled([
      transitions.transition(id, acceptOnce(doctorA)),
      transitions.transition(id, acceptOnce(doctorB)),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(seen.map((lock) => lock.status)).toEqual(['pending', 'in_progress']);
    expect(seen[1]).toMatchObject({ maxVisitNumber: 1, assignedDoctorId: expect.any(Number) });
    expect(await prisma.phienkham.count()).toBe(1);
  });

  it('hoàn tất kèm dặn dò: dan_do của phiên có lan_kham_thu lớn nhất (D-B8), phiên trước giữ; vắng = giữ, null = xoá', async () => {
    const id = await pendingRecord();
    await transitions.transition(id, () => acceptBy(doctorA));
    await createVisit(prisma, {
      recordId: id,
      type: 'MAN',
      doctorId: doctorA,
      number: 2,
      date: '2026-11-20',
      instructions: 'Cũ',
    });
    const done = await transitions.transition(id, () => ({
      status: 'completed',
      instructions: 'Tái khám sau 4 tuần',
    }));
    expect(done).toMatchObject({
      visitId: null,
      record: {
        status: 'completed',
        summary: { visitCount: 2, latestInstructions: 'Tái khám sau 4 tuần' },
      },
    });
    const instructions = async () =>
      (
        await prisma.phienkham.findMany({
          orderBy: { lan_kham_thu: 'asc' },
          select: { dan_do: true },
        })
      ).map((row) => row.dan_do);
    expect(await instructions()).toEqual([null, 'Tái khám sau 4 tuần']);
    await transitions.transition(id, () => ({ status: 'completed' }));
    expect(await instructions()).toEqual([null, 'Tái khám sau 4 tuần']);
    await transitions.transition(id, () => ({ status: 'completed', instructions: null }));
    expect(await instructions()).toEqual([null, null]);
  });

  it('huỷ: chỉ đổi trạng thái, không mở phiên; dặn dò mà hồ sơ chưa có phiên → lỗi lập trình, rollback', async () => {
    const id = await pendingRecord();
    await expect(
      transitions.transition(id, () => ({ status: 'cancelled', instructions: 'x' })),
    ).rejects.toThrow(/chưa có phiên/);
    await expect(records.findById(id)).resolves.toMatchObject({ status: 'pending' });
    await expect(
      transitions.transition(id, () => ({ status: 'cancelled' })),
    ).resolves.toMatchObject({
      visitId: null,
      record: { status: 'cancelled', summary: { visitCount: 0 } },
    });
    expect(await prisma.phienkham.count()).toBe(0);
  });
});

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

describe('API chuyển trạng thái /medical_records (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let admin: TestUser;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let unassigned: TestUser;
  let nurse: TestUser;
  let patient: TestUser;

  const api = (method: Method, path: string, by: TestUser) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${by.token}`);
  const user = (roleId: number, phone: string, fullName: string, kind: TestUserKind) =>
    signIn(app, { roleId, phone, fullName, kind, branchId: seed.branchId });
  /** Hồ sơ chờ tiếp nhận do điều dưỡng tạo qua API (B2). */
  const createRecord = async (type: RecordType = 'MAN', body: Record<string, unknown> = {}) =>
    (
      await api('post', '/medical_records', nurse)
        .send({ patient_id: patient.id, record_type: type, ...body })
        .expect(201)
    ).body.data.medical_record_id as number;
  const accept = (id: number, by: TestUser, body: object = {}) =>
    api('post', `/medical_records/${id}/accept`, by).send(body);
  /** Hồ sơ đang khám do `by` tiếp nhận (bác sĩ phụ trách, D-B6). */
  const inProgress = async (type: RecordType = 'MAN', by: TestUser = doctorA) => {
    const id = await createRecord(type);
    await accept(id, by).expect(200);
    return id;
  };
  const close = (id: number, by: TestUser, body: object) =>
    api('put', `/medical_records/${id}`, by).send(body);
  const cancel = (id: number, by: TestUser, body: object = { status: 'cancelled' }) =>
    api('patch', `/medical_records/${id}/status`, by).send(body);
  const statusOf = async (id: number) =>
    (await prisma.hosobenhan.findUniqueOrThrow({ where: { ma_ho_so: BigInt(id) } })).trang_thai;
  const firstVisitOf = async (id: number) =>
    (await prisma.hosobenhan.findUniqueOrThrow({ where: { ma_ho_so: BigInt(id) } }))
      .thoi_diem_kham_lan_dau;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app);
    admin = await user(seed.roles.admin, '0900000001', 'QUẢN TRỊ', 'none');
    doctorA = await user(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    doctorB = await user(seed.roles.bac_si, '0902000002', 'BÁC SĨ B', 'staff');
    unassigned = await user(seed.roles.bac_si, '0902000004', 'BÁC SĨ CHƯA PHÂN CÔNG', 'none');
    nurse = await user(seed.roles.dieu_duong, '0902000003', 'ĐIỀU DƯỠNG', 'none');
    patient = await user(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /medical_records/:id/accept (medrec07)', () => {
    it('200/1000, đúng 4 khoá; phiên 1 do bác sĩ khám hôm nay giờ Việt Nam ở phòng chọn (D-B5, D-B23); GET thấy in_progress và thao tác của bác sĩ phụ trách', async () => {
      const id = await createRecord('CAP');
      const res = await accept(id, doctorA, { room_id: seed.roomIds[0] }).expect(200);
      expect(res.body.code).toBe('1000');
      expect(Object.keys(res.body.data)).toEqual([
        'medical_record_id',
        'assigned_doctor_id',
        'status',
        'visit_id',
      ]);
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        assigned_doctor_id: doctorA.id,
        status: 'in_progress',
      });
      const visit = await prisma.phienkham.findUniqueOrThrow({
        where: { ma_phien_kham: BigInt(res.body.data.visit_id as number) },
      });
      expect(visit).toMatchObject({
        ma_ho_so: BigInt(id),
        loai_benh_an: 'CAP',
        ma_bac_si: BigInt(doctorA.id),
        ma_phong_kham: BigInt(seed.roomIds[0]!),
        lan_kham_thu: 1,
      });
      expect(visit.ngay_kham.toISOString().slice(0, 10)).toBe(vietnamDate());
      expect(await prisma.phienkhamcap.count()).toBe(1);
      const detail = (await api('get', `/medical_records/${id}`, doctorA).expect(200)).body
        .data as MedicalRecordData;
      expect(detail).toMatchObject({
        status: 'in_progress',
        assigned_doctor_id: doctorA.id,
        assigned_doctor_name: 'BÁC SĨ A',
        visit_count: 1,
        last_visit_date: vietnamDate(),
        allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
      });
    });

    it('hai bác sĩ tiếp nhận song song → đúng một 1000 và một 4005 (409) (test case medrec07); chỉ một phiên', async () => {
      const id = await createRecord();
      const responses = await Promise.all([accept(id, doctorA), accept(id, doctorB)]);
      expect(responses.map((res) => res.body.code as string).sort()).toEqual(['1000', '4005']);
      expect(responses.find((res) => res.body.code === '4005')?.status).toBe(409);
      expect(await prisma.phienkham.count()).toBe(1);
    });

    it('ô trạng thái: bác sĩ phụ trách tiếp nhận lại → 4004, bác sĩ khác → 4005; nháp (MT-113), hoàn tất, đã huỷ → 4004; không có → 404/4001; id sai dạng → 400/2002', async () => {
      const id = await inProgress();
      expect((await accept(id, doctorA).expect(409)).body.code).toBe('4004');
      expect((await accept(id, doctorB).expect(409)).body.code).toBe('4005');
      const draft = await createRecord();
      await setRecordStatus(prisma, draft, 'draft');
      expect((await accept(draft, doctorA).expect(409)).body.code).toBe('4004');
      const done = await inProgress();
      await close(done, doctorA, { status: 'completed' }).expect(200);
      expect((await accept(done, doctorB).expect(409)).body.code).toBe('4004');
      const cancelled = await createRecord();
      await cancel(cancelled, nurse).expect(200);
      expect((await accept(cancelled, doctorA).expect(409)).body.code).toBe('4004');
      expect((await accept(999_999, doctorA).expect(404)).body.code).toBe('4001');
      expect(
        (await api('post', '/medical_records/abc/accept', doctorA).send({}).expect(400)).body,
      ).toMatchObject({ code: '2002', data: { field: 'id' } });
    });

    it('người làm: điều dưỡng, admin, bệnh nhân → 403/3103 (route chỉ bac_si, mục 7.5); bác sĩ chưa phân công → 403/3101 (MT-106); không ghi gì', async () => {
      const id = await createRecord();
      for (const by of [nurse, admin, patient]) {
        expect((await accept(id, by).expect(403)).body.code).toBe('3103');
      }
      expect((await accept(id, unassigned).expect(403)).body.code).toBe('3101');
      expect(await statusOf(id)).toBe('pending');
      expect(await prisma.phienkham.count()).toBe(0);
    });

    it('thứ tự mục 6.3: hồ sơ đang khám của bác sĩ khác, bác sĩ chưa phân công gọi → 4005 (ô trạng thái trước dòng nhanvien)', async () => {
      const id = await inProgress();
      expect((await accept(id, unassigned).expect(409)).body.code).toBe('4005');
    });

    it('phòng: không tồn tại → 400/2003 room_id, hồ sơ vẫn pending; sai kiểu → 400/2002; null → phiên chưa phân phòng (MT-115)', async () => {
      const id = await createRecord();
      expect((await accept(id, doctorA, { room_id: 999_999 }).expect(400)).body).toMatchObject({
        code: '2003',
        data: { field: 'room_id' },
      });
      expect((await accept(id, doctorA, { room_id: '1' }).expect(400)).body).toMatchObject({
        code: '2002',
        data: { field: 'room_id' },
      });
      expect(await statusOf(id)).toBe('pending');
      await accept(id, doctorA, { room_id: null }).expect(200);
      expect((await prisma.phienkham.findFirstOrThrow()).ma_phong_kham).toBeNull();
    });

    it('phòng không tồn tại chỉ xét sau 4004/4005/3101 (mục 6.3): hồ sơ đang khám/nháp → 4004 hoặc 4005, bác sĩ chưa phân công → 3101, không phải 2003', async () => {
      const id = await inProgress();
      expect((await accept(id, doctorA, { room_id: 999_999 }).expect(409)).body.code).toBe('4004');
      expect((await accept(id, doctorB, { room_id: 999_999 }).expect(409)).body.code).toBe('4005');
      const draft = await createRecord();
      await setRecordStatus(prisma, draft, 'draft');
      expect((await accept(draft, doctorA, { room_id: 999_999 }).expect(409)).body.code).toBe(
        '4004',
      );
      const pending = await createRecord();
      expect((await accept(pending, unassigned, { room_id: 999_999 }).expect(403)).body.code).toBe(
        '3101',
      );
      expect(await prisma.phienkham.count()).toBe(1);
    });

    it('first_visit_at: hồ sơ chưa có (dạng tự khai) → ghi thời điểm tiếp nhận; đã có thì giữ (D-B9, MT-116)', async () => {
      const selfReported = await createRecord();
      await prisma.hosobenhan.update({
        where: { ma_ho_so: BigInt(selfReported) },
        data: { thoi_diem_kham_lan_dau: null },
      });
      const before = Date.now();
      await accept(selfReported, doctorA).expect(200);
      expect((await firstVisitOf(selfReported))!.getTime()).toBeGreaterThanOrEqual(before - 1000);
      const staffCreated = await createRecord('MAN', {
        first_visit_at: '2026-11-10T08:00:00+07:00',
      });
      await accept(staffCreated, doctorA).expect(200);
      expect(await firstVisitOf(staffCreated)).toEqual(new Date('2026-11-10T01:00:00.000Z'));
    });

    it('rbac: thu hồi examine_medical_records của bac_si → 403/3101 ở guard; vai trò tạo thêm có view_medical_records xem được chi tiết nhưng tiếp nhận → 403/3103', async () => {
      const id = await createRecord();
      const roleId = (await api('post', '/roles', admin).send({ name: 'le_tan' }).expect(201)).body
        .data.id as number;
      await api('post', '/role_permissions', admin)
        .send({ role_id: roleId, permissions: [seed.permissions.view_medical_records] })
        .expect(200);
      const receptionist = await user(roleId, '0902000009', 'LỄ TÂN', 'staff');
      await api('get', `/medical_records/${id}`, receptionist).expect(200);
      expect((await accept(id, receptionist).expect(403)).body.code).toBe('3103');
      await api(
        'delete',
        `/role_permissions/${seed.roles.bac_si}/${seed.permissions.examine_medical_records}`,
        admin,
      ).expect(200);
      expect((await accept(id, doctorA).expect(403)).body.code).toBe('3101');
      expect(await statusOf(id)).toBe('pending');
    });
  });

  describe('PUT /medical_records/:id (medrec11)', () => {
    it('hoàn tất kèm dặn dò: 200/1000, MedicalRecordData completed, instructions mới (D-B8); sau đó mọi thao tác ghi → 409/4003 (D-B7)', async () => {
      const id = await inProgress();
      const visitId = Number((await prisma.phienkham.findFirstOrThrow()).ma_phien_kham);
      const res = await close(id, doctorA, {
        status: 'completed',
        instructions: '  Tái khám sau 4 tuần  ',
      }).expect(200);
      expect(res.body.code).toBe('1000');
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        status: 'completed',
        instructions: 'Tái khám sau 4 tuần',
        allowed_actions: [],
      });
      expect(res.body.data.details).not.toBeNull();
      const writes = [
        () => api('patch', `/medical_records/${id}`, doctorA).send({ treated_before_visit: true }),
        () => api('patch', `/visits/${visitId}`, doctorA).send({ fever: false }),
        () => api('post', `/medical_records/${id}/visits`, doctorA).send({}),
        () => close(id, doctorA, { status: 'completed' }),
        () => cancel(id, doctorA),
      ];
      for (const write of writes) {
        expect((await write().expect(409)).body.code).toBe('4003');
      }
    });

    it('huỷ khi đang khám bằng PUT → cancelled; vắng instructions → giữ dặn dò của phiên mới nhất', async () => {
      const id = await inProgress();
      const visitId = Number((await prisma.phienkham.findFirstOrThrow()).ma_phien_kham);
      await api('patch', `/visits/${visitId}`, doctorA)
        .send({ instructions: 'Uống thuốc đều' })
        .expect(200);
      const res = await close(id, doctorA, { status: 'cancelled' }).expect(200);
      expect(res.body.data).toMatchObject({ status: 'cancelled', instructions: 'Uống thuốc đều' });
    });

    it('mã: thiếu status → 2001; status khác → 400/4009; instructions quá 2000 → 2003; bác sĩ khác → 403/3105; chờ tiếp nhận → 400/4009; điều dưỡng → 403/3103; không có → 404/4001', async () => {
      const id = await inProgress();
      expect((await close(id, doctorA, {}).expect(400)).body).toMatchObject({
        code: '2001',
        data: { field: 'status' },
      });
      expect((await close(id, doctorA, { status: 'in_progress' }).expect(400)).body).toMatchObject({
        code: '4009',
        data: { field: 'status' },
      });
      expect(
        (
          await close(id, doctorA, { status: 'completed', instructions: 'a'.repeat(2001) }).expect(
            400,
          )
        ).body,
      ).toMatchObject({ code: '2003', data: { field: 'instructions' } });
      expect((await close(id, doctorB, { status: 'completed' }).expect(403)).body.code).toBe(
        '3105',
      );
      const pending = await createRecord();
      expect((await close(pending, doctorA, { status: 'completed' }).expect(400)).body.code).toBe(
        '4009',
      );
      expect((await close(id, nurse, { status: 'completed' }).expect(403)).body.code).toBe('3103');
      expect((await close(999_999, doctorA, { status: 'completed' }).expect(404)).body.code).toBe(
        '4001',
      );
      expect(await statusOf(id)).toBe('in_progress');
    });
  });

  describe('PATCH /medical_records/:id/status (tab chỉ có trong Sheet)', () => {
    it('điều dưỡng huỷ hồ sơ chờ tiếp nhận → 200, data {id chuỗi, status} (MT-06); huỷ lại → 400/4009; nháp huỷ được (MT-113)', async () => {
      const id = await createRecord();
      expect((await cancel(id, nurse).expect(200)).body).toEqual({
        code: '1000',
        message: 'OK',
        data: { id: String(id), status: 'cancelled' },
      });
      expect((await cancel(id, nurse).expect(400)).body.code).toBe('4009');
      const draft = await createRecord();
      await setRecordStatus(prisma, draft, 'draft');
      await cancel(draft, nurse).expect(200);
      expect(await statusOf(draft)).toBe('cancelled');
    });

    it('đang khám: bác sĩ phụ trách huỷ được; bác sĩ khác, điều dưỡng → 403/3105 (mục 6.1, 7.2); hoàn tất → 409/4003', async () => {
      const id = await inProgress();
      for (const by of [doctorB, nurse]) {
        expect((await cancel(id, by).expect(403)).body.code).toBe('3105');
      }
      await cancel(id, doctorA).expect(200);
      expect(await statusOf(id)).toBe('cancelled');
      const done = await inProgress();
      await close(done, doctorA, { status: 'completed' }).expect(200);
      expect((await cancel(done, nurse).expect(409)).body.code).toBe('4003');
    });

    it('body: thiếu status → 2001; status khác cancelled → 400/4009, xét trước quyền (bệnh nhân gửi completed vẫn nhận 4009)', async () => {
      const id = await createRecord();
      expect((await cancel(id, nurse, {}).expect(400)).body.code).toBe('2001');
      expect((await cancel(id, nurse, { status: 'completed' }).expect(400)).body.code).toBe('4009');
      expect((await cancel(id, patient, { status: 'completed' }).expect(400)).body.code).toBe(
        '4009',
      );
      expect(await statusOf(id)).toBe('pending');
    });

    it('bệnh nhân → 403/3101 (nhánh tự huỷ D-B32 làm ở B6); điều dưỡng bị thu hồi manage_medical_records → 403/3101; không có → 404/4001', async () => {
      const id = await createRecord();
      expect((await cancel(id, patient).expect(403)).body.code).toBe('3101');
      await api(
        'delete',
        `/role_permissions/${seed.roles.dieu_duong}/${seed.permissions.manage_medical_records}`,
        admin,
      ).expect(200);
      expect((await cancel(id, nurse).expect(403)).body.code).toBe('3101');
      expect((await cancel(999_999, doctorA).expect(404)).body.code).toBe('4001');
      expect(await statusOf(id)).toBe('pending');
    });
  });
});
