import { Injectable } from '@nestjs/common';
import { AppException, conflict, invalidReference } from '../common/app.exception.js';
import { hasChanges } from '../common/require-changes.js';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import { isForeignKeyViolation, isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RecordLock } from './medical-record-mapping.js';
import { lockRecord } from './medical-records.repository.js';
import {
  VISIT_INCLUDE,
  acuteVisitColumns,
  chronicVisitColumns,
  newVisitToDb,
  startVisit,
  toVisitRecord,
  visitChangesToDb,
  type NewVisit,
  type RecordVisits,
  type VisitChanges,
  type VisitRecord,
  type VisitStart,
} from './visit-mapping.js';

/** Bác sĩ của phiên (SQL:420–421): dòng nhanvien bị xoá giữa lúc dựng Caller và lúc ghi → 3101 (MT-106). */
const VISIT_DOCTOR_FK = 'fk_phienkham_bacsi';
/** Phòng của phiên (SQL:1518–1519): phòng bị xoá giữa lúc kiểm và lúc ghi → 2003 `room_id`. */
const VISIT_ROOM_FK = 'fk_phienkham_phong';
/** UNIQUE (ma_ho_so, lan_kham_thu) (SQL:417): chỉ trùng khi có nơi ghi không qua khoá D-B2 → 2003 (409). */
const VISIT_NUMBER_UNIQUE = 'uq_phienkham_lan_kham';

/** Client của transaction tương tác; PrismaClient cũng dùng được cho câu đọc ngoài transaction. */
type Db = Prisma.TransactionClient;

/** Một phiên đầy đủ: tên bác sĩ, tên phòng, subtype. Không có → null. */
async function readVisit(db: Db, visitId: number): Promise<VisitRecord | null> {
  const row = await db.phienkham.findUnique({
    where: { ma_phien_kham: toDbId(visitId) },
    include: VISIT_INCLUDE,
  });
  return row && toVisitRecord(row);
}

async function readVisitOrThrow(db: Db, visitId: number): Promise<VisitRecord> {
  const visit = await readVisit(db, visitId);
  if (!visit) throw new Error(`Phiên ${visitId} vừa ghi mà không đọc lại được`);
  return visit;
}

/**
 * INSERT phienkham rồi đúng một subtype bằng input chỉ có khoá và cột thường (D-B1); FK hoãn kiểm tra "bắt
 * buộc có subtype" chạy lúc COMMIT của transaction nơi gọi. Trả ma_phien_kham. Export cho tiếp nhận
 * (record-transitions.repository.ts) và seed lâm sàng (spec B, mục 4.1).
 */
export async function insertVisit(db: Db, visit: NewVisit): Promise<number> {
  const { ma_phien_kham } = await db.phienkham.create({
    data: newVisitToDb(visit),
    select: { ma_phien_kham: true },
  });
  if (visit.type === 'CAP') {
    await db.phienkhamcap.create({
      data: { ma_phien_kham, ...acuteVisitColumns(visit.acute) },
      select: { ma_phien_kham: true },
    });
  } else {
    await db.phienkhamman.create({
      data: { ma_phien_kham, ...chronicVisitColumns(visit.chronic) },
      select: { ma_phien_kham: true },
    });
  }
  return fromDbId(ma_phien_kham);
}

/**
 * UPDATE đúng các bảng có trường được gửi, và chỉ các cột đó (spec B, mục 4.3); phienkham và subtype phiên
 * không có trigger thời gian. Export cho hoàn tất/huỷ: dặn dò của phiên mới nhất (D-B8).
 */
export async function writeVisitChanges(
  db: Db,
  visit: Pick<VisitRecord, 'id' | 'type'>,
  changes: VisitChanges,
): Promise<void> {
  const id = toDbId(visit.id);
  const parent = visitChangesToDb(changes);
  if (hasChanges(parent)) {
    await db.phienkham.update({
      where: { ma_phien_kham: id },
      data: parent,
      select: { ma_phien_kham: true },
    });
  }
  if (visit.type === 'CAP') {
    const acute = acuteVisitColumns(changes.acute ?? {});
    if (hasChanges(acute)) {
      await db.phienkhamcap.update({
        where: { ma_phien_kham: id },
        data: acute,
        select: { ma_phien_kham: true },
      });
    }
    return;
  }
  const chronic = chronicVisitColumns(changes.chronic ?? {});
  if (hasChanges(chronic)) {
    await db.phienkhamman.update({
      where: { ma_phien_kham: id },
      data: chronic,
      select: { ma_phien_kham: true },
    });
  }
}

