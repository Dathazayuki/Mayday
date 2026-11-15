import { FIELD_LIMITS, type RoomListItem } from '@drmayday/shared';
import { Button, Form, Input, Select } from 'antd';
import { useState } from 'react';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import { EntityTable } from '../../../components/crud/EntityTable';
import {
  toNumericId,
  useBranches,
  useCreateRoom,
  useDeleteRoom,
  useRooms,
  useUpdateRoom,
} from '../../../admin/facilities-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { RowActions } from '../../../admin/RowActions';
import { useEntityModal } from '../../../components/crud/use-entity-modal';
import { useDeleteAction } from '../../../components/crud/use-run-action';

interface RoomFormValues {
  name: string;
  branch_id: number;
}

/** Phòng khám thuộc thẳng chi nhánh (spec A, mục 7.2): lọc và chọn theo chi nhánh; không có mô tả, ngày tạo. */
export function RoomsTab() {
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const branches = useBranches();
  const branchOptions = (branches.data ?? []).map((b) => ({
    value: toNumericId(b.id),
    label: b.name,
  }));
  // Chi nhánh đang lọc bị xoá (không còn trong danh sách) thì bỏ lọc, tránh gọi API với id cũ.
  const branchFilter = branchOptions.some((o) => o.value === selectedBranch)
    ? selectedBranch
    : undefined;

  const { data, error, isPending } = useRooms(branchFilter);
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const remove = useDeleteRoom();
  const deleteRow = useDeleteAction('phòng');
  const modal = useEntityModal<RoomFormValues, RoomListItem>((room) => ({
    name: room?.name ?? '',
    branch_id: room ? toNumericId(room.branch_id) : branchFilter,
  }));
  const branchName = (id: string) => branches.data?.find((b) => b.id === id)?.name ?? id;

  return (
    <>
      <QueryErrorAlert error={error} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Tất cả chi nhánh"
          aria-label="Lọc theo chi nhánh"
          style={{ minWidth: 240 }}
          options={branchOptions}
          value={branchFilter}
          onChange={(value: number | undefined) => setSelectedBranch(value)}
        />
        <Button type="primary" onClick={modal.openCreate}>
          Thêm phòng
        </Button>
      </div>
      <EntityTable<RoomListItem>
        data={data}
        loading={isPending}
        columns={[
          { title: 'Tên phòng', dataIndex: 'name' },
          { title: 'Chi nhánh', dataIndex: 'branch_id', render: (id: string) => branchName(id) },
          {
            title: 'Thao tác',
            render: (_, row) => (
              <RowActions
                onEdit={() => modal.openEdit(row)}
                onDelete={() => deleteRow(() => remove.mutateAsync(row.id))}
              />
            ),
          },
        ]}
      />
      <EntityFormModal<RoomFormValues, RoomListItem>
        modal={modal}
        formName="room"
        entityName="phòng"
        saving={create.isPending || update.isPending}
        onCreate={(values) =>
          create.mutateAsync({ name: values.name.trim(), branch_id: values.branch_id })
        }
        onUpdate={(room, values) =>
          update.mutateAsync({
            id: room.id,
            changes: { name: values.name.trim(), branch_id: values.branch_id },
          })
        }
      >
        <Form.Item
          label="Tên phòng"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên phòng' }]}
        >
          <Input maxLength={FIELD_LIMITS.room_name} />
        </Form.Item>
        <Form.Item
          label="Chi nhánh"
          name="branch_id"
          rules={[{ required: true, message: 'Vui lòng chọn chi nhánh' }]}
        >
          <Select options={branchOptions} />
        </Form.Item>
      </EntityFormModal>
    </>
  );
}
