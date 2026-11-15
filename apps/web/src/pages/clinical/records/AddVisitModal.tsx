import { vietnamDate, type CreateVisitRequest } from '@drmayday/shared';
import { Form, Modal } from 'antd';
import { useAddVisit } from '../../../clinical/visits-api';
import { useRunAction } from '../../../components/crud/use-run-action';
import { formatDate } from '../../../lib/format-date';
import { RoomField } from './RoomField';

interface AddVisitValues {
  room_id?: number;
}

/**
 * Hộp "Thêm phiên khám" (spec B, mục 8.7): POST /medical_records/:id/visits với ngày khám hôm nay (API
 * lấy hôm nay giờ Việt Nam khi vắng `visit_date`, D-B23); phòng khám chọn được, để trống = chưa phân
 * phòng (MT-115).
 */
export function AddVisitModal({
  recordId,
  open,
  onClose,
}: {
  recordId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<AddVisitValues>();
  const add = useAddVisit();
  const run = useRunAction();

  async function submit(values: AddVisitValues) {
    const body: CreateVisitRequest =
      values.room_id === undefined ? {} : { room_id: values.room_id };
    if (await run(() => add.mutateAsync({ recordId, body }), 'Đã thêm phiên khám')) onClose();
  }

  return (
    <Modal
      title="Thêm phiên khám"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Thêm phiên khám"
      cancelText="Huỷ"
      confirmLoading={add.isPending}
      destroyOnHidden
    >
      <Form<AddVisitValues>
        form={form}
        name="add-visit"
        layout="vertical"
        preserve={false}
        onFinish={(values) => void submit(values)}
      >
        <p>
          Phiên khám mới của bệnh án <span className="num">#{recordId}</span>, ngày khám hôm nay{' '}
          {formatDate(vietnamDate())}.
        </p>
        <RoomField />
      </Form>
    </Modal>
  );
}
