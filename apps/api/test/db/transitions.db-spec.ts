import type { INestApplication } from '@nestjs/common';
import type { RecordType } from '@drmayday/shared';
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
  type SeedResult,
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
