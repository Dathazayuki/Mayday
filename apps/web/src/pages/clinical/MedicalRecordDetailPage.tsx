import { describeError, RECORD_TYPE_LABELS, type MedicalRecordData } from '@drmayday/shared';
import { Alert, Descriptions, Skeleton, Space } from 'antd';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { useMedicalRecord, usePatientHistory } from '../../clinical/medical-records-api';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { ItemList } from '../../components/ItemList';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDate, formatDateTime } from '../../lib/format-date';

const EMPTY = '—';

/** "Khám lần đầu …" hoặc "Chưa đến khám" (hồ sơ chưa tiếp nhận, D-B9). */
function firstVisitText(firstVisitAt: string | null): string {
  return firstVisitAt ? formatDateTime(firstVisitAt) : 'Chưa đến khám';
}

/** Panel "Tóm tắt" (spec B, mục 8.7): trường suy ra của hồ sơ (mục 3.8). */
function SummaryPanel({ record }: { record: MedicalRecordData }) {
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Bệnh nhân', value: `${record.patient_name} · ${record.patient_phone}` },
    { label: 'Loại bệnh án', value: RECORD_TYPE_LABELS[record.record_type] },
    { label: 'Trạng thái', value: <MedicalRecordStatusTag status={record.status} /> },
    { label: 'Bác sĩ phụ trách', value: record.assigned_doctor_name ?? EMPTY },
    { label: 'Khám lần đầu', value: firstVisitText(record.first_visit_at) },
    { label: 'Số phiên khám', value: <span className="num">{record.visit_count}</span> },
    {
      label: 'Lần khám gần nhất',
      value: record.last_visit_date ? formatDate(record.last_visit_date) : EMPTY,
    },
    {
      label: 'Hẹn tái khám',
      value: record.next_appointment_date ? formatDate(record.next_appointment_date) : EMPTY,
    },
    { label: 'Dặn dò gần nhất', value: record.instructions ?? EMPTY },
  ];
  return (
    <Panel title="Tóm tắt">
      <Descriptions
        column={{ xs: 1, md: 2 }}
        bordered
        size="small"
        items={items.map((item) => ({ key: item.label, label: item.label, children: item.value }))}
      />
    </Panel>
  );
}

function HistoryPanel({ patientId }: { patientId: number }) {
  const { data, error, isPending } = usePatientHistory(patientId);
  return (
    <Panel title="Lịch sử bệnh án của bệnh nhân">
      <QueryErrorAlert error={error} />
      <ItemList
        loading={isPending}
        items={data ?? []}
        rowKey={(item) => item.medical_record_id}
        emptyText="Chưa có bệnh án nào"
        renderItem={(item) => (
          <Space orientation="vertical" size={0}>
            <Space>
              <span className="num">#{item.medical_record_id}</span>
              <span>{RECORD_TYPE_LABELS[item.record_type]}</span>
              <MedicalRecordStatusTag status={item.status} />
              <span>
                {item.first_visit_at
                  ? `Khám lần đầu ${formatDateTime(item.first_visit_at)}`
                  : 'Chưa đến khám'}
              </span>
            </Space>
            {item.instructions && <span>{item.instructions}</span>}
          </Space>
        )}
      />
    </Panel>
  );
}

/**
 * Màn chi tiết bệnh án. Phiếu động đã gỡ (D-B27); trong lúc chờ form có kiểu, phiên khám (B5) và thao
 * tác chuyển trạng thái (B4/B5), màn chỉ có tóm tắt và lịch sử bệnh án của bệnh nhân (spec B, mục 13,
 * B2). Panel UAS7, đơn thuốc, xét nghiệm, tổn thương da giữ file tới tiểu dự án C nhưng không render
 * ở đây (spec B, mục 8.9).
 */
export function MedicalRecordDetailPage() {
  const id = Number(useParams().id);
  const { data, error, isPending } = useMedicalRecord(id);

  const title = `Bệnh án #${id}`;
  const back = { to: '/medical-records', label: 'Bệnh án' };

  if (error) {
    return (
      <Page title={title} back={back}>
        <Alert type="error" showIcon title={describeError(error)} />
      </Page>
    );
  }
  if (isPending) {
    return (
      <Page title={title} back={back}>
        <Skeleton active />
      </Page>
    );
  }
  return (
    <Page title={title} back={back}>
      <SummaryPanel record={data} />
      <HistoryPanel patientId={data.patient_id} />
    </Page>
  );
}
