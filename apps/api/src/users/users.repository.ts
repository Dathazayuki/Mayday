import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  patients,
  staffs,
  users,
  users_gioi_tinh,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Người dùng kèm bản ghi subtype: nhân viên có `staffs`, bệnh nhân có `patients`. */
export type UserRecord = users & { staffs: staffs | null; patients: patients | null };

/** Dữ liệu tạo users, đã ở dạng ghi vào CSDL (họ tên đã chuẩn hoá, gender đã ánh xạ). */
export interface NewUser {
  fullName: string;
  phone: string;
  passwordHash: string;
  gender: users_gioi_tinh | null;
}

export interface NewPatient extends NewUser {
  patientRoleId: number;
}

export interface NewStaff extends NewUser {
  roleId: number;
  branchId: number;
  departmentId: number;
  roomId: number | null;
}

export interface ProfileUpdate {
  user?: Prisma.usersUpdateInput;
  patient?: Prisma.patientsUpdateInput;
}

const WITH_SUBTYPES = { staffs: true, patients: true } satisfies Prisma.usersInclude;

function userColumns({ fullName, phone, passwordHash, gender }: NewUser) {
  return { ho_ten: fullName, so_dien_thoai: phone, password_hash: passwordHash, gioi_tinh: gender };
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

  async phoneExists(phone: string): Promise<boolean> {
    const user = await this.prisma.db.users.findUnique({
      where: { so_dien_thoai: phone },
      select: { user_id: true },
    });
    return user !== null;
  }

  /** Nested create: users và patients được ghi trong cùng một transaction. */
  createPatient({ patientRoleId, ...user }: NewPatient): Promise<UserRecord> {
    return this.prisma.db.users.create({
      data: { ...userColumns(user), patients: { create: { role_id: patientRoleId } } },
      include: WITH_SUBTYPES,
    });
  }

  /** Nested create: users và staffs được ghi trong cùng một transaction. */
  createStaff({ roleId, branchId, departmentId, roomId, ...user }: NewStaff): Promise<UserRecord> {
    return this.prisma.db.users.create({
      data: {
        ...userColumns(user),
        staffs: {
          create: {
            role_id: roleId,
            branch_id: branchId,
            department_id: departmentId,
            room_id: roomId,
          },
        },
      },
      include: WITH_SUBTYPES,
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

  /** Nested update: users và patients được ghi trong cùng một transaction. */
  updateProfile(userId: number, { user, patient }: ProfileUpdate): Promise<UserRecord> {
    return this.prisma.db.users.update({
      where: { user_id: userId },
      data: { ...user, patients: patient ? { update: patient } : undefined },
      include: WITH_SUBTYPES,
    });
  }

  /** Đăng xuất xoá mọi FCM token của người dùng: request không cho biết thiết bị nào (MT-60). */
  async deleteFcmTokens(userId: number): Promise<void> {
    await this.prisma.db.user_fcm_tokens.deleteMany({ where: { user_id: userId } });
  }
}
