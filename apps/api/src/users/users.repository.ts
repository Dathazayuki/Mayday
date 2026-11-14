import { Injectable } from '@nestjs/common';
import { AppException } from '../common/app.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  newUserToDb,
  profileUpdateToDb,
  type NewPatient,
  type NewStaff,
  type ProfileWrite,
  type UserRecord,
} from './user-mapping.js';

const WITH_SUBTYPES = { staffs: true, patients: true } satisfies Prisma.usersInclude;

/** Tên index mặc định của Prisma cho `users.so_dien_thoai @unique` (kiểm lại khi có schema thật, MT-57). */
const PHONE_UNIQUE_INDEX = 'users_so_dien_thoai_key';

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
