import { RequestMethod } from '@nestjs/common';
import { isEntryPoint, runDbScript } from '../scripts/db-script.js';
import {
  linkPermissionRoutes,
  syncApiEndpoints,
  syncDeclaredPermissions,
} from '../scripts/sync-endpoints.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { routeKey, type RouteKey } from '../src/permissions/route-key.js';
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
  /**
   * Route gắn với quyền; route chưa có trong `api_endpoints` thì bỏ qua. Route khai báo quyền bằng
   * @RequirePermission do syncDeclaredPermissions gắn, không liệt kê ở đây.
   */
  routes: RouteKey[];
  /**
   * Vai trò được cấp khi quyền vừa được tạo. Admin luôn qua PermissionsGuard nên `manage_*` chỉ
   * cấp cho admin.
   */
  grantedTo: readonly RoleName[];
}

const { GET, POST, PUT, DELETE } = RequestMethod;
const FACILITY_RESOURCES = ['branches', 'departments', 'rooms'];

/**
 * Quyền mặc định (spec giai đoạn 2, mục 4), giữ hành vi mặc định khớp Sheet: API quản trị chỉ cho
 * admin. `view_facilities` được seed và cấp cho mọi vai trò nhưng KHÔNG gắn với route GET cơ sở vật
 * chất: theo spec mục 3.2 mọi người đã đăng nhập đều xem được, vai trò tạo sau không được bị 3101.
 * Route chưa có trong `api_endpoints` thì bỏ qua (schema.db-spec kiểm mọi route khai báo ở đây đều có
 * thật); chạy lại seed sau khi thêm route thì tự gắn.
 */
const PERMISSION_SEEDS: Record<PermissionName, PermissionSeed> = {
  manage_users: {
    description: 'Quản lý người dùng',
    routes: [
      routeKey(GET, 'admin/users', '/'),
      routeKey(GET, 'admin/users', ':id'),
      routeKey(POST, 'admin/users', '/'),
      routeKey(PUT, 'admin/users', ':id'),
      routeKey(DELETE, 'admin/users', ':id'),
      routeKey(PUT, 'admin/users', ':id/assign'),
      routeKey(POST, 'auth', 'admin/create-staff'),
    ],
    grantedTo: [ADMIN_ROLE],
  },
  manage_roles: {
    description: 'Quản lý vai trò',
    routes: [routeKey(POST, 'roles', '/'), routeKey(GET, 'roles', '/')],
    grantedTo: [ADMIN_ROLE],
  },
  manage_permissions: {
    description: 'Quản lý quyền và gán quyền cho vai trò',
    routes: [
      routeKey(POST, 'permissions', '/'),
      routeKey(GET, 'permissions', '/'),
      routeKey(PUT, 'permissions', ':id'),
      routeKey(DELETE, 'permissions', ':id'),
      routeKey(POST, 'role_permissions', '/'),
      routeKey(GET, 'role_permissions', 'role/:role_id'),
      routeKey(DELETE, 'role_permissions', ':role_id/:permission_id'),
    ],
    grantedTo: [ADMIN_ROLE],
  },
  manage_facilities: {
    description: 'Quản lý chi nhánh, khoa, phòng',
    routes: FACILITY_RESOURCES.flatMap((resource) => [
      routeKey(POST, resource, '/'),
      routeKey(PUT, resource, ':id'),
      routeKey(DELETE, resource, ':id'),
    ]),
    grantedTo: [ADMIN_ROLE],
  },
  view_facilities: {
    description: 'Xem chi nhánh, khoa, phòng',
    routes: [],
    grantedTo: ROLE_NAMES,
  },
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
  permissions: Record<PermissionName, number>;
  branchId: number;
  departmentId: number;
  roomId: number;
}

/**
 * Gọi sau syncApiEndpoints: quyền chỉ được gắn với endpoint đã có trong `api_endpoints`. Có yêu cầu
 * seed admin thì kiểm tra trước khi ghi bất cứ gì (xem checkAdminSeed): bị từ chối thì CSDL không đổi.
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
 * Quyền mặc định và gắn quyền với endpoint đang có. Không ghi đè quyết định của admin: quyền đã có
 * thì giữ nguyên mô tả, và chỉ cấp cho vai trò mặc định khi quyền vừa được tạo (admin thu hồi rồi
 * seed lại thì không cấp lại). Gắn endpoint không có API nên seed lại luôn bổ sung route mới.
 */
async function seedPermissions(
  prisma: PrismaClient,
  roles: Record<RoleName, number>,
): Promise<Record<PermissionName, number>> {
  const permissions = {} as Record<PermissionName, number>;
  for (const name of PERMISSION_NAMES) {
    const { description, routes, grantedTo } = PERMISSION_SEEDS[name];
    const existing = await prisma.permissions.findUnique({ where: { name } });
    const { permission_id } =
      existing ?? (await prisma.permissions.create({ data: { name, description } }));
    permissions[name] = permission_id;

    if (!existing) {
      await prisma.role_permissions.createMany({
        data: grantedTo.map((role) => ({ role_id: roles[role], permission_id })),
      });
    }
    await linkPermissionRoutes(prisma, permission_id, routes);
  }
  return permissions;
}

if (isEntryPoint(import.meta.url)) {
  await runDbScript(async (prisma, app) => {
    // Route trước để seed gắn được quyền với route. Quyền khai báo bằng @RequirePermission đồng bộ sau
    // seed: quyền mặc định (mô tả, vai trò được cấp) do seed tạo, đồng bộ chỉ gắn thêm route.
    const endpoints = await syncApiEndpoints(app, prisma);
    const result = await seedBase(prisma, {
      adminPhone: process.env.SEED_ADMIN_PHONE,
      adminPassword: process.env.SEED_ADMIN_PASSWORD,
    });
    await syncDeclaredPermissions(app, prisma);
    console.log('Seed xong:', { ...result, endpoints });
  });
}
