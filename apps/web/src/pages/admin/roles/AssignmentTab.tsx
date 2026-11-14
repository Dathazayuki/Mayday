import { Button, Checkbox, Select, Space } from 'antd';
import { useState } from 'react';
import { QueryErrorAlert } from '../../../admin/QueryErrorAlert';
import {
  usePermissions,
  useRolePermissions,
  useRoles,
  useSaveRolePermissions,
} from '../../../admin/rbac-api';
import { useRunAction } from '../../../admin/use-run-action';
import { diffPermissions } from './permission-diff';

export function AssignmentTab() {
  const [roleId, setRoleId] = useState<number | undefined>();
  /** Tập quyền đang chọn; undefined = chưa chỉnh, hiển thị đúng quyền đã gán. */
  const [draft, setDraft] = useState<number[] | undefined>();
  const roles = useRoles();
  const permissions = usePermissions();
  const assignment = useRolePermissions(roleId);
  const save = useSaveRolePermissions();
  const run = useRunAction();

  const assigned = assignment.data?.map((p) => p.permission_id);
  const selected = draft ?? assigned ?? [];
  const { toAdd, toRemove } = diffPermissions(assigned ?? [], selected);
  const canSave = roleId !== undefined && toAdd.length + toRemove.length > 0;

  async function handleSave() {
    if (roleId === undefined) return;
    const ok = await run(() => save.mutateAsync({ roleId, toAdd, toRemove }), 'Đã lưu phân quyền');
    if (ok) setDraft(undefined);
  }

  return (
    <>
      <QueryErrorAlert error={roles.error ?? permissions.error ?? assignment.error} />
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Chọn vai trò"
          aria-label="Chọn vai trò"
          style={{ minWidth: 240 }}
          loading={roles.isPending}
          options={(roles.data ?? []).map((role) => ({ value: role.id, label: role.name }))}
          value={roleId}
          onChange={(value: number) => {
            setRoleId(value);
            setDraft(undefined);
          }}
        />
        <Button type="primary" disabled={!canSave} loading={save.isPending} onClick={handleSave}>
          Lưu phân quyền
        </Button>
      </Space>
      {roleId !== undefined && (
        <Checkbox.Group
          disabled={assigned === undefined}
          value={selected}
          onChange={(values) => setDraft(values as number[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          options={(permissions.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
      )}
    </>
  );
}
