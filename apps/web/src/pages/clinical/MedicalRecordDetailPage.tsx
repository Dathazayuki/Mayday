import { describeError, type MedicalRecordData } from '@drmayday/shared';
import { Alert, Descriptions, Skeleton, Space } from 'antd';
import { useParams } from 'react-router';
import {
  useMedicalRecord,
  useMedicalRecordSummary,
  usePatientHistory,
} from '../../clinical/medical-records-api';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { ItemList } from '../../components/ItemList';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDateTime } from '../../lib/format-date';

function SummaryCard({ record }: { record: MedicalRecordData }) {
  const { data, error } = useMedicalRecordSummary(record.medical_record_id);
  return (
    <Panel title="Thông tin bệnh án">
      <QueryErrorAlert error={error} />
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Bệnh nhân">{data?.patient_name}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          <MedicalRecordStatusTag status={record.status} />
        </Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">{formatDateTime(record.created_at)}</Descriptions.Item>
        {record.instructions && (
          <Descriptions.Item label="Dặn dò">{record.instructions}</Descriptions.Item>
        )}
      </Descriptions>
    </Panel>
  );
}

function HistoryCard({ patientId }: { patientId: number }) {
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
              <MedicalRecordStatusTag status={item.status} />
              <span>{formatDateTime(item.created_at)}</span>
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
      <SummaryCard record={data} />
      <HistoryCard patientId={data.patient_id} />
    </Page>
  );
}
