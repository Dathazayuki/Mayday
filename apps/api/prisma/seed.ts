import { isEntryPoint, runDbScript } from '../scripts/db-script.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import {
  APP_PERMISSION_NAMES,
  APP_PERMISSIONS,
  type AppPermissionName,
} from '../src/permissions/app-permissions.js';
import { ADMIN_ROLE, ROLE_NAMES, type RoleName } from '../src/roles/role-names.js';

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
  /** Có cả số điện thoại và mật khẩu thì seed tài khoản admin dev (chỉ tạo khi số chưa có). */
  adminPhone?: string;
  adminPassword?: string;
  /**
   * APP_ENV của lần chạy, mặc định process.env.APP_ENV. Chỉ seed admin khi là development hoặc
   * test; production hoặc chưa đặt (coi như production, giống otp-sender) thì từ chối.
   */
  appEnv?: string;
}

export interface SeedResult {
  roles: Record<RoleName, number>;
  permissions: Record<AppPermissionName, number>;
  branchId: number;
  departmentId: number;
  roomId: number;
}

/**
 * Có yêu cầu seed admin thì kiểm tra trước khi ghi bất cứ gì (xem checkAdminSeed): bị từ chối thì
 * CSDL không đổi.
 */
export async function seedBase(prisma: PrismaClient, opts: SeedOptions = {}): Promise<SeedResult> {
  const adminSeed =
    opts.adminPhone && opts.adminPassword
      ? {
          phone: opts.adminPhone,
          password: opts.adminPassword,
          existing: await checkAdminSeed(
            prisma,
            opts.adminPhone,
            opts.appEnv ?? process.env.APP_ENV,
          ),
        }
      : null;

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

  const permissions = await seedPermissions(prisma);

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

  if (adminSeed) {
    // Chỉ tạo khi số chưa có: không ghi đè mật khẩu, họ tên của admin đã đổi sau lần seed trước.
    const admin =
      adminSeed.existing ??
      (await prisma.users.create({
        data: {
          so_dien_thoai: adminSeed.phone,
          ho_ten: ADMIN_FULL_NAME,
          password_hash: await new PasswordService().hash(adminSeed.password),
        },
        select: { user_id: true },
      }));
    // Admin không thuộc chi nhánh/khoa/phòng nào. Đã có dòng staffs (checkAdminSeed bảo đảm là admin)
    // thì giữ nguyên.
    await prisma.staffs.upsert({
      where: { user_id: admin.user_id },
      update: {},
      create: { user_id: admin.user_id, role_id: roles.admin },
    });
  }

  return { roles, permissions, branchId: branch.id, departmentId: department.id, roomId: room.id };
}

/**
 * Điều kiện seed admin, kiểm tra trước khi ghi: APP_ENV phải là development/test (mật khẩu seed là
 * mật khẩu dev, không tạo trên CSDL production); số điện thoại chưa có, hoặc đã là admin (seed lại).
 * Số thuộc bệnh nhân hay nhân viên vai trò khác thì từ chối thay vì biến tài khoản đó thành admin.
 * Trả user đã có (để seed lại không tạo trùng) hoặc null.
 */
async function checkAdminSeed(
  prisma: PrismaClient,
  phone: string,
  appEnv: string | undefined,
): Promise<{ user_id: number } | null> {
  if (appEnv !== 'development' && appEnv !== 'test') {
    throw new Error(
      `Không seed tài khoản admin khi APP_ENV=${appEnv || '(chưa đặt)'}: SEED_ADMIN_PHONE/SEED_ADMIN_PASSWORD ` +
        'chỉ dùng cho CSDL dev/test. Bỏ hai biến này khỏi môi trường production rồi chạy lại.',
    );
  }
  const user = await prisma.users.findUnique({
    where: { so_dien_thoai: phone },
    select: {
      user_id: true,
      patients: { select: { user_id: true } },
      staffs: { select: { role: { select: { name: true } } } },
    },
  });
  if (!user) return null;
  if (user.patients) {
    throw new Error(
      `SEED_ADMIN_PHONE=${phone} đã là tài khoản bệnh nhân (user_id ${user.user_id}): không seed admin ` +
        'trên tài khoản này. Đổi SEED_ADMIN_PHONE sang số khác rồi chạy lại.',
    );
  }
  if (user.staffs && user.staffs.role.name !== ADMIN_ROLE) {
    throw new Error(
      `SEED_ADMIN_PHONE=${phone} đã là nhân viên vai trò ${user.staffs.role.name} (user_id ${user.user_id}): ` +
        'seed không đổi vai trò của tài khoản có sẵn. Đổi SEED_ADMIN_PHONE sang số khác rồi chạy lại.',
    );
  }
  return { user_id: user.user_id };
}

/**
 * Dòng quyền của APP_PERMISSIONS (dữ liệu tham chiếu, spec A mục 3.6): tạo khi chưa có tên đó, không
 * ghi đè mô tả đã sửa. Không cấp quyền cho vai trò nào (D12): admin luôn qua PermissionsGuard.
 */
async function seedPermissions(prisma: PrismaClient): Promise<Record<AppPermissionName, number>> {
  const permissions = {} as Record<AppPermissionName, number>;
  for (const name of APP_PERMISSION_NAMES) {
    const { permission_id } =
      (await prisma.permissions.findUnique({ where: { name } })) ??
      (await prisma.permissions.create({
        data: { name, description: APP_PERMISSIONS[name].description },
      }));
    permissions[name] = permission_id;
  }
  return permissions;
}

if (isEntryPoint(import.meta.url)) {
  await runDbScript(async (prisma) => {
    const result = await seedBase(prisma, {
      adminPhone: process.env.SEED_ADMIN_PHONE,
      adminPassword: process.env.SEED_ADMIN_PASSWORD,
    });
    console.log('Seed xong:', result);
  });
}
