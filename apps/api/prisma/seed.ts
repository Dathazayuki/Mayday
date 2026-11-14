import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Seed dữ liệu dev (idempotent, chạy lại không nhân đôi). Vai trò admin/patient theo ví dụ của bảng roles;
 * cây 7 cấp theo thứ tự liệt kê trong docs/03-co-so-du-lieu.md, quan hệ cha–con tạm thời (MT-63).
 */
const ROLE_SEEDS = [
  { name: 'admin', description: 'Quản trị viên', parent: null },
  { name: 'patient', description: 'Bệnh nhân', parent: null },
  { name: 'director', description: 'Giám đốc bệnh viện', parent: null },
  { name: 'chief_of_branch', description: 'Phó giám đốc / Trưởng chi nhánh', parent: 'director' },
  {
    name: 'chief_of_department',
    description: 'Phó trưởng chi nhánh / Trưởng khoa',
    parent: 'chief_of_branch',
  },
  { name: 'doctor', description: 'Bác sĩ', parent: 'chief_of_department' },
  { name: 'chief_of_nurse', description: 'Điều dưỡng trưởng', parent: 'doctor' },
  { name: 'nurse', description: 'Điều dưỡng', parent: 'chief_of_nurse' },
  { name: 'technician', description: 'Kĩ thuật viên', parent: 'nurse' },
] as const;

export type RoleName = (typeof ROLE_SEEDS)[number]['name'];

const BRANCH_NAME = 'Cơ sở chính (dữ liệu dev)';
const DEPARTMENT_NAME = 'Khoa Da liễu (dữ liệu dev)';
const ROOM_NAME = 'Phòng khám 1 (dữ liệu dev)';
const ADMIN_FULL_NAME = 'QUẢN TRỊ VIÊN';
const BCRYPT_COST = 10;

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
  // Vai trò cha luôn đứng trước vai trò con trong ROLE_SEEDS.
  const roles = {} as Record<RoleName, number>;
  for (const { name, description, parent } of ROLE_SEEDS) {
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
      password_hash: await bcrypt.hash(opts.adminPassword, BCRYPT_COST),
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

// Chỉ chạy khi gọi trực tiếp (pnpm db:seed), không chạy khi test import seedBase.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
