import { Injectable } from '@nestjs/common';
import type { PageResult } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import type { PageWindow } from '../common/paginated.js';
import { Prisma } from '../generated/prisma/client.js';
import { toDbId } from '../prisma/db-id.js';
import { isRecordNotFound, isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  genderToDb,
  profileUpdateToDb,
  type NewAccount,
  type ProfileWrite,
} from '../users/user-mapping.js';
import { LOGIN_UNIQUE } from '../users/users.repository.js';
import {
  PATIENT_INCLUDE,
  newPatientToDb,
  toPatientRecord,
  toPatientSearchRecord,
  type CountRow,
  type PatientFilter,
  type PatientRecord,
  type PatientSearchRecord,
  type PatientSearchRow,
} from './patient-mapping.js';

/**
 * Điều kiện WHERE của tìm bệnh nhân (D-B17), ghép bằng Prisma.sql có tham số. `strpos` thay cho
 * LIKE/ILIKE vì hai toán tử này coi % và _ là ký tự đại diện (spec A, quyết định 2). Họ tên so bằng
 * upper() nên không phân biệt hoa/thường, vẫn phân biệt dấu (không có extension unaccent).
 */
function searchWhere({ keyword, gender, birthYears }: PatientFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (keyword !== undefined) {
    conditions.push(
      Prisma.sql`(strpos(upper(n.ho_ten), upper(${keyword})) > 0 OR strpos(n.so_dien_thoai, ${keyword}) > 0)`,
    );
  }
  if (gender !== undefined) conditions.push(Prisma.sql`n.gioi_tinh = ${genderToDb(gender)}`);
  if (birthYears !== undefined) {
    conditions.push(
      Prisma.sql`EXTRACT(YEAR FROM n.ngay_sinh)::int BETWEEN ${birthYears.from} AND ${birthYears.to}`,
    );
  }
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

/** Bảng `nguoi`, `benhnhan`, `taikhoan` theo góc nhìn bệnh nhân (spec B, mục 3.1, 4.1). */
@Injectable()
export class PatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * docpat01: bệnh nhân = `benhnhan` ⋈ `nguoi`, `LEFT JOIN taikhoan` (có hay không có tài khoản). Sắp
   * `ma_nguoi` tăng dần như /admin/users; một trang và tổng số đọc trong cùng một transaction.
   */
  async search(
    filter: PatientFilter,
    { skip, take }: PageWindow,
  ): Promise<PageResult<PatientSearchRecord>> {
    const db = this.prisma.db;
    const where = searchWhere(filter);
    const [rows, counts] = await db.$transaction([
      db.$queryRaw<PatientSearchRow[]>`
        SELECT n.ma_nguoi, n.ho_ten, n.so_dien_thoai, n.gioi_tinh, n.ngay_sinh,
               t.ma_tai_khoan IS NOT NULL AS co_tai_khoan
        FROM benhnhan b
        JOIN nguoi n ON n.ma_nguoi = b.ma_benh_nhan
        LEFT JOIN taikhoan t ON t.ma_nguoi = n.ma_nguoi
        ${where}
        ORDER BY n.ma_nguoi ASC
        LIMIT ${take} OFFSET ${skip}`,
      db.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS total
        FROM benhnhan b
        JOIN nguoi n ON n.ma_nguoi = b.ma_benh_nhan
        ${where}`,
    ]);
    return { items: rows.map(toPatientSearchRecord), total: Number(counts[0]?.total ?? 0n) };
  }

  /** Người không có dòng `benhnhan` (nhân viên, admin) → null. */
  async findById(patientId: number): Promise<PatientRecord | null> {
    const row = await this.prisma.db.benhnhan.findUnique({
      where: { ma_benh_nhan: toDbId(patientId) },
      include: PATIENT_INCLUDE,
    });
    return row && toPatientRecord(row);
  }

  /**
   * Một nested create từ `nguoi` (spec A, mục 4.5; D-B16): nguoi + benhnhan + taikhoan. Hai request cùng
   * số chạy đồng thời đều qua được kiểm tra trùng thì request sau vấp uq_tai_khoan_ten_dang_nhap → 3006.
   */
  async create(account: NewAccount, profile: Partial<ProfileWrite>): Promise<PatientRecord> {
    try {
      const person = await this.prisma.db.nguoi.create({
        data: newPatientToDb(account, profile),
        select: { benhnhan: { include: PATIENT_INCLUDE } },
      });
      if (!person.benhnhan) throw new Error('nested create không trả về benhnhan');
      return toPatientRecord(person.benhnhan);
    } catch (error) {
      if (isUniqueViolation(error, LOGIN_UNIQUE)) throw new AppException('3006');
      throw error;
    }
  }

  /**
   * PUT /doctor/patients/:id trong một transaction (luật của PUT /profile, spec A mục 5.3): đọc
   * ngay_sinh (MT-13) rồi ghi nguoi và benhnhan. Không chạm taikhoan nên token không bị ảnh hưởng (D7).
   * Không có dòng benhnhan → null.
   */
  async update(patientId: number, changes: Partial<ProfileWrite>): Promise<PatientRecord | null> {
    const id = toDbId(patientId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const current = await tx.benhnhan.findUnique({
          where: { ma_benh_nhan: id },
          select: { nguoi: { select: { ngay_sinh: true } } },
        });
        if (!current) return null;
        const { person, patient } = profileUpdateToDb(changes, current.nguoi.ngay_sinh);
        await tx.nguoi.update({
          where: { ma_nguoi: id },
          data: patient ? { ...person, benhnhan: { update: patient } } : person,
        });
        const row = await tx.benhnhan.findUniqueOrThrow({
          where: { ma_benh_nhan: id },
          include: PATIENT_INCLUDE,
        });
        return toPatientRecord(row);
      });
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  }
}
