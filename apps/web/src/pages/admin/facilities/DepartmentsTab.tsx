import type { DepartmentListItem } from '@drmayday/shared';
import { Button, Form, Input, Select } from 'antd';
import { useState } from 'react';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import { EntityTable } from '../../../components/crud/EntityTable';
import {
  toNumericId,
  useBranches,
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
} from '../../../admin/facilities-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { RowActions } from '../../../admin/RowActions';
import { useEntityModal } from '../../../components/crud/use-entity-modal';
import { useDeleteAction } from '../../../components/crud/use-run-action';

interface DepartmentFormValues {
  name: string;
  description?: string;
  branch_id: number;
}

export function DepartmentsTab() {
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

  const { data, error, isPending } = useDepartments(branchFilter);
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const remove = useDeleteDepartment();
  const deleteRow = useDeleteAction('khoa');
  const modal = useEntityModal<DepartmentFormValues, DepartmentListItem>((department) => ({
    name: department?.name ?? '',
    description: department?.description ?? '',
    branch_id: department ? toNumericId(department.branch_id) : branchFilter,
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
          Thêm khoa
        </Button>
      </div>
      <EntityTable<DepartmentListItem>
        data={data}
        loading={isPending}
        columns={[
          { title: 'Tên khoa', dataIndex: 'name' },
          { title: 'Chi nhánh', dataIndex: 'branch_id', render: (id: string) => branchName(id) },
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
      <EntityFormModal<DepartmentFormValues, DepartmentListItem>
        modal={modal}
        formName="department"
        entityName="khoa"
        saving={create.isPending || update.isPending}
        onCreate={(values) =>
          create.mutateAsync({
            name: values.name.trim(),
            description: values.description?.trim() || undefined,
            branch_id: values.branch_id,
          })
        }
        onUpdate={(department, values) =>
          update.mutateAsync({
            id: department.id,
            changes: {
              name: values.name.trim(),
              description: values.description?.trim() || null,
              branch_id: values.branch_id,
            },
          })
        }
      >
        <Form.Item
          label="Tên khoa"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên khoa' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Chi nhánh"
          name="branch_id"
          rules={[{ required: true, message: 'Vui lòng chọn chi nhánh' }]}
        >
          <Select options={branchOptions} />
        </Form.Item>
        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </EntityFormModal>
    </>
  );
}
