import type { INestApplication } from '@nestjs/common';
import { vietnamDate, type DashboardSummaryData, type RecordType } from '@drmayday/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { VisitsRepository } from '../../src/medical-records/visits.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
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

type Method = 'get' | 'post' | 'put' | 'patch';

/** Ngày `YYYY-MM-DD` giờ Việt Nam cách hôm nay `days` ngày (âm: trước), như service tính "hôm nay" (D-B23). */
const dayOffset = (days: number) => vietnamDate(new Date(Date.now() + days * 86_400_000));

describe('VisitsRepository.listOnDate: phiên trong ngày cho Tổng quan (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let visits: VisitsRepository;
  let seed: SeedResult;
  let patientA: number;
  let patientB: number;
  let doctor: number;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    visits = app.get(VisitsRepository);
  });

  beforeEach(async () => {
    seed = await resetData(app);
    patientA = await createPatientRow(prisma, '0911111111', 'LÊ THỊ MAI');
    patientB = await createPatientRow(prisma, '0922222222', 'TRẦN VĂN BÌNH');
    doctor = await createStaffRow(prisma, '0902000001', 'BÁC SĨ A', seed.branchId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('chỉ phiên có ngay_kham = ngày đó, mới nhất trước; trạng thái hồ sơ, tên bệnh nhân, bác sĩ, phòng; tổng số', async () => {
    const today = dayOffset(0);
    const recordA = Number(await createChronicRecord(prisma, patientA));
    await setRecordStatus(prisma, recordA, 'in_progress');
    const earlier = await createVisit(prisma, {
      recordId: recordA,
      type: 'MAN',
      doctorId: doctor,
      number: 1,
      date: dayOffset(-1),
    });
    const visitA = await createVisit(prisma, {
      recordId: recordA,
      type: 'MAN',
      doctorId: doctor,
      number: 2,
      date: today,
      roomId: seed.roomIds[0]!,
    });
    const recordB = Number(await createChronicRecord(prisma, patientB));
    await setRecordStatus(prisma, recordB, 'completed');
    const visitB = await createVisit(prisma, {
      recordId: recordB,
      type: 'MAN',
      doctorId: doctor,
      number: 1,
      date: today,
    });

    await expect(visits.listOnDate(today, { skip: 0, take: 10 })).resolves.toEqual({
      total: 2,
      items: [
        {
          id: visitB,
          recordId: recordB,
          number: 1,
          recordType: 'MAN',
          recordStatus: 'completed',
          patientName: 'TRẦN VĂN BÌNH',
          doctorName: 'BÁC SĨ A',
          roomName: null,
        },
        {
          id: visitA,
          recordId: recordA,
          number: 2,
          recordType: 'MAN',
          recordStatus: 'in_progress',
          patientName: 'LÊ THỊ MAI',
          doctorName: 'BÁC SĨ A',
          roomName: 'Phòng khám 1 (dữ liệu dev)',
        },
      ],
    });
    await expect(visits.listOnDate(dayOffset(-1), { skip: 0, take: 10 })).resolves.toMatchObject({
      total: 1,
      items: [{ id: earlier }],
    });
  });

  it('take giới hạn số phần tử, total vẫn là tổng thật; ngày không có phiên → rỗng', async () => {
    const today = dayOffset(0);
    const record = Number(await createChronicRecord(prisma, patientA));
    const ids: number[] = [];
    for (let number = 1; number <= 3; number++) {
      ids.push(
        await createVisit(prisma, {
          recordId: record,
          type: 'MAN',
          doctorId: doctor,
          number,
          date: today,
        }),
      );
    }

    const page = await visits.listOnDate(today, { skip: 0, take: 2 });

    expect(page.total).toBe(3);
    expect(page.items.map((visit) => visit.id)).toEqual([ids[2], ids[1]]);
    await expect(visits.listOnDate(dayOffset(1), { skip: 0, take: 10 })).resolves.toEqual({
      items: [],
      total: 0,
    });
  });
});

describe('API GET /dashboard/summary (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let seed: SeedResult;
  let admin: TestUser;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let nurse: TestUser;
  let patient: TestUser;

  const send = (method: Method, path: string, by: TestUser, body?: object) => {
    const req = request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${by.token}`);
    return body === undefined ? req : req.send(body);
  };
  const user = (roleId: number, phone: string, fullName: string, kind: TestUserKind) =>
    signIn(app, { roleId, phone, fullName, kind, branchId: seed.branchId });
  /** Hồ sơ chờ tiếp nhận do điều dưỡng tạo cho bệnh nhân. */
  const createRecord = async (type: RecordType = 'MAN') =>
    (
      await send('post', '/medical_records', nurse, {
        patient_id: patient.id,
        record_type: type,
      }).expect(201)
    ).body.data.medical_record_id as number;
  /** Bác sĩ tiếp nhận: mở phiên 1 ngày hôm nay giờ Việt Nam, chưa phân phòng. */
  const accept = (id: number, by: TestUser) =>
    send('post', `/medical_records/${id}/accept`, by, {}).expect(200);
  const summaryOf = async (by: TestUser) =>
    (await send('get', '/dashboard/summary', by).expect(200)).body.data as DashboardSummaryData;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    seed = await resetData(app);
    admin = await user(seed.roles.admin, '0900000001', 'QUẢN TRỊ', 'none');
    doctorA = await user(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    doctorB = await user(seed.roles.bac_si, '0902000002', 'BÁC SĨ B', 'staff');
    nurse = await user(seed.roles.dieu_duong, '0902000003', 'ĐIỀU DƯỠNG', 'none');
    patient = await user(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
  });

  afterAll(async () => {
    await app.close();
  });

  it('bác sĩ: số đếm theo trạng thái, phiên hôm nay mới nhất trước, my_queue chỉ hồ sơ đang khám mình phụ trách', async () => {
    const r1 = await createRecord('MAN');
    await accept(r1, doctorA);
    const r2 = await createRecord('CAP');
    await accept(r2, doctorB);
    const r3 = await createRecord('MAN');
    await accept(r3, doctorA);
    await send('put', `/medical_records/${r3}`, doctorA, { status: 'completed' }).expect(200);
    await createRecord('MAN');
    const r5 = await createRecord('CAP');
    await send('patch', `/medical_records/${r5}/status`, nurse, { status: 'cancelled' }).expect(
      200,
    );

    const forA = await summaryOf(doctorA);

    expect(forA.today).toBe(dayOffset(0));
    expect(forA.status_counts).toEqual({
      draft: 0,
      pending: 1,
      in_progress: 2,
      completed: 1,
      cancelled: 1,
    });
    expect(forA.visits_today.total).toBe(3);
    expect(forA.visits_today.items.map((visit) => visit.medical_record_id)).toEqual([r3, r2, r1]);
    expect(forA.visits_today.items[0]).toEqual({
      visit_id: expect.any(Number),
      medical_record_id: r3,
      visit_number: 1,
      record_type: 'MAN',
      record_status: 'completed',
      patient_name: 'LÊ THỊ MAI',
      doctor_name: 'BÁC SĨ A',
      room_name: null,
    });
    expect(forA.visits_today.items[1]).toMatchObject({
      record_type: 'CAP',
      record_status: 'in_progress',
      doctor_name: 'BÁC SĨ B',
    });
    expect(forA.my_queue).toEqual({
      total: 1,
      items: [
        expect.objectContaining({
          medical_record_id: r1,
          status: 'in_progress',
          assigned_doctor_id: doctorA.id,
          allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
        }),
      ],
    });
    expect((await summaryOf(doctorB)).my_queue).toMatchObject({
      total: 1,
      items: [{ medical_record_id: r2 }],
    });
  });

  it('điều dưỡng, admin: my_queue null, vẫn có số đếm và phiên hôm nay; bệnh nhân → 403/3101', async () => {
    await accept(await createRecord(), doctorA);

    for (const by of [nurse, admin]) {
      const data = await summaryOf(by);
      expect(data.my_queue).toBeNull();
      expect(data.status_counts.in_progress).toBe(1);
      expect(data.visits_today.total).toBe(1);
    }
    const res = await send('get', '/dashboard/summary', patient).expect(403);
    expect(res.body.code).toBe('3101');
  });

  it('mỗi khối tối đa 10 phần tử, total là tổng thật', async () => {
    for (let i = 0; i < 11; i++) {
      await accept(await createRecord(), doctorA);
    }

    const data = await summaryOf(doctorA);

    expect(data.visits_today.total).toBe(11);
    expect(data.visits_today.items).toHaveLength(10);
    expect(data.my_queue?.total).toBe(11);
    expect(data.my_queue?.items).toHaveLength(10);
  });
});
