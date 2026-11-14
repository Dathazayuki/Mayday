import { API_PREFIX } from '@drmayday/shared';
import { isEntryPoint, runDbScript } from '../scripts/db-script.js';
import { syncEndpoints } from '../scripts/sync-endpoints.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { RouteKey } from '../src/permissions/route-key.js';
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

const PERMISSION_NAMES = [
  'manage_users',
  'manage_roles',
  'manage_permissions',
  'manage_facilities',
  'view_facilities',
] as const;

export type PermissionName = (typeof PERMISSION_NAMES)[number];

interface PermissionSeed {
  description: string;
  /** Route gắn với quyền; route chưa có trong `api_endpoints` thì bỏ qua. */
  routes: RouteKey[];
  /** Vai trò được cấp quyền. Admin luôn qua PermissionsGuard nên `manage_*` chỉ cấp cho admin. */
  grantedTo: readonly RoleName[];
}

/** Route theo dạng `api_endpoints` (đường dẫn mẫu đầy đủ). */
const route = (method: string, path: string): RouteKey => ({
  method,
  path: `${API_PREFIX}${path}`,
});

const FACILITY_RESOURCES = ['branches', 'departments', 'rooms'];

/**
 * Quyền mặc định (spec giai đoạn 2, mục 4): hành vi mặc định vẫn khớp Sheet (mọi vai trò xem được cơ
 * sở vật chất, API quản trị chỉ cho admin). Route của module chưa có (VD cơ sở vật chất) được bỏ qua,
 * chạy lại seed sau khi module có route thì tự gắn.
 */
const PERMISSION_SEEDS: Record<PermissionName, PermissionSeed> = {
  manage_users: {
    description: 'Quản lý người dùng',
    routes: [
      route('GET', '/admin/users'),
      route('GET', '/admin/users/:id'),
      route('POST', '/admin/users'),
      route('PUT', '/admin/users/:id'),
      route('DELETE', '/admin/users/:id'),
      route('PUT', '/admin/users/:id/assign'),
      route('POST', '/auth/admin/create-staff'),
    ],
    grantedTo: ['admin'],
  },
  manage_roles: {
    description: 'Quản lý vai trò',
    routes: [route('POST', '/roles'), route('GET', '/roles')],
    grantedTo: ['admin'],
  },
  manage_permissions: {
    description: 'Quản lý quyền và gán quyền cho vai trò',
    routes: [
      route('POST', '/permissions'),
      route('GET', '/permissions'),
      route('PUT', '/permissions/:id'),
      route('DELETE', '/permissions/:id'),
      route('POST', '/role_permissions'),
      route('GET', '/role_permissions/role/:role_id'),
      route('DELETE', '/role_permissions/:role_id/:permission_id'),
    ],
    grantedTo: ['admin'],
  },
  manage_facilities: {
    description: 'Quản lý chi nhánh, khoa, phòng',
    routes: FACILITY_RESOURCES.flatMap((resource) => [
      route('POST', `/${resource}`),
      route('PUT', `/${resource}/:id`),
      route('DELETE', `/${resource}/:id`),
    ]),
    grantedTo: ['admin'],
  },
  view_facilities: {
    description: 'Xem chi nhánh, khoa, phòng',
    routes: FACILITY_RESOURCES.flatMap((resource) => [
      route('GET', `/${resource}`),
      route('GET', `/${resource}/:id`),
    ]),
    grantedTo: ROLE_NAMES,
  },
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
  permissions: Record<PermissionName, number>;
  branchId: number;
  departmentId: number;
  roomId: number;
}

/** Gọi sau syncEndpoints: quyền chỉ được gắn với endpoint đã có trong `api_endpoints`. */
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

  const permissions = await seedPermissions(prisma, roles);

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

  return { roles, permissions, branchId: branch.id, departmentId: department.id, roomId: room.id };
}

/** Quyền mặc định, gắn với endpoint đang có và cấp cho vai trò (createMany bỏ qua dòng đã có). */
async function seedPermissions(
  prisma: PrismaClient,
  roles: Record<RoleName, number>,
): Promise<Record<PermissionName, number>> {
  const permissions = {} as Record<PermissionName, number>;
  for (const name of PERMISSION_NAMES) {
    const { description, routes, grantedTo } = PERMISSION_SEEDS[name];
    const { permission_id } = await prisma.permissions.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });
    permissions[name] = permission_id;

    const endpoints = await prisma.api_endpoints.findMany({
      where: { OR: routes },
      select: { api_endpoints_id: true },
    });
    await prisma.permissions_endpoints.createMany({
      data: endpoints.map(({ api_endpoints_id }) => ({
        permission_id,
        endpoint_id: api_endpoints_id,
      })),
      skipDuplicates: true,
    });
    await prisma.role_permissions.createMany({
      data: grantedTo.map((role) => ({ role_id: roles[role], permission_id })),
      skipDuplicates: true,
    });
  }
  return permissions;
}

if (isEntryPoint(import.meta.url)) {
  await runDbScript(async (prisma, app) => {
    const endpoints = await syncEndpoints(app, prisma);
    const result = await seedBase(prisma, {
      adminPhone: process.env.SEED_ADMIN_PHONE,
      adminPassword: process.env.SEED_ADMIN_PASSWORD,
    });
    console.log('Seed xong:', { ...result, endpoints });
  });
}
