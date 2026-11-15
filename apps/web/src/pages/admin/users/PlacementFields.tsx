import { Form, Select } from 'antd';
import { toNumericId, useBranches } from '../../../admin/facilities-api';

/** Nơi công tác trong form: chỉ còn chi nhánh (spec A, quyết định 11). */
export interface PlacementValues {
  branch_id?: number;
}

/** Ô chọn chi nhánh bắt buộc; đặt trong một Form có trường branch_id. */
export function PlacementFields() {
  const branches = useBranches();
  const options = (branches.data ?? []).map((b) => ({ value: toNumericId(b.id), label: b.name }));
  return (
    <Form.Item
      label="Chi nhánh"
      name="branch_id"
      rules={[{ required: true, message: 'Vui lòng chọn chi nhánh' }]}
    >
      <Select options={options} />
    </Form.Item>
  );
}