/**
 * `room_id` gửi lên phải trỏ tới một phòng (spec B, mục 5.4, 6.3; MT-115): không có → 2003 `room_id`. Vắng
 * hoặc null (chưa phân phòng) → bỏ qua. Không kiểm phòng thuộc chi nhánh nào (MT-115).
 */
export async function assertRoomExists(db: Db, roomId: number | null | undefined): Promise<void> {
  if (roomId === null || roomId === undefined) return;
  const room = await db.phongkham.findUnique({
    where: { ma_phong_kham: toDbId(roomId) },
    select: { ma_phong_kham: true },
  });
  if (!room) throw invalidReference('room_id');
}

/**
 * Chạy một thao tác ghi phiên (thường là cả transaction) và đổi lỗi CSDL theo spec B, mục 4.5: FK bác sĩ →
 * 3101, FK phòng → 2003 `room_id`, trùng lan_kham_thu → 2003 (409). Lỗi khác (kể cả AppException của
 * `decide`) ném lại nguyên vẹn.
 */
export async function withVisitWriteErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isForeignKeyViolation(error, VISIT_DOCTOR_FK)) throw new AppException('3101');
    if (isForeignKeyViolation(error, VISIT_ROOM_FK)) throw invalidReference('room_id');
    if (isUniqueViolation(error, VISIT_NUMBER_UNIQUE)) throw conflict();
    throw error;
  }
}

/** Bảng `phienkham`, `phienkhamcap`, `phienkhamman` (spec B, mục 4.1); mọi thao tác ghi khoá hồ sơ trước (D-B2). */
@Injectable()
export class VisitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /medical_records/:id/visits: chủ hồ sơ và các phiên, lan_kham_thu tăng dần. Không có hồ sơ → null. */
  async listByRecord(recordId: number): Promise<RecordVisits | null> {
    const db = this.prisma.db;
    const id = toDbId(recordId);
    const record = await db.hosobenhan.findUnique({
      where: { ma_ho_so: id },
      select: { ma_benh_nhan: true },
    });
    if (!record) return null;
    const rows = await db.phienkham.findMany({
      where: { ma_ho_so: id },
      include: VISIT_INCLUDE,
      orderBy: { lan_kham_thu: 'asc' },
    });
    return { patientId: fromDbId(record.ma_benh_nhan), visits: rows.map(toVisitRecord) };
  }

  /**
   * POST /medical_records/:id/visits (D-B2): khoá → `decide` (luật của service; ném lỗi thì rollback) →
   * phòng (2003) → INSERT phiên + subtype với lan_kham_thu = MAX + 1 → đọc lại, trong một transaction. Hai
   * request song song chạy tuần tự nhờ khoá nên nhận số khác nhau. Không có hồ sơ → null.
   */
  add(recordId: number, decide: (lock: RecordLock) => VisitStart): Promise<VisitRecord | null> {
    return withVisitWriteErrors(() =>
      this.prisma.db.$transaction(async (tx) => {
        const lock = await lockRecord(tx, recordId);
        if (!lock) return null;
        const start = decide(lock);
        await assertRoomExists(tx, start.roomId);
        return readVisitOrThrow(tx, await insertVisit(tx, startVisit(lock, start)));
      }),
    );
  }

  /**
   * PATCH /visits/:id (D-B2): tìm hồ sơ của phiên → khoá hồ sơ → đọc phiên → `decide` → phòng (2003) →
   * UPDATE cột được gửi → đọc lại, trong một transaction. Không có phiên (hoặc vừa bị xoá cùng hồ sơ) → null.
   */
  update(
    visitId: number,
    decide: (lock: RecordLock, current: VisitRecord) => VisitChanges,
  ): Promise<VisitRecord | null> {
    return withVisitWriteErrors(() =>
      this.prisma.db.$transaction(async (tx) => {
        const owner = await tx.phienkham.findUnique({
          where: { ma_phien_kham: toDbId(visitId) },
          select: { ma_ho_so: true },
        });
        if (!owner) return null;
        const lock = await lockRecord(tx, fromDbId(owner.ma_ho_so));
        if (!lock) return null;
        const current = await readVisit(tx, visitId);
        if (!current) return null;
        const changes = decide(lock, current);
        await assertRoomExists(tx, changes.roomId);
        await writeVisitChanges(tx, current, changes);
        return readVisitOrThrow(tx, visitId);
      }),
    );
  }
}
