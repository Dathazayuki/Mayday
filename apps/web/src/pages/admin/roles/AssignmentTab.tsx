import { describeError } from '@drmayday/shared';
import { App, Button, Checkbox, Select, Space } from 'antd';
import { useState } from 'react';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import {
  usePermissions,
  useRolePermissions,
  useRoles,
  useSaveRolePermissions,
} from '../../../admin/rbac-api';
import { diffPermissions } from './permission-diff';

export function AssignmentTab() {
  const [roleId, setRoleId] = useState<number | undefined>();
  /** Tập quyền đang chọn; undefined = chưa chỉnh, hiển thị đúng quyền đã gán. */
  const [draft, setDraft] = useState<number[] | undefined>();
  const roles = useRoles();
  const permissions = usePermissions();
  const assignment = useRolePermissions(roleId);
  const save = useSaveRolePermissions();
  const { message } = App.useApp();

  const assigned = assignment.data?.map((p) => p.permission_id);
  // Chỉ xét các quyền còn trong danh sách quyền: quyền đã bị xoá ở tab khác (hoặc chưa tải xong
  // danh sách) không được gán lại và cũng không sinh lệnh thu hồi ngoài ý muốn.
  const existing = new Set((permissions.data ?? []).map((p) => p.id));
  const baseline = (assigned ?? []).filter((id) => existing.has(id));
  const selected = draft ? draft.filter((id) => existing.has(id)) : baseline;
  const { toAdd, toRemove } = diffPermissions(baseline, selected);
  const canSave =
    roleId !== undefined &&
    permissions.data !== undefined &&
    assigned !== undefined &&
    toAdd.length + toRemove.length > 0;

  async function handleSave() {
    if (roleId === undefined) return;
    // Không dùng useRunAction vì lưu một phần cần thông báo lỗi riêng (không phải thành công/thất bại).
    try {
      const { failedAdd, failedRemove, firstError } = await save.mutateAsync({
        roleId,
        toAdd,
        toRemove,
      });
      if (failedAdd + failedRemove === 0) {
        void message.success('Đã lưu phân quyền');
      } else {
        const parts = [
          failedAdd > 0 && `không gán được ${failedAdd} quyền`,
          failedRemove > 0 && `không thu hồi được ${failedRemove} quyền`,
        ].filter(Boolean);
        void message.error(`Lưu một phần: ${parts.join(' / ')}. ${describeError(firstError)}`);
      }
    } catch (err) {
      void message.error(describeError(err));
      return;
    }
    // Danh sách đã được làm mới: hiển thị lại đúng trạng thái thực tế trên máy chủ.
    setDraft(undefined);
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
