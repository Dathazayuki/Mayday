import {
  ApiError,
  describeError,
  type MedicalRecordData,
  type PrescriptionData,
} from '@drmayday/shared';
import { Alert, Button, Card, Table, Typography } from 'antd';
import { useState } from 'react';
import { canExamine } from '../../clinical/record-state';
import { useCreatePrescription, useIssuedPrescription } from '../../clinical/prescriptions-api';
import {
  buildPrescriptionRequest,
  type PrescriptionFormValues,
} from '../../clinical/request-builders';
import { useRunAction } from '../../components/crud/use-run-action';
import { formatDateTime } from '../../lib/format-date';
import { ItemsFormModal, type ItemField } from './ItemsFormModal';

const ALREADY_PRESCRIBED = '8003';

const FIELDS: ItemField[] = [
  { name: 'medicine_name', label: 'Tên thuốc', required: true },
  { name: 'dosage', label: 'Liều lượng' },
  { name: 'frequency', label: 'Tần suất' },
  { name: 'duration', label: 'Thời gian dùng' },
  { name: 'instruction', label: 'Hướng dẫn' },
];

const COLUMNS = FIELDS.map(({ name, label }) => ({
  title: label,
  dataIndex: name,
  render: (value: string | null) => value ?? '',
}));

function IssuedPrescription({ prescription }: { prescription: PrescriptionData }) {
  return (
    <>
      <Typography.Paragraph type="secondary">
        Kê lúc {formatDateTime(prescription.created_at)}
        {prescription.note && ` · Ghi chú: ${prescription.note}`}
      </Typography.Paragraph>
      <Table
        rowKey="prescription_item_id"
        size="small"
        pagination={false}
        columns={COLUMNS}
        dataSource={prescription.items}
      />
    </>
  );
}

/** Đơn thuốc của bệnh án: kê đơn (khi đang khám) và hiện đơn vừa kê. Mỗi bệnh án chỉ có một đơn (8003). */
export function PrescriptionPanel({ record }: { record: MedicalRecordData }) {
  const recordId = record.medical_record_id;
  const [open, setOpen] = useState(false);
  const issued = useIssuedPrescription(recordId).data;
  const create = useCreatePrescription(recordId);
  const run = useRunAction();

  async function handleSubmit(values: PrescriptionFormValues) {
    const ok = await run(
      () => create.mutateAsync(buildPrescriptionRequest(recordId, values)),
      'Đã kê đơn',
    );
    if (ok) setOpen(false);
  }

  // 8003: bệnh án đã có đơn (kê từ phiên khác); khoá nút và báo lý do thay vì cho thử lại.
  const lockedReason =
    create.error instanceof ApiError && create.error.code === ALREADY_PRESCRIBED
      ? describeError(create.error)
      : null;
  const canIssue = canExamine(record) && !issued && !lockedReason;

  return (
    <Card
      title="Đơn thuốc"
      style={{ marginBottom: 16 }}
      extra={
        canExamine(record) && (
          <Button type="primary" disabled={!canIssue} onClick={() => setOpen(true)}>
            Kê đơn
          </Button>
        )
      }
    >
      {lockedReason && (
        <Alert type="warning" showIcon title={lockedReason} style={{ marginBottom: 16 }} />
      )}
      {issued && <IssuedPrescription prescription={issued} />}
      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
        Đơn đã kê trước đây chưa xem được (MT-77): cần API chưa có.
      </Typography.Paragraph>
      <ItemsFormModal<PrescriptionFormValues>
        title="Kê đơn thuốc"
        formName="prescription"
        fields={FIELDS}
        // Khoá (8003) hoặc đã kê xong thì modal đóng theo.
        open={open && canIssue}
        saving={create.isPending}
        onClose={() => setOpen(false)}
        onSubmit={(values) => void handleSubmit(values)}
      />
    </Card>
  );
}
