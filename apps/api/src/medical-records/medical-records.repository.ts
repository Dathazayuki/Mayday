import { Injectable } from '@nestjs/common';
import type { MedicalRecordStatusCounts, PageResult } from '@drmayday/shared';
import { AppException, conflict } from '../common/app.exception.js';
import type { PageWindow } from '../common/paginated.js';
import { hasChanges } from '../common/require-changes.js';
import { Prisma } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import type { CountRow } from '../prisma/db-values.js';
import { isForeignKeyViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NO_VISITS,
  RECORD_DETAIL_INCLUDE,
  acuteColumns,
  acuteIntervals,
  chronicColumns,
  newRecordToDb,
  recordChangesToDb,
  toMedicalRecord,
  toRecordLock,
  toRecordOverview,
  toStatusCounts,
  type AcuteIntervalRow,
  type AcuteIntervals,
  type MedicalRecord,
  type NewMedicalRecord,
  type RecordChanges,
  type RecordFilter,
  type RecordLock,
  type RecordLockRow,
  type RecordOverview,
  type RecordOverviewRow,
  type StatusCountRow,
  type VisitBoundsRow,
} from './medical-record-mapping.js';

/** Bệnh nhân của hồ sơ (SQL:273–274): bị xoá giữa lúc kiểm tra và lúc ghi → 3007. */
const RECORD_PATIENT_FK = 'fk_hosobenhan_benhnhan';

/** Client của transaction tương tác; PrismaClient cũng dùng được cho câu đọc ngoài transaction. */
type Db = Prisma.TransactionClient;

