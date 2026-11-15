import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PermissionsRepository } from '../../src/permissions/permissions.repository.js';
import { isUniqueViolation } from '../../src/prisma/prisma-errors.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { NewAccount } from '../../src/users/user-mapping.js';
import { UsersRepository } from '../../src/users/users.repository.js';
import { createTestApp, resetData, type SeedResult } from './helpers.js';

/** Nhánh của repository mà test HTTP không tạo ra được chắc chắn (đồng thời, tên đăng nhập có chữ). */
describe('Repository (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let users: UsersRepository;

  const account = (phone: string): NewAccount => ({
    fullName: ' lê thị c ',
    phone,
    passwordHash: 'hash',
    gender: 'female',
    roleId: seed.roles.benh_nhan,
  });
  /** Tài khoản chèn thẳng với tên đăng nhập có chữ (vd. do nhóm khác tạo, MT-111). */
  const insertAccount = (login: string) =>
    prisma.nguoi.create({
      data: {
        ho_ten: 'NGƯỜI NHÓM KHÁC',
        so_dien_thoai: '0900000077',
        taikhoan: {
          create: {
            ten_dang_nhap: login,
            mat_khau_ma_hoa: 'hash',
            ma_vai_tro: BigInt(seed.roles.bac_si),
          },
        },
      },
    });

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

  describe('UsersRepository: tra tên đăng nhập (spec A, mục 4.4)', () => {
    it('không phân biệt hoa/thường', async () => {
      await insertAccount('BacSiAn');
      await expect(users.findByLogin('bacsian')).resolves.toMatchObject({
        fullName: 'NGƯỜI NHÓM KHÁC',
      });
      await expect(users.loginExists('BACSIAN')).resolves.toBe(true);
    });

    it('% và _ không phải ký tự đại diện (chặn lỗi ILIKE)', async () => {
      await insertAccount('BacSiAn');
      await expect(users.findByLogin('%')).resolves.toBeNull();
      await expect(users.findByLogin('BacSi_n')).resolves.toBeNull();
      await expect(users.loginExists('%')).resolves.toBe(false);
    });

    it('hai tên chỉ khác hoa/thường → P2002 trên uq_tai_khoan_ten_dang_nhap', async () => {
      await insertAccount('BacSiAn');
      const error = await insertAccount('bacsian').catch((caught: unknown) => caught);
      expect(isUniqueViolation(error, 'uq_tai_khoan_ten_dang_nhap')).toBe(true);
    });
  });

  describe('UsersRepository.create', () => {
    it('số đã thuộc tài khoản (lọt qua loginExists khi chạy đồng thời) → AppException 3006, không ghi nguoi thừa', async () => {
      await users.create(account('0933333333'), { kind: 'patient' });
      await expect(users.create(account('0933333333'), { kind: 'patient' })).rejects.toMatchObject({
        code: '3006',
      });
      expect(await prisma.nguoi.count()).toBe(1);
    });

    it('vai trò hoặc chi nhánh không tồn tại lúc ghi → 2003 kèm field', async () => {
      await expect(
        users.create({ ...account('0944444444'), roleId: 999 }, { kind: 'none' }),
      ).rejects.toMatchObject({
        code: '2003',
        data: { field: 'role_id' },
      });
      await expect(
        users.create(
          { ...account('0944444444'), roleId: seed.roles.bac_si },
          { kind: 'staff', branchId: 999 },
        ),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'branch_id' } });
      expect(await prisma.nguoi.count()).toBe(0);
    });
  });

  describe('PermissionsRepository.grant', () => {
    it('gán trùng đồng thời → bỏ qua, giữ thoi_diem_gan và ma_nguoi_gan cũ (ON CONFLICT DO NOTHING)', async () => {
      const permissions = app.get(PermissionsRepository);
      const assigner = await users.create(account('0955555555'), { kind: 'patient' });
      const ids = [seed.permissions.manage_users, seed.permissions.manage_roles];
      await Promise.all([
        permissions.grant(seed.roles.bac_si, ids, assigner.userId),
        permissions.grant(seed.roles.bac_si, ids, assigner.userId),
      ]);
      // bac_si còn có quyền mặc định dev/test (D-B19, ma_nguoi_gan NULL): chỉ xét hai quyền vừa gán.
      const rows = await prisma.vaitroquyenhan.findMany({
        where: {
          ma_vai_tro: BigInt(seed.roles.bac_si),
          ma_quyen_han: { in: ids.map((id) => BigInt(id)) },
        },
      });
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.ma_nguoi_gan === BigInt(assigner.userId))).toBe(true);
    });

    it('vai trò hoặc quyền không tồn tại lúc ghi → 2003 kèm field (không còn bỏ qua như F.11)', async () => {
      const permissions = app.get(PermissionsRepository);
      const assigner = await users.create(account('0955555555'), { kind: 'patient' });
      await expect(
        permissions.grant(999_999, [seed.permissions.manage_users], assigner.userId),
      ).rejects.toMatchObject({
        data: { field: 'role_id' },
      });
      await expect(
        permissions.grant(seed.roles.bac_si, [999_999], assigner.userId),
      ).rejects.toMatchObject({
        data: { field: 'permissions' },
      });
    });
  });
});
