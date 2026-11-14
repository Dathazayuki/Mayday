import type { RoomListItem } from '@drmayday/shared';
import { Button, Form, Input, Select } from 'antd';
import { useState } from 'react';
import { EntityFormModal } from '../../../admin/EntityFormModal';
import { EntityTable } from '../../../admin/EntityTable';
import {
  toNumericId,
  useBranches,
  useCreateRoom,
  useDeleteRoom,
  useDepartments,
  useRooms,
  useUpdateRoom,
} from '../../../admin/facilities-api';
import { QueryErrorAlert } from '../../../admin/QueryErrorAlert';
import { RowActions } from '../../../admin/RowActions';
import { useEntityModal } from '../../../admin/use-entity-modal';
import { useDeleteAction } from '../../../admin/use-run-action';

interface RoomFormValues {
  name: string;
  description?: string;
  department_id: number;
}

export function RoomsTab() {
  const [selectedDepartment, setSelectedDepartment] = useState<number | undefined>();
  const departments = useDepartments();
  const branches = useBranches();
  // "Khoa – Chi nhánh": phân biệt các khoa trùng tên ở chi nhánh khác nhau.
  const departmentLabel = (d: { name: string; branch_id: string }) => {
    const branch = branches.data?.find((b) => b.id === d.branch_id)?.name;
    return branch ? `${d.name} – ${branch}` : d.name;
  };
  const departmentOptions = (departments.data ?? []).map((d) => ({
    value: toNumericId(d.id),
    label: departmentLabel(d),
  }));
  // Khoa đang lọc bị xoá (không còn trong danh sách) thì bỏ lọc, tránh gọi API với id cũ.
  const departmentFilter = departmentOptions.some((o) => o.value === selectedDepartment)
    ? selectedDepartment
    : undefined;

  const { data, error, isPending } = useRooms(departmentFilter);
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const remove = useDeleteRoom();
  const deleteRow = useDeleteAction('phòng');
  const modal = useEntityModal<RoomFormValues, RoomListItem>((room) => ({
    name: room?.name ?? '',
    description: room?.description ?? '',
    department_id:
      room === null
        ? departmentFilter
        : room.department_id === null
          ? undefined
          : toNumericId(room.department_id),
  }));
  const departmentName = (id: string | null) => {
    const department = departments.data?.find((d) => d.id === id);
    return department ? departmentLabel(department) : '';
  };

  return (
    <>
      <QueryErrorAlert error={error} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Tất cả khoa"
          aria-label="Lọc theo khoa"
          style={{ minWidth: 280 }}
          options={departmentOptions}
          value={departmentFilter}
          onChange={(value: number | undefined) => setSelectedDepartment(value)}
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
          {
            title: 'Khoa',
            dataIndex: 'department_id',
            render: (id: string | null) => departmentName(id),
          },
          { title: 'Mô tả', dataIndex: 'description' },
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
          create.mutateAsync({
            name: values.name.trim(),
            description: values.description?.trim() || undefined,
            department_id: values.department_id,
          })
        }
        onUpdate={(room, values) =>
          update.mutateAsync({
            id: room.id,
            changes: {
              name: values.name.trim(),
              description: values.description?.trim() || null,
              department_id: values.department_id,
            },
          })
        }
      >
        <Form.Item
          label="Tên phòng"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên phòng' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Khoa"
          name="department_id"
          rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
        >
          <Select options={departmentOptions} />
        </Form.Item>
        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </EntityFormModal>
    </>
  );
}