/** Phiên đầu của hồ sơ `h`: bác sĩ phụ trách (D-B6). Dùng chung cho tổng quan, danh sách, số đếm. */
const FIRST_VISIT_DOCTOR = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT p.ma_bac_si FROM phienkham p
    WHERE p.ma_ho_so = h.ma_ho_so
    ORDER BY p.lan_kham_thu ASC
    LIMIT 1
  ) dau ON TRUE`;

/**
 * SELECT tổng quan của hồ sơ (spec B, mục 3.8, 4.4): hồ sơ ⋈ người bệnh, bác sĩ của phiên đầu, ngày
 * khám/hẹn/dặn dò của phiên cuối, số phiên (hàm cửa sổ đếm trước LIMIT). Sắp ma_ho_so giảm dần (D-B10).
 * `where` và `tail` (LIMIT/OFFSET) ghép bằng Prisma.sql có tham số.
 */
function overviewQuery(where: Prisma.Sql, tail: Prisma.Sql = Prisma.empty): Prisma.Sql {
  return Prisma.sql`
    SELECT h.ma_ho_so, h.ma_benh_nhan, h.loai_benh_an, h.trang_thai, h.thoi_diem_kham_lan_dau,
           n.ho_ten, n.so_dien_thoai,
           dau.ma_bac_si AS ma_bac_si_phu_trach, bs.ho_ten AS ten_bac_si_phu_trach,
           COALESCE(cuoi.so_phien, 0) AS so_phien,
           cuoi.ngay_kham AS ngay_kham_gan_nhat, cuoi.ngay_hen_tai_kham, cuoi.dan_do
    FROM hosobenhan h
    JOIN nguoi n ON n.ma_nguoi = h.ma_benh_nhan
    ${FIRST_VISIT_DOCTOR}
    LEFT JOIN nguoi bs ON bs.ma_nguoi = dau.ma_bac_si
    LEFT JOIN LATERAL (
      SELECT p.ngay_kham, p.ngay_hen_tai_kham, p.dan_do, COUNT(*) OVER () AS so_phien
      FROM phienkham p
      WHERE p.ma_ho_so = h.ma_ho_so
      ORDER BY p.lan_kham_thu DESC
      LIMIT 1
    ) cuoi ON TRUE
    ${where}
    ORDER BY h.ma_ho_so DESC
    ${tail}`;
}

async function readOverviews(
  db: Db,
  where: Prisma.Sql,
  tail?: Prisma.Sql,
): Promise<RecordOverview[]> {
  const rows = await db.$queryRaw<RecordOverviewRow[]>(overviewQuery(where, tail));
  return rows.map(toRecordOverview);
}

/**
 * WHERE của danh sách và số đếm (spec B, mục 4.4, 5.3), ghép bằng Prisma.sql có tham số. Bác sĩ phụ
 * trách so với `dau` (phiên đầu, FIRST_VISIT_DOCTOR) nên câu dùng hàm này phải có join đó.
 */
function filterWhere({ status, patientId, type, doctorId }: RecordFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (status !== undefined) conditions.push(Prisma.sql`h.trang_thai = ${status}`);
  if (patientId !== undefined) conditions.push(Prisma.sql`h.ma_benh_nhan = ${toDbId(patientId)}`);
  if (type !== undefined) conditions.push(Prisma.sql`h.loai_benh_an = ${type}`);
  if (doctorId !== undefined) conditions.push(Prisma.sql`dau.ma_bac_si = ${toDbId(doctorId)}`);
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

/** Ba cột INTERVAL theo giây, làm tròn xuống (spec B, mục 4.4; spike 3e: không cast thì lỗi P2010). */
async function readIntervals(db: Db, id: bigint): Promise<AcuteIntervalRow | null> {
  const [row] = await db.$queryRaw<AcuteIntervalRow[]>`
    SELECT floor(extract(epoch FROM thoi_gian_tiep_xuc_den_khoi_phat))::float8 AS thoi_gian_tiep_xuc_den_khoi_phat,
           floor(extract(epoch FROM thoi_gian_keo_dai_tb))::float8 AS thoi_gian_keo_dai_tb,
           floor(extract(epoch FROM dot_gan_nhat_cach))::float8 AS dot_gan_nhat_cach
    FROM benhanmaydaycap
    WHERE ma_ho_so = ${id}`;
  return row ?? null;
}

/** Hồ sơ đầy đủ: tổng quan (SQL thô), hai subtype (Prisma), INTERVAL (SQL thô, chỉ CAP). */
async function readRecord(db: Db, recordId: number): Promise<MedicalRecord | null> {
  const id = toDbId(recordId);
  const [overview] = await readOverviews(db, Prisma.sql`WHERE h.ma_ho_so = ${id}`);
  if (!overview) return null;
  const row = await db.hosobenhan.findUnique({
    where: { ma_ho_so: id },
    include: RECORD_DETAIL_INCLUDE,
  });
  // DELETE có thể commit giữa hai lần đọc (READ COMMITTED): dòng đã mất = hồ sơ không còn (4001).
  if (!row) return null;
  const intervals = overview.type === 'CAP' ? await readIntervals(db, id) : null;
  return toMedicalRecord(overview, row, intervals);
}

/** Hồ sơ vừa ghi hoặc đang khoá: phải đọc lại được. Export cho chuyển trạng thái (record-transitions.repository.ts). */
export async function readRecordOrThrow(db: Db, recordId: number): Promise<MedicalRecord> {
  const record = await readRecord(db, recordId);
  if (!record) throw new Error(`Hồ sơ ${recordId} vừa ghi hoặc đang khoá mà không đọc lại được`);
  return record;
}

/** `cột = make_interval(…)` hoặc `cột = NULL` cho từng trường INTERVAL được gửi (D-B15). */
function intervalAssignments(intervals: AcuteIntervals): Prisma.Sql[] {
  const value = (seconds: number | null) =>
    seconds === null ? Prisma.sql`NULL` : Prisma.sql`make_interval(secs => ${seconds}::float8)`;
  const assignments: Prisma.Sql[] = [];
  if (intervals.exposure_to_onset_seconds !== undefined) {
    assignments.push(
      Prisma.sql`thoi_gian_tiep_xuc_den_khoi_phat = ${value(intervals.exposure_to_onset_seconds)}`,
    );
  }
  if (intervals.mean_duration_seconds !== undefined) {
    assignments.push(Prisma.sql`thoi_gian_keo_dai_tb = ${value(intervals.mean_duration_seconds)}`);
  }
  if (intervals.last_episode_ago_seconds !== undefined) {
    assignments.push(Prisma.sql`dot_gan_nhat_cach = ${value(intervals.last_episode_ago_seconds)}`);
  }
  return assignments;
}

/**
 * Khoá dòng hosobenhan (D-B2) rồi đọc phiên đầu/cuối và MAX(lan_kham_thu) trong cùng transaction. Khoá
 * giữ tới hết transaction nên mọi thao tác ghi lên cùng một hồ sơ chạy tuần tự. Không có hồ sơ → null.
 * Export để repository phiên khám (B3) và seed lâm sàng dùng lại (spec B, mục 4.1).
 */
export async function lockRecord(db: Db, recordId: number): Promise<RecordLock | null> {
  const id = toDbId(recordId);
  const [row] = await db.$queryRaw<RecordLockRow[]>`
    SELECT ma_ho_so, ma_benh_nhan, loai_benh_an, trang_thai
    FROM hosobenhan
    WHERE ma_ho_so = ${id}
    FOR UPDATE`;
  if (!row) return null;
  const [bounds = NO_VISITS] = await db.$queryRaw<VisitBoundsRow[]>`
    SELECT
      (SELECT p.ma_bac_si FROM phienkham p WHERE p.ma_ho_so = ${id}
        ORDER BY p.lan_kham_thu ASC LIMIT 1) AS ma_bac_si_phu_trach,
      (SELECT p.ma_phien_kham FROM phienkham p WHERE p.ma_ho_so = ${id}
        ORDER BY p.lan_kham_thu DESC LIMIT 1) AS ma_phien_cuoi,
      (SELECT MAX(p.lan_kham_thu) FROM phienkham p WHERE p.ma_ho_so = ${id}) AS lan_kham_lon_nhat`;
  return toRecordLock(row, bounds);
}

/** UPDATE 3 cột INTERVAL bằng SQL thô trong transaction của nơi gọi (D-B15); không có trường nào → bỏ qua. */
export async function writeAcuteIntervals(
  db: Db,
  recordId: number,
  intervals: AcuteIntervals,
): Promise<void> {
  const assignments = intervalAssignments(intervals);
  if (assignments.length === 0) return;
  await db.$executeRaw`
    UPDATE benhanmaydaycap SET ${Prisma.join(assignments, ', ')}
    WHERE ma_ho_so = ${toDbId(recordId)}`;
}

/**
 * Tạo cha rồi đúng một subtype bằng input chỉ có khoá và cột thường, rồi INTERVAL (D-B1, D-B15). FK hoãn
 * kiểm tra chạy lúc COMMIT của transaction nơi gọi. Trả ma_ho_so.
 */
export async function insertMedicalRecord(db: Db, record: NewMedicalRecord): Promise<number> {
  const { ma_ho_so } = await db.hosobenhan.create({
    data: newRecordToDb(record),
    select: { ma_ho_so: true },
  });
  const id = fromDbId(ma_ho_so);
  if (record.type === 'CAP') {
    await db.benhanmaydaycap.create({
      data: { ma_ho_so, ...acuteColumns(record.acute) },
      select: { ma_ho_so: true },
    });
    await writeAcuteIntervals(db, id, acuteIntervals(record.acute));
  } else {
    await db.benhanmaydayman.create({
      data: {
        ma_ho_so,
        ...chronicColumns(record.chronic, record.selfReport.disease_manifestation),
      },
      select: { ma_ho_so: true },
    });
  }
  return id;
}

/** UPDATE đúng các bảng có trường được gửi, và chỉ các cột đó (spec B, mục 4.3). */
async function writeChanges(db: Db, current: MedicalRecord, changes: RecordChanges): Promise<void> {
  const id = toDbId(current.id);
  const parent = recordChangesToDb(changes);
  if (hasChanges(parent)) await db.hosobenhan.update({ where: { ma_ho_so: id }, data: parent });
  if (current.type === 'CAP') {
    const acute = acuteColumns(changes.acute ?? {});
    // benhanmaydaycap có trigger thời gian: chỉ UPDATE khi khối acute có cột thường được gửi.
    if (hasChanges(acute))
      await db.benhanmaydaycap.update({ where: { ma_ho_so: id }, data: acute });
    await writeAcuteIntervals(db, current.id, acuteIntervals(changes.acute ?? {}));
    return;
  }
  const chronic = chronicColumns(changes.chronic ?? {}, changes.selfReport?.disease_manifestation);
  if (hasChanges(chronic))
    await db.benhanmaydayman.update({ where: { ma_ho_so: id }, data: chronic });
}

/** Bảng `hosobenhan`, `benhanmaydaycap`, `benhanmaydayman` và trường suy ra từ `phienkham` (spec B, mục 4.1). */
@Injectable()
export class MedicalRecordsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /medical_records/:id: hồ sơ đầy đủ. */
  findById(recordId: number): Promise<MedicalRecord | null> {
    return readRecord(this.prisma.db, recordId);
  }

  /** GET /medical_records/:id/summary: hồ sơ ở mức tổng quan, không đọc subtype. */
  async findOverview(recordId: number): Promise<RecordOverview | null> {
    const [overview] = await readOverviews(
      this.prisma.db,
      Prisma.sql`WHERE h.ma_ho_so = ${toDbId(recordId)}`,
    );
    return overview ?? null;
  }

  /**
   * GET /medical_records/all (medrec04, D-B24): một trang (ma_ho_so giảm dần, D-B10) và tổng số, đọc
   * trong cùng một transaction.
   */
  async list(
    filter: RecordFilter,
    { skip, take }: PageWindow,
  ): Promise<PageResult<RecordOverview>> {
    const db = this.prisma.db;
    const where = filterWhere(filter);
    const [rows, counts] = await db.$transaction([
      db.$queryRaw<RecordOverviewRow[]>(
        overviewQuery(where, Prisma.sql`LIMIT ${take} OFFSET ${skip}`),
      ),
      db.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS total FROM hosobenhan h ${FIRST_VISIT_DOCTOR} ${where}`,
    ]);
    return { items: rows.map(toRecordOverview), total: Number(counts[0]?.total ?? 0n) };
  }

  /** GET /medical_records/status-counts (MT-120): cùng bộ lọc với danh sách, GROUP BY trang_thai. */
  async countByStatus(filter: Omit<RecordFilter, 'status'>): Promise<MedicalRecordStatusCounts> {
    const rows = await this.prisma.db.$queryRaw<StatusCountRow[]>`
      SELECT h.trang_thai, COUNT(*) AS total
      FROM hosobenhan h ${FIRST_VISIT_DOCTOR} ${filterWhere(filter)}
      GROUP BY h.trang_thai`;
    return toStatusCounts(rows);
  }

  /**
   * GET /medical_records/patients/:id/history (medrec13): hồ sơ của bệnh nhân, ma_ho_so giảm dần.
   * Người không có dòng benhnhan → null (3007 ở service).
   */
  async historyOf(patientId: number): Promise<RecordOverview[] | null> {
    const db = this.prisma.db;
    const patient = await db.benhnhan.findUnique({
      where: { ma_benh_nhan: toDbId(patientId) },
      select: { ma_benh_nhan: true },
    });
    if (!patient) return null;
    return readOverviews(db, filterWhere({ patientId }));
  }

  /**
   * POST /medical_records trong một transaction tương tác: kiểm dòng benhnhan, ghi cha + subtype +
   * INTERVAL, đọc lại. Không có dòng benhnhan → null; bệnh nhân bị xoá giữa chừng → 3007.
   */
  async create(record: NewMedicalRecord): Promise<MedicalRecord | null> {
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const patient = await tx.benhnhan.findUnique({
          where: { ma_benh_nhan: toDbId(record.patientId) },
          select: { ma_benh_nhan: true },
        });
        if (!patient) return null;
        return readRecordOrThrow(tx, await insertMedicalRecord(tx, record));
      });
    } catch (error) {
      if (isForeignKeyViolation(error, RECORD_PATIENT_FK)) throw new AppException('3007');
      throw error;
    }
  }

  /**
   * PATCH /medical_records/:id (D-B2): khoá → đọc → `decide` (luật của service; ném lỗi thì rollback) →
   * ghi cột được gửi → đọc lại, trong một transaction. Không có hồ sơ → null, `decide` không được gọi.
   */
  async update(
    recordId: number,
    decide: (current: MedicalRecord) => RecordChanges,
  ): Promise<MedicalRecord | null> {
    return this.prisma.db.$transaction(async (tx) => {
      if (!(await lockRecord(tx, recordId))) return null;
      const current = await readRecordOrThrow(tx, recordId);
      await writeChanges(tx, current, decide(current));
      return readRecordOrThrow(tx, recordId);
    });
  }

  /**
   * DELETE /medical_records/:id (D-B22): khoá, xoá subtype phiên → phiên → subtype hồ sơ → hồ sơ trong
   * một transaction. Bảng của C còn tham chiếu (FK RESTRICT; FK hoãn thì lúc COMMIT) → rollback, 2003
   * (409). Không có hồ sơ → false.
   */
  async delete(recordId: number): Promise<boolean> {
    const id = toDbId(recordId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        if (!(await lockRecord(tx, recordId))) return false;
        const visits = await tx.phienkham.findMany({
          where: { ma_ho_so: id },
          select: { ma_phien_kham: true },
        });
        const visitIds = visits.map((visit) => visit.ma_phien_kham);
        await tx.phienkhamcap.deleteMany({ where: { ma_phien_kham: { in: visitIds } } });
        await tx.phienkhamman.deleteMany({ where: { ma_phien_kham: { in: visitIds } } });
        await tx.phienkham.deleteMany({ where: { ma_ho_so: id } });
        await tx.benhanmaydaycap.deleteMany({ where: { ma_ho_so: id } });
        await tx.benhanmaydayman.deleteMany({ where: { ma_ho_so: id } });
        await tx.hosobenhan.delete({ where: { ma_ho_so: id } });
        return true;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw conflict();
      throw error;
    }
  }
}
