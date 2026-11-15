import { Injectable } from '@nestjs/common';
import type { PageResult, UpdateUserRequest } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import type { PageWindow } from '../common/paginated.js';
import type { Placement } from '../facilities/placement.js';
import type { Prisma } from '../generated/prisma/client.js';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  newUserToDb,
  profileUpdateToDb,
  userUpdateToDb,
  type NewPatient,
  type NewStaff,
  type ProfileWrite,
  type UserFilter,
  type UserRecord,
} from './user-mapping.js';

const WITH_SUBTYPES = { staffs: true, patients: true } satisfies Prisma.usersInclude;

/** Tên index mặc định của Prisma cho `users.so_dien_thoai @unique` (kiểm lại khi có schema thật, MT-57). */
const PHONE_UNIQUE_INDEX = 'users_so_dien_thoai_key';

/** role_id nằm ở bảng subtype `staffs` hoặc `patients` (MT-62). */
function whereOf({ roleId }: UserFilter): Prisma.usersWhereInput {
  if (roleId === undefined) return {};
  return { OR: [{ staffs: { role_id: roleId } }, { patients: { role_id: roleId } }] };
}

/** Bảng `users`, hai bảng subtype `staffs`/`patients` và `user_fcm_tokens` của người dùng. */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string): Promise<UserRecord | null> {
    return this.prisma.db.users.findUnique({
      where: { so_dien_thoai: phone },
      include: WITH_SUBTYPES,
    });
  }

  findById(userId: number): Promise<UserRecord | null> {
    return this.prisma.db.users.findUnique({ where: { user_id: userId }, include: WITH_SUBTYPES });
  }

  /**
   * Người dùng của token cho JwtAuthGuard. Chưa cấu hình CSDL thì không tra được (như
   * TokenBlacklistRepository.has) → undefined; người dùng không còn → null.
   */
  async findSessionUser(userId: number): Promise<UserRecord | null | undefined> {
    if (!this.prisma.configured) return undefined;
    return this.findById(userId);
  }

  /**
   * Một trang người dùng theo `filter` (user_id tăng dần) và tổng số người dùng khớp `filter`, đọc
   * trong cùng một transaction để `total` khớp với trang.
   */
  async listPage(filter: UserFilter, { skip, take }: PageWindow): Promise<PageResult<UserRecord>> {
    const db = this.prisma.db;
    const where = whereOf(filter);
    const [items, total] = await db.$transaction([
      db.users.findMany({ where, include: WITH_SUBTYPES, orderBy: { user_id: 'asc' }, skip, take }),
      db.users.count({ where }),
    ]);
    return { items, total };
  }

  async phoneExists(phone: string): Promise<boolean> {
    const user = await this.prisma.db.users.findUnique({
      where: { so_dien_thoai: phone },
      select: { user_id: true },
    });
    return user !== null;
  }

  createPatient({ patientRoleId, ...user }: NewPatient): Promise<UserRecord> {
    return this.createUser({
      ...newUserToDb(user),
      patients: { create: { role_id: patientRoleId } },
    });
  }

  createStaff({ roleId, branchId, departmentId, roomId, ...user }: NewStaff): Promise<UserRecord> {
    return this.createUser({
      ...newUserToDb(user),
      staffs: {
        create: {
          role_id: roleId,
          branch_id: branchId,
          department_id: departmentId,
          room_id: roomId,
        },
      },
    });
  }

  async updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
    await this.prisma.db.users.update({
      where: { user_id: userId },
      data: { password_hash: passwordHash },
    });
  }

  async setResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.db.users.update({
      where: { user_id: userId },
      data: { reset_token: tokenHash, reset_token_expires: expiresAt },
    });
  }

  /** Đọc ngày sinh đang lưu (quy tắc năm sinh, MT-13) rồi ghi users + patients trong một transaction. */
  updateProfile(userId: number, changes: Partial<ProfileWrite>): Promise<UserRecord> {
    return this.prisma.db.$transaction(async (tx) => {
      const current = await tx.patients.findUnique({
        where: { user_id: userId },
        select: { ngay_sinh: true },
      });
      const { user, patient } = profileUpdateToDb(changes, current?.ngay_sinh ?? null);
      return tx.users.update({
        where: { user_id: userId },
        data: { ...user, patients: patient && { update: patient } },
        include: WITH_SUBTYPES,
      });
    });
  }

  /** `current`: bản ghi đang có, cho biết role_id nằm ở bảng subtype nào. Trả bản ghi sau khi ghi. */
  update(current: UserRecord, changes: UpdateUserRequest): Promise<UserRecord> {
    return this.prisma.db.users.update({
      where: { user_id: current.user_id },
      data: userUpdateToDb(changes, current),
      include: WITH_SUBTYPES,
    });
  }

  /** Ghi nơi công tác vào bản ghi `staffs` của nhân viên. */
  async assign(userId: number, { branchId, departmentId, roomId }: Placement): Promise<void> {
    await this.prisma.db.staffs.update({
      where: { user_id: userId },
      data: { branch_id: branchId, department_id: departmentId, room_id: roomId },
    });
  }

  /**
   * Xoá người dùng trong một transaction: `user_fcm_tokens` là RESTRICT nên xoá trước (MT-66);
   * staffs/patients/token_blacklist tự CASCADE. Trả false khi không có người dùng này.
   */
  async delete(userId: number): Promise<boolean> {
    const db = this.prisma.db;
    const [, users] = await db.$transaction([
      db.user_fcm_tokens.deleteMany({ where: { user_id: userId } }),
      db.users.deleteMany({ where: { user_id: userId } }),
    ]);
    return users.count > 0;
  }

  /** Đăng xuất xoá mọi FCM token của người dùng: request không cho biết thiết bị nào (MT-60). */
  async deleteFcmTokens(userId: number): Promise<void> {
    await this.prisma.db.user_fcm_tokens.deleteMany({ where: { user_id: userId } });
  }

  /**
   * Nested create: users và bản ghi subtype được ghi trong cùng một transaction. Hai request
   * cùng số điện thoại đều qua được phoneExists thì request sau vấp khoá unique → 3006.
   */
  private async createUser(data: Prisma.usersCreateInput): Promise<UserRecord> {
    try {
      return await this.prisma.db.users.create({ data, include: WITH_SUBTYPES });
    } catch (error) {
      if (isUniqueViolation(error, PHONE_UNIQUE_INDEX)) throw new AppException('3006');
      throw error;
    }
  }
}
