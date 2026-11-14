import {
  LAB_REQUEST_STATUS_LABELS,
  type LabResultRequestData,
  type MedicalRecordData,
} from '@drmayday/shared';
import { Button, Card, List, Space, Typography } from 'antd';
import { useState } from 'react';
import { useCreateLabRequest, useLabResults } from '../../clinical/labs-api';
import { buildLabRequest, type LabRequestFormValues } from '../../clinical/request-builders';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { useRunAction } from '../../components/crud/use-run-action';
import { formatDateTime } from '../../lib/format-date';
import { ItemsFormModal, type ItemField } from './ItemsFormModal';

const FIELDS: ItemField[] = [
  { name: 'test_name', label: 'Tên xét nghiệm', required: true },
  { name: 'description', label: 'Mô tả' },
];

function LabRequestItem({ request }: { request: LabResultRequestData }) {
  return (
    <List.Item>
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <Space>
          <strong>{LAB_REQUEST_STATUS_LABELS[request.status]}</strong>
          <span>{formatDateTime(request.created_at)}</span>
          {request.note && <Typography.Text type="secondary">{request.note}</Typography.Text>}
        </Space>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {request.items.map((item) => (
            <li key={item.id}>
              {item.test_name}: {item.result_value ?? 'Chưa có kết quả'}
              {item.result_note && ` (${item.result_note})`}
            </li>
          ))}
        </ul>
      </Space>
    </List.Item>
  );
}

/** Xét nghiệm của bệnh án: chỉ định (khi đang khám) và các phiếu cùng kết quả. */
export function LabPanel({ record }: { record: MedicalRecordData }) {
  const recordId = record.medical_record_id;
  const [open, setOpen] = useState(false);
  const labs = useLabResults(recordId);
  const create = useCreateLabRequest();
  const run = useRunAction();

  async function handleSubmit(values: LabRequestFormValues) {
    const ok = await run(
      () => create.mutateAsync(buildLabRequest(recordId, values)),
      'Đã chỉ định xét nghiệm',
    );
    if (ok) setOpen(false);
  }

  return (
    <Card
      title="Xét nghiệm"
      style={{ marginBottom: 16 }}
      extra={
        record.status === 'in_progress' && (
          <Button type="primary" onClick={() => setOpen(true)}>
            Chỉ định xét nghiệm
          </Button>
        )
      }
    >
      <QueryErrorAlert error={labs.error} />
      <List
        loading={labs.isPending}
        dataSource={labs.data ?? []}
        locale={{ emptyText: 'Chưa có chỉ định xét nghiệm' }}
        renderItem={(request) => <LabRequestItem request={request} />}
      />
      <ItemsFormModal<LabRequestFormValues>
        title="Chỉ định xét nghiệm"
        formName="lab-request"
        fields={FIELDS}
        open={open}
        saving={create.isPending}
        onClose={() => setOpen(false)}
        onSubmit={(values) => void handleSubmit(values)}
      />
    </Card>
  );
}
