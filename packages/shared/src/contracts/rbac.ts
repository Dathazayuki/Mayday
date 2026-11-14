/** GET /api/v1/roles phần tử, và data của POST /api/v1/roles. Thêm parent_role_id theo MT-37. */
export interface RoleData {
  id: number;
  name: string;
  description: string | null;
  parent_role_id: number | null;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  parent_role_id?: number | null;
}

/** data của POST /api/v1/permissions (1001). */
export interface PermissionSummary {
  id: number;
  name: string;
  description: string | null;
}

/** GET /api/v1/permissions phần tử, và data của PUT /api/v1/permissions/:id. */
export interface PermissionData extends PermissionSummary {
  created_at: string;
  updated_at: string;
}

export interface CreatePermissionRequest {
  name: string;
  description?: string;
}

/** Ít nhất 1 trường. */
export interface UpdatePermissionRequest {
  name?: string;
  description?: string | null;
}

/** POST /api/v1/role_permissions — trả 1000, data {}. */
export interface SetRolePermissionsRequest {
  role_id: number;
  permissions: number[];
}

/** GET /api/v1/role_permissions/role/:role_id phần tử. role_permission_id luôn null (MT-64). */
export interface RolePermissionData {
  role_permission_id: null;
  permission_id: number;
  name: string;
  description: string | null;
  assigned_at: string;
}
