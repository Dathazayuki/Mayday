import { Form, Select } from 'antd';
import { toNumericId, useBranches, useDepartments, useRooms } from '../../../admin/facilities-api';

/** Nơi công tác trong form: chi nhánh → khoa → phòng (phòng không bắt buộc). */
export interface PlacementValues {
  branch_id?: number;
  department_id?: number;
  room_id?: number;
}

/**
 * Ba ô chọn chi nhánh → khoa → phòng lọc theo nhau (khoa thuộc chi nhánh, phòng thuộc khoa); đổi ô
 * cha thì xoá các ô con. Đặt trong một Form có các trường branch_id, department_id, room_id.
 */
export function PlacementFields() {
  const form = Form.useFormInstance<PlacementValues>();
  const branchId = Form.useWatch('branch_id', form);
  const departmentId = Form.useWatch('department_id', form);
  const branches = useBranches();
  const departments = useDepartments(branchId);
  const rooms = useRooms(departmentId);

  const toOptions = (items: { id: string; name: string }[] | undefined, enabled: boolean) =>
    enabled ? (items ?? []).map((i) => ({ value: toNumericId(i.id), label: i.name })) : [];

  return (
    <>
      <Form.Item
        label="Chi nhánh"
        name="branch_id"
        rules={[{ required: true, message: 'Vui lòng chọn chi nhánh' }]}
      >
        <Select
          options={toOptions(branches.data, true)}
          onChange={() => form.setFieldsValue({ department_id: undefined, room_id: undefined })}
        />
      </Form.Item>
      <Form.Item
        label="Khoa"
        name="department_id"
        rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
      >
        <Select
          disabled={branchId === undefined}
          options={toOptions(departments.data, branchId !== undefined)}
          onChange={() => form.setFieldsValue({ room_id: undefined })}
        />
      </Form.Item>
      <Form.Item label="Phòng" name="room_id">
        <Select
          allowClear
          disabled={departmentId === undefined}
          options={toOptions(rooms.data, departmentId !== undefined)}
        />
      </Form.Item>
    </>
  );
}
