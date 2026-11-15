import { FIELD_LIMITS, type MedicalRecordListItem } from '@drmayday/shared';
import { useEffect } from 'react';
import { Form, Input, Modal, Skeleton, type FormInstance } from 'antd';
import { useMedicalRecord } from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { RoomField } from './RoomField';

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
      title={record && `Tiếp nhận bệnh án #${record.medical_record_id}`}
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
  current,
  loading,
  error,
  onSubmit,
}: {
  form: FormInstance<CompleteValues>;
  record: TransitionRecord;
  /** Dặn dò hiện có; undefined khi chưa tải được. */
  current: string | undefined;
  loading: boolean;
  error: Error | null;
  onSubmit: (record: TransitionRecord, instructions: string | undefined) => void;
}) {
  // Ô chỉ hiện khi dặn dò hiện có đã về tới nơi, lúc đó mới điền sẵn.
  useEffect(() => {
    if (current !== undefined) form.setFieldsValue({ instructions: current });
  }, [form, current]);
  return (
    <Form<CompleteValues>
      form={form}
      name="complete-record"
      layout="vertical"
      preserve={false}
      onFinish={(values) => {
        const next = values.instructions ?? '';
        // Không đổi thì không gửi: API giữ dặn dò hiện có khi vắng trường (D-B8).
        onSubmit(record, next === current ? undefined : next);
      }}
    >
      <QueryErrorAlert error={error} />
      {loading && <Skeleton active paragraph={{ rows: 2 }} />}
      {current !== undefined && (
        <Form.Item name="instructions" label="Dặn dò" extra="Hiển thị cho bệnh nhân">
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 8 }}
            maxLength={FIELD_LIMITS.clinical_text}
          />
        </Form.Item>
      )}
    </Form>
  );
}

/**
 * Hộp Hoàn tất: ô "Dặn dò" → PUT /:id `{status: 'completed', instructions}`. Chỉ xác nhận được khi đã có
 * dặn dò hiện có để so (đang tải hoặc tải lỗi thì khoá nút), tránh ghi đè dặn dò chưa thấy.
 */
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
  const { data, error, isPending } = useMedicalRecord(record?.medical_record_id);
  return (
    <Modal
      title={record && `Hoàn tất bệnh án #${record.medical_record_id}`}
      open={record !== null}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Hoàn tất"
      okButtonProps={{ disabled: data === undefined }}
      cancelText="Huỷ"
      confirmLoading={saving}
      destroyOnHidden
    >
      {record && (
        <CompleteForm
          form={form}
          record={record}
          current={data && (data.instructions ?? '')}
          loading={isPending}
          error={error}
          onSubmit={onSubmit}
        />
      )}
    </Modal>
  );
}
