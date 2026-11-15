import { Injectable } from '@nestjs/common';
import type { PageResult, UpdateUserRequest } from '@drmayday/shared';
import { AppException, conflict, invalidReference } from '../common/app.exception.js';
import type { PageWindow } from '../common/paginated.js';
import { hasChanges } from '../common/require-changes.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { toDbId } from '../prisma/db-id.js';
import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
} from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCOUNT_INCLUDE,
  SESSION_SELECT,
  accountChangesToDb,
  newAccountToDb,
  personChangesToDb,
  profileUpdateToDb,
  toSessionAccount,
  toUserRecord,
  type AccountIdRow,
  type AccountSubtype,
  type NewAccount,
  type ProfileWrite,
  type SessionAccount,
  type UserFilter,
  type UserRecord,
} from './user-mapping.js';

/** Unique trên biểu thức lower(ten_dang_nhap) (SQL:1289). Dùng chung với patients.repository.ts. */
export const LOGIN_UNIQUE = 'uq_tai_khoan_ten_dang_nhap';
const ACCOUNT_ROLE_FK = 'fk_tai_khoan_vai_tro';
const STAFF_BRANCH_FK = 'fk_nhan_vien_chi_nhanh';

/**
 * Tài khoản theo tên đăng nhập, không phân biệt hoa/thường, dùng chỉ mục uq_tai_khoan_ten_dang_nhap
 * (spec A, mục 4.4). Không dùng `mode: 'insensitive'`: ILIKE coi % và _ là ký tự đại diện. Seed dùng
 * chung hàm này.
 */
export async function findAccountIdByLogin(
  db: Pick<PrismaClient, '$queryRaw'>,
  login: string,
): Promise<bigint | null> {
  const rows = await db.$queryRaw<AccountIdRow[]>`
    SELECT ma_tai_khoan FROM taikhoan WHERE lower(ten_dang_nhap) = lower(${login})`;
  return rows[0]?.ma_tai_khoan ?? null;
}

