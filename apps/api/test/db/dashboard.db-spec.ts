import type { INestApplication } from '@nestjs/common';
import { vietnamDate } from '@drmayday/shared';
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
  type SeedResult,
} from './helpers.js';

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
