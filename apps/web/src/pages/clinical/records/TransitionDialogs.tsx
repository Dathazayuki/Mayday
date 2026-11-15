import { FIELD_LIMITS, type MedicalRecordListItem } from '@drmayday/shared';
import { Form, Input, Modal, Select, Skeleton, type FormInstance } from 'antd';
import { toNumericId, useBranches, useRooms } from '../../../admin/facilities-api';
import { useMedicalRecord } from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';

/** Phần của hồ sơ mà hộp xác nhận cần (thẻ, kéo thả, màn chi tiết). */
export type TransitionRecord = Pick<
  MedicalRecordListItem,
  'medical_record_id' | 'patient_name' | 'status'
>;

interface AcceptValues {
  room_id?: number;
}

interface CompleteValues {
  instructions?: string;
}

/** Phòng khám để chọn khi tiếp nhận, nhãn kèm tên chi nhánh (spec B, mục 8.6); `GET /rooms`, `/branches`. */
function RoomField() {
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

/** Hộp Tiếp nhận: "Tiếp nhận bệnh án #id của <họ tên>?" + phòng khám tuỳ chọn → POST /:id/accept. */
export function AcceptModal({
  record,
  saving,
  onCancel,
  onSubmit,
}: {
  record: TransitionRecord | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (record: TransitionRecord, roomId: number | undefined) => void;
}) {
  const [form] = Form.useForm<AcceptValues>();
  return (
    <Modal
      title="Tiếp nhận bệnh án"
      open={record !== null}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Tiếp nhận"
      cancelText="Huỷ"
      confirmLoading={saving}
      destroyOnHidden
    >
      {record && (
        <Form<AcceptValues>
          form={form}
          name="accept-record"
          layout="vertical"
          preserve={false}
          onFinish={(values) => onSubmit(record, values.room_id ?? undefined)}
        >
          <p>
            Tiếp nhận bệnh án <span className="num">#{record.medical_record_id}</span> của{' '}
            {record.patient_name}?
          </p>
          <RoomField />
        </Form>
      )}
    </Modal>
  );
}

/** Ô "Dặn dò" điền sẵn dặn dò hiện có (GET /medical_records/:id: danh sách không có trường này). */
function CompleteForm({
  form,
  record,
  onSubmit,
}: {
  form: FormInstance<CompleteValues>;
  record: TransitionRecord;
  onSubmit: (record: TransitionRecord, instructions: string | undefined) => void;
}) {
  const { data, error, isPending } = useMedicalRecord(record.medical_record_id);
  if (error) return <QueryErrorAlert error={error} />;
  if (isPending) return <Skeleton active paragraph={{ rows: 2 }} />;
  const current = data.instructions ?? '';
  return (
    <Form<CompleteValues>
      form={form}
      name="complete-record"
      layout="vertical"
      preserve={false}
      initialValues={{ instructions: current }}
      onFinish={(values) => {
        const next = values.instructions ?? '';
        // Không đổi thì không gửi: API giữ dặn dò hiện có khi vắng trường (D-B8).
        onSubmit(record, next === current ? undefined : next);
      }}
    >
      <Form.Item name="instructions" label="Dặn dò" extra="Hiển thị cho bệnh nhân">
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 8 }}
          maxLength={FIELD_LIMITS.clinical_text}
        />
      </Form.Item>
    </Form>
  );
}

/** Hộp Hoàn tất: ô "Dặn dò" → PUT /:id `{status: 'completed', instructions}`. */
export function CompleteModal({
  record,
  saving,
  onCancel,
  onSubmit,
}: {
  record: TransitionRecord | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (record: TransitionRecord, instructions: string | undefined) => void;
}) {
  const [form] = Form.useForm<CompleteValues>();
  return (
    <Modal
      title={record && `Hoàn tất bệnh án #${record.medical_record_id}`}
      open={record !== null}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Hoàn tất"
      cancelText="Huỷ"
      confirmLoading={saving}
      destroyOnHidden
    >
      {record && <CompleteForm form={form} record={record} onSubmit={onSubmit} />}
    </Modal>
  );
}