/** Bảng `nguoi`, `taikhoan`, `benhnhan`, `nhanvien` (spec A, mục 4.1, 5.1). */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Login, forgot-password: tra theo `taikhoan.ten_dang_nhap`. */
  async findByLogin(login: string): Promise<UserRecord | null> {
    const accountId = await findAccountIdByLogin(this.prisma.db, login);
    if (accountId === null) return null;
    const row = await this.prisma.db.taikhoan.findUnique({
      where: { ma_tai_khoan: accountId },
      include: ACCOUNT_INCLUDE,
    });
    return row && toUserRecord(row);
  }

  /** Số đã có tài khoản chưa (3006). */
  async loginExists(login: string): Promise<boolean> {
    return (await findAccountIdByLogin(this.prisma.db, login)) !== null;
  }

  /** Người không có tài khoản → null (D3). */
  async findById(userId: number): Promise<UserRecord | null> {
    const row = await this.prisma.db.taikhoan.findUnique({
      where: { ma_nguoi: toDbId(userId) },
      include: ACCOUNT_INCLUDE,
    });
    return row && toUserRecord(row);
  }

  /** Tài khoản của token cho JwtAuthGuard; chưa cấu hình CSDL → undefined; không còn → null. */
  async findSessionAccount(userId: number): Promise<SessionAccount | null | undefined> {
    if (!this.prisma.configured) return undefined;
    const row = await this.prisma.db.taikhoan.findUnique({
      where: { ma_nguoi: toDbId(userId) },
      select: SESSION_SELECT,
    });
    return row && toSessionAccount(row);
  }

  /** Một trang người dùng (ma_nguoi tăng dần) và tổng số, đọc trong cùng một transaction. */
  async listPage(
    { roleId }: UserFilter,
    { skip, take }: PageWindow,
  ): Promise<PageResult<UserRecord>> {
    const db = this.prisma.db;
    const where = {
      ma_vai_tro: roleId === undefined ? undefined : toDbId(roleId),
    } satisfies Prisma.taikhoanWhereInput;
    const [rows, total] = await db.$transaction([
      db.taikhoan.findMany({
        where,
        include: ACCOUNT_INCLUDE,
        orderBy: { ma_nguoi: 'asc' },
        skip,
        take,
      }),
      db.taikhoan.count({ where }),
    ]);
    return { items: rows.map(toUserRecord), total };
  }

  /**
   * Một nested create từ `nguoi` (spec A, mục 4.5). Hai request cùng số chạy đồng thời đều qua được
   * loginExists thì request sau vấp uq_tai_khoan_ten_dang_nhap → 3006. Vai trò hoặc chi nhánh bị xoá
   * giữa lúc kiểm tra và lúc ghi → 2003 kèm field.
   */
  async create(account: NewAccount, subtype: AccountSubtype): Promise<UserRecord> {
    try {
      const person = await this.prisma.db.nguoi.create({
        data: newAccountToDb(account, subtype),
        select: { taikhoan: { include: ACCOUNT_INCLUDE } },
      });
      if (!person.taikhoan) throw new Error('nested create không trả về taikhoan');
      return toUserRecord(person.taikhoan);
    } catch (error) {
      if (isUniqueViolation(error, LOGIN_UNIQUE)) throw new AppException('3006');
      if (isForeignKeyViolation(error, ACCOUNT_ROLE_FK)) throw invalidReference('role_id');
      if (isForeignKeyViolation(error, STAFF_BRANCH_FK)) throw invalidReference('branch_id');
      throw error;
    }
  }

  /** Trigger đổi thoi_diem_cap_nhat: mọi token cũ của tài khoản bị từ chối (3001, MT-95). */
  async updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
    await this.prisma.db.taikhoan.update({
      where: { ma_nguoi: toDbId(userId) },
      data: { mat_khau_ma_hoa: passwordHash },
    });
  }

  /**
   * PUT /profile trong một transaction: đọc ngay_sinh (MT-13) rồi ghi nguoi và benhnhan. Không chạm
   * taikhoan nên token không bị ảnh hưởng. Người không còn → null.
   */
  async updateProfile(userId: number, changes: Partial<ProfileWrite>): Promise<UserRecord | null> {
    const id = toDbId(userId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const current = await tx.nguoi.findUniqueOrThrow({
          where: { ma_nguoi: id },
          select: { ngay_sinh: true },
        });
        const { person, patient } = profileUpdateToDb(changes, current.ngay_sinh);
        await tx.nguoi.update({
          where: { ma_nguoi: id },
          data: patient ? { ...person, benhnhan: { update: patient } } : person,
        });
        const row = await tx.taikhoan.findUniqueOrThrow({
          where: { ma_nguoi: id },
          include: ACCOUNT_INCLUDE,
        });
        return toUserRecord(row);
      });
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * PUT /admin/users/:id trong một transaction: nguoi (họ tên, giới tính) và taikhoan (vai trò, trạng
   * thái) — taikhoan chỉ UPDATE khi giá trị thực sự đổi, so với bản ghi đọc trong cùng transaction (D7).
   * Người không còn → null; vai trò bị xoá đồng thời → 2003 (role_id).
   */
  async update(userId: number, changes: UpdateUserRequest): Promise<UserRecord | null> {
    const id = toDbId(userId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const current = await tx.taikhoan.findUnique({
          where: { ma_nguoi: id },
          include: ACCOUNT_INCLUDE,
        });
        if (!current) return null;
        const person = personChangesToDb(changes);
        if (hasChanges(person)) await tx.nguoi.update({ where: { ma_nguoi: id }, data: person });
        const account = accountChangesToDb(changes, toUserRecord(current));
        if (hasChanges(account))
          await tx.taikhoan.update({ where: { ma_nguoi: id }, data: account });
        const row = await tx.taikhoan.findUniqueOrThrow({
          where: { ma_nguoi: id },
          include: ACCOUNT_INCLUDE,
        });
        return toUserRecord(row);
      });
    } catch (error) {
      if (isForeignKeyViolation(error, ACCOUNT_ROLE_FK)) throw invalidReference('role_id');
      throw error;
    }
  }

  /** Phân công = tạo hoặc sửa dòng nhanvien (MT-106); chi nhánh bị xoá đồng thời → 2003 (branch_id). */
  async assign(userId: number, branchId: number): Promise<void> {
    const id = toDbId(userId);
    const branch = toDbId(branchId);
    try {
      await this.prisma.db.nhanvien.upsert({
        where: { ma_nhan_vien: id },
        create: { ma_nhan_vien: id, ma_chi_nhanh: branch },
        update: { ma_chi_nhanh: branch },
      });
    } catch (error) {
      if (isForeignKeyViolation(error, STAFF_BRANCH_FK)) throw invalidReference('branch_id');
      throw error;
    }
  }

  /**
   * Có dòng nhanvien (đã phân công, MT-106): điều kiện tiếp nhận và thêm phiên khám (spec B, mục 6.4).
   * Người không tồn tại → false.
   */
  async hasStaffRow(userId: number): Promise<boolean> {
    const row = await this.prisma.db.nhanvien.findUnique({
      where: { ma_nhan_vien: toDbId(userId) },
      select: { ma_nhan_vien: true },
    });
    return row !== null;
  }

  /**
   * Xoá taikhoan, benhnhan, nhanvien rồi nguoi trong một transaction (D6, MT-107). Còn bản ghi khác
   * tham chiếu (FK RESTRICT: hồ sơ, phiên khám, ma_nguoi_gan…) → rollback, 2003 (409). Không có tài
   * khoản → false.
   */
  async delete(userId: number): Promise<boolean> {
    const id = toDbId(userId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const { count } = await tx.taikhoan.deleteMany({ where: { ma_nguoi: id } });
        if (count === 0) return false;
        await tx.benhnhan.deleteMany({ where: { ma_benh_nhan: id } });
        await tx.nhanvien.deleteMany({ where: { ma_nhan_vien: id } });
        await tx.nguoi.delete({ where: { ma_nguoi: id } });
        return true;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw conflict();
      throw error;
    }
  }
}
