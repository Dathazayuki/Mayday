import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PasswordService } from '../src/auth/password.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ROLE_NAMES, type RoleName } from '../src/roles/role-names.js';

/**
 * Seed dữ liệu dev (idempotent, chạy lại không nhân đôi). Vai trò admin/patient theo ví dụ của bảng roles;
 * cây 7 cấp theo thứ tự liệt kê trong docs/03-co-so-du-lieu.md, quan hệ cha–con tạm thời (MT-63).
 */
const ROLE_SEEDS: Record<RoleName, { description: string; parent: RoleName | null }> = {
  admin: { description: 'Quản trị viên', parent: null },
  patient: { description: 'Bệnh nhân', parent: null },
  director: { description: 'Giám đốc bệnh viện', parent: null },
  chief_of_branch: { description: 'Phó giám đốc / Trưởng chi nhánh', parent: 'director' },
  chief_of_department: {
    description: 'Phó trưởng chi nhánh / Trưởng khoa',
    parent: 'chief_of_branch',
  },
  doctor: { description: 'Bác sĩ', parent: 'chief_of_department' },
  chief_of_nurse: { description: 'Điều dưỡng trưởng', parent: 'doctor' },
  nurse: { description: 'Điều dưỡng', parent: 'chief_of_nurse' },
  technician: { description: 'Kĩ thuật viên', parent: 'nurse' },
};

const BRANCH_NAME = 'Cơ sở chính (dữ liệu dev)';
const DEPARTMENT_NAME = 'Khoa Da liễu (dữ liệu dev)';
const ROOM_NAME = 'Phòng khám 1 (dữ liệu dev)';
const ADMIN_FULL_NAME = 'QUẢN TRỊ VIÊN';

export interface SeedOptions {
  adminPhone?: string;
  adminPassword?: string;
}

export interface SeedResult {
  roles: Record<RoleName, number>;
  branchId: number;
  departmentId: number;
  roomId: number;
}

export async function seedBase(prisma: PrismaClient, opts: SeedOptions = {}): Promise<SeedResult> {
  // ROLE_NAMES liệt kê vai trò cha trước vai trò con.
  const roles = {} as Record<RoleName, number>;
  for (const name of ROLE_NAMES) {
    const { description, parent } = ROLE_SEEDS[name];
    const data = { description, parent_role_id: parent ? roles[parent] : null };
    const role = await prisma.roles.upsert({
      where: { name },
      update: data,
      create: { name, ...data },
    });
    roles[name] = role.role_id;
  }

  // Bảng cơ sở vật chất không có khoá unique theo tên → tìm theo tên trước khi tạo.
  const branch =
    (await prisma.branches.findFirst({ where: { name: BRANCH_NAME } })) ??
    (await prisma.branches.create({ data: { name: BRANCH_NAME } }));
  const departmentWhere = { name: DEPARTMENT_NAME, branch_id: branch.id };
  const department =
    (await prisma.departments.findFirst({ where: departmentWhere })) ??
    (await prisma.departments.create({ data: departmentWhere }));
  const roomWhere = { name: ROOM_NAME, department_id: department.id };
  const room =
    (await prisma.rooms.findFirst({ where: roomWhere })) ??
    (await prisma.rooms.create({ data: roomWhere }));

  if (opts.adminPhone && opts.adminPassword) {
    const adminData = {
      ho_ten: ADMIN_FULL_NAME,
      password_hash: await new PasswordService().hash(opts.adminPassword),
    };
    const admin = await prisma.users.upsert({
      where: { so_dien_thoai: opts.adminPhone },
      update: adminData,
      create: { so_dien_thoai: opts.adminPhone, ...adminData },
    });
    // Admin không thuộc chi nhánh/khoa/phòng nào.
    await prisma.staffs.upsert({
      where: { user_id: admin.user_id },
      update: { role_id: roles.admin },
      create: { user_id: admin.user_id, role_id: roles.admin },
    });
  }

  return { roles, branchId: branch.id, departmentId: department.id, roomId: room.id };
}

async function main(): Promise<void> {
  config({ path: ['.env', '../../.env'], quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL (xem .env.example ở thư mục gốc).');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });
  try {
    const result = await seedBase(prisma, {
      adminPhone: process.env.SEED_ADMIN_PHONE,
      adminPassword: process.env.SEED_ADMIN_PASSWORD,
    });
    console.log('Seed xong:', result);
  } finally {
    await prisma.$disconnect();
  }
}

/** File này là entry point (pnpm db:seed) hay chỉ được import (test dùng seedBase)? */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  // So sánh đường dẫn tuyệt đối đã chuẩn hoá; Windows không phân biệt hoa/thường (ví dụ ổ c: và C:).
  const normalize = (path: string) =>
    process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  return normalize(entry) === normalize(fileURLToPath(import.meta.url));
}

if (isEntryPoint()) await main();
