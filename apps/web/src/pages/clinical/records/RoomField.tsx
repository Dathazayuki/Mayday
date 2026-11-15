import { Form, Select } from 'antd';
import { toNumericId, useBranches, useRooms } from '../../../admin/facilities-api';

/**
 * Ô "Phòng khám" của phiên (MT-115): `GET /rooms`, nhãn kèm tên chi nhánh (`GET /branches`); để trống =
 * chưa phân phòng. Dùng chung cho hộp Tiếp nhận, hộp Thêm phiên khám và form sửa phiên.
 */
export function RoomField() {
  const rooms = useRooms();
  const branches = useBranches();
  const branchNames = new Map(branches.data?.map((branch) => [branch.id, branch.name]));
  const options = (rooms.data ?? []).map((room) => ({
    value: toNumericId(room.id),
    label: [room.name, branchNames.get(room.branch_id)].filter(Boolean).join(' · '),
  }));
  return (
    <Form.Item name="room_id" label="Phòng khám" extra="Để trống nếu chưa phân phòng">
      <Select
        allowClear
        placeholder="Chưa phân phòng"
        loading={rooms.isPending || branches.isPending}
        options={options}
      />
    </Form.Item>
  );
}
