import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { SeedResult } from '../../prisma/seed.js';
import { TokenBlacklistRepository } from '../../src/auth/token-blacklist.repository.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { NewUser } from '../../src/users/user-mapping.js';
import { UsersRepository } from '../../src/users/users.repository.js';
import { createTestApp, resetData } from './helpers.js';

/** Nhánh của repository mà test HTTP không tạo ra được một cách chắc chắn (đồng thời, giai đoạn sau). */
describe('Repository (MySQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let users: UsersRepository;

  const newUser: NewUser = {
    fullName: ' lê thị c ',
    phone: '0933333333',
    passwordHash: 'hash',
    gender: 'female',
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    users = app.get(UsersRepository);
  });

  beforeEach(async () => {
    seed = await resetData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('UsersRepository', () => {
    it('createPatient cùng số lần hai (đã lọt kiểm tra phoneExists) → AppException 3006', async () => {
      const patient = { ...newUser, patientRoleId: seed.roles.patient };
      await users.createPatient(patient);
      await expect(users.createPatient(patient)).rejects.toMatchObject({ code: '3006' });
      expect(await prisma.users.count()).toBe(1);
    });

    it('createStaff ghi users + staffs đúng FK; trùng số → 3006', async () => {
      const staff = {
        ...newUser,
        roleId: seed.roles.doctor,
        branchId: seed.branchId,
        departmentId: seed.departmentId,
        roomId: null,
      };
      const created = await users.createStaff(staff);
      expect(created).toMatchObject({
        ho_ten: 'LÊ THỊ C',
        gioi_tinh: 'Nu',
        patients: null,
        staffs: {
          role_id: seed.roles.doctor,
          branch_id: seed.branchId,
          department_id: seed.departmentId,
          room_id: null,
        },
      });
      await expect(users.createStaff(staff)).rejects.toMatchObject({ code: '3006' });
    });

    it('updateProfile bệnh nhân: ghi cột tiếng Việt, năm sinh không đổi thì giữ ngày (MT-13)', async () => {
      const { user_id } = await users.createPatient({
        ...newUser,
        patientRoleId: seed.roles.patient,
      });
      await prisma.patients.update({
        where: { user_id },
        data: { ngay_sinh: new Date('1990-05-06T00:00:00.000Z'), dan_toc: 'Tày' },
      });

      const updated = await users.updateProfile(user_id, {
        full_name: 'lê thị d',
        year_of_birth: 1990,
        career: 'Can bo cong chuc',
        ethnic: null,
        health_insurance_validate: '2027-03-31',
      });
      expect(updated).toMatchObject({
        ho_ten: 'LÊ THỊ D',
        patients: {
          ngay_sinh: new Date('1990-05-06T00:00:00.000Z'),
          nghe_nghiep: 'Can_bo_cong_chuc',
          dan_toc: null,
          bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
        },
      });

      const nextYear = await users.updateProfile(user_id, { year_of_birth: 1991 });
      expect(nextYear.patients?.ngay_sinh).toEqual(new Date('1991-01-01T00:00:00.000Z'));
    });

    it('updateProfile nhân viên (không có patients): chỉ ghi users', async () => {
      const { user_id } = await users.createStaff({
        ...newUser,
        roleId: seed.roles.doctor,
        branchId: seed.branchId,
        departmentId: seed.departmentId,
        roomId: seed.roomId,
      });
      const updated = await users.updateProfile(user_id, { gender: null });
      expect(updated).toMatchObject({ gioi_tinh: null, patients: null });
    });
  });

  describe('TokenBlacklistRepository', () => {
    it('add cùng jti hai lần (đăng xuất đồng thời) không lỗi, chỉ có một bản ghi', async () => {
      const { user_id } = await users.createPatient({
        ...newUser,
        patientRoleId: seed.roles.patient,
      });
      const blacklist = app.get(TokenBlacklistRepository);
      const entry = { jti: 'jti-trung', userId: user_id, expiresAt: new Date(Date.now() + 60_000) };
      await blacklist.add(entry);
      await expect(blacklist.add(entry)).resolves.toBeUndefined();
      expect(await prisma.token_blacklist.count()).toBe(1);
      await expect(blacklist.has('jti-trung')).resolves.toBe(true);
    });
  });
});
