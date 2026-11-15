import { Injectable } from '@nestjs/common';
import type { MedicalRecordStatus } from '@drmayday/shared';
import { toDbId } from '../prisma/db-id.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MedicalRecord, RecordLock } from './medical-record-mapping.js';
import { lockRecord, readRecordOrThrow } from './medical-records.repository.js';
import { startVisit, type VisitStart } from './visit-mapping.js';
import {
  assertRoomExists,
  insertVisit,
  withVisitWriteErrors,
  writeVisitChanges,
} from './visits.repository.js';

/** Một lần chuyển trạng thái (spec B, mục 6.2), do service quyết định sau khi khoá (D-B2). */
export interface StatusChange {
  status: MedicalRecordStatus;
  /** Tiếp nhận: ghi thoi_diem_kham_lan_dau khi cột đang NULL (hồ sơ tự khai, D-B9); đã có thì giữ. */
  firstVisitAtIfEmpty?: Date;
  /** Tiếp nhận: mở phiên mới, lan_kham_thu = MAX + 1 (D-B5). */
  newVisit?: VisitStart;
  /** Hoàn tất, huỷ bằng PUT: dan_do của phiên mới nhất (D-B8); vắng = giữ, null = xoá. */
  instructions?: string | null;
}

/** Hồ sơ đọc lại sau khi ghi, và mã phiên vừa mở (chỉ tiếp nhận; còn lại null). */
export interface TransitionResult {
  record: MedicalRecord;
  visitId: number | null;
}

/**
 * Ghi chuyển trạng thái hồ sơ (spec B, mục 6.2). Tách khỏi MedicalRecordsRepository vì cần cả khoá hồ sơ
 * (`lockRecord`) lẫn hàm ghi phiên (`insertVisit`), mà repository phiên đã dùng `lockRecord`: để chung một
 * file sẽ thành vòng import.
 */
@Injectable()
export class RecordTransitionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tiếp nhận, hoàn tất, huỷ trong một transaction: khoá (D-B2) → `decide` (luật của service; ném lỗi thì
   * rollback) → phòng của phiên mới (2003) → UPDATE trang_thai (và thoi_diem_kham_lan_dau đang NULL) → dặn
   * dò của phiên mới nhất → INSERT phiên + subtype → đọc lại. Không có hồ sơ → null, `decide` không được gọi.
   */
  transition(
    recordId: number,
    decide: (lock: RecordLock) => StatusChange,
  ): Promise<TransitionResult | null> {
    return withVisitWriteErrors(() =>
      this.prisma.db.$transaction(async (tx) => {
        const lock = await lockRecord(tx, recordId);
        if (!lock) return null;
        const change = decide(lock);
        if (change.newVisit) await assertRoomExists(tx, change.newVisit.roomId);
        const id = toDbId(recordId);
        await tx.hosobenhan.update({
          where: { ma_ho_so: id },
          data: { trang_thai: change.status },
          select: { ma_ho_so: true },
        });
        if (change.firstVisitAtIfEmpty) {
          await tx.hosobenhan.updateMany({
            where: { ma_ho_so: id, thoi_diem_kham_lan_dau: null },
            data: { thoi_diem_kham_lan_dau: change.firstVisitAtIfEmpty },
          });
        }
        if (change.instructions !== undefined) {
          // Service chỉ gửi dặn dò khi hồ sơ đang khám (có bác sĩ phụ trách, tức có phiên): thiếu là lỗi lập trình.
          if (lock.latestVisitId === null) {
            throw new Error(`Hồ sơ ${recordId} chưa có phiên để ghi dặn dò`);
          }
          await writeVisitChanges(
            tx,
            { id: lock.latestVisitId, type: lock.type },
            { instructions: change.instructions },
          );
        }
        const visitId = change.newVisit
          ? await insertVisit(tx, startVisit(lock, change.newVisit))
          : null;
        return { record: await readRecordOrThrow(tx, recordId), visitId };
      }),
    );
  }
}
