import { describeError, RECORD_TYPE_LABELS, type MedicalRecordData } from '@drmayday/shared';
import { Alert, Descriptions, Skeleton, Space } from 'antd';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useMedicalRecord, usePatientHistory } from '../../clinical/medical-records-api';
import { RecordTypeBadge } from '../../clinical/record-type';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { ItemList } from '../../components/ItemList';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { EMPTY_VALUE, firstVisitText, formatDate, formatDateTime } from '../../lib/format-date';
import { AddVisitModal } from './records/AddVisitModal';
import { CaseFieldsPanel } from './records/CaseFieldsPanel';
import { RecordActions } from './records/RecordActions';
import { SelfReportPanel } from './records/SelfReportPanel';
import { useTransitions } from './records/TransitionModals';
import { VisitsPanel } from './records/VisitsPanel';

const BACK = { to: '/medical-records', label: 'Bệnh án' };

/** Phụ đề: họ tên (link tới trang bệnh nhân) · loại · trạng thái (spec B, mục 8.7). */
function RecordSubtitle({ record }: { record: MedicalRecordData }) {
  return (
    <Space size={8} wrap>
      <Link to={`/patients/${record.patient_id}`}>{record.patient_name}</Link>
      <RecordTypeBadge type={record.record_type} />
      <MedicalRecordStatusTag status={record.status} />
    </Space>
  );
}

/** Panel "Tóm tắt" (spec B, mục 8.7): trường suy ra của hồ sơ (mục 3.8). */
function SummaryPanel({ record }: { record: MedicalRecordData }) {
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Bác sĩ phụ trách', value: record.assigned_doctor_name ?? EMPTY_VALUE },
    { label: 'Khám lần đầu', value: firstVisitText(record.first_visit_at) },
    { label: 'Số phiên khám', value: <span className="num">{record.visit_count}</span> },
    {
      label: 'Lần khám gần nhất',
      value: record.last_visit_date ? formatDate(record.last_visit_date) : EMPTY_VALUE,
    },
    {
      label: 'Hẹn tái khám',
      value: record.next_appointment_date ? formatDate(record.next_appointment_date) : EMPTY_VALUE,
    },
    { label: 'Dặn dò gần nhất', value: record.instructions ?? EMPTY_VALUE },
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
                {firstVisitText(
                  item.first_visit_at,
                  (iso) => `Khám lần đầu ${formatDateTime(iso)}`,
                )}
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
 * Màn chi tiết bệnh án (spec B, mục 8.7): thao tác theo `allowed_actions` (hộp xác nhận dùng chung của
 * bảng cột), "Tóm tắt", "Bệnh nhân tự khai", "Hồ sơ" và bệnh án cấp/mạn (form có kiểu dựng từ bộ mô tả,
 * D-B13; chỉ ở dạng của nhân viên), "Phiên khám", lịch sử bệnh án của bệnh nhân. Panel UAS7, đơn thuốc,
 * xét nghiệm, tổn thương da giữ file tới tiểu dự án C nhưng không render (mục 8.9).
 */
export function MedicalRecordDetailPage() {
  const id = Number(useParams().id);
  const { data, error, isPending } = useMedicalRecord(id);
  const transitions = useTransitions();
  const [addingVisit, setAddingVisit] = useState(false);

  const title = `Bệnh án #${id}`;
  if (error) {
    return (
      <Page title={title} back={BACK}>
        <Alert type="error" showIcon title={describeError(error)} />
      </Page>
    );
  }
  if (isPending) {
    return (
      <Page title={title} back={BACK}>
        <Skeleton active />
      </Page>
    );
  }
  return (
    <Page
      title={title}
      subtitle={<RecordSubtitle record={data} />}
      back={BACK}
      actions={
        <RecordActions
          record={data}
          transitions={transitions}
          onAddVisit={() => setAddingVisit(true)}
        />
      }
    >
      <SummaryPanel record={data} />
      <SelfReportPanel record={data} />
      {data.details && <CaseFieldsPanel record={data} details={data.details} />}
      <VisitsPanel record={data} onAddVisit={() => setAddingVisit(true)} />
      <HistoryPanel patientId={data.patient_id} />
      {transitions.modals}
      <AddVisitModal recordId={id} open={addingVisit} onClose={() => setAddingVisit(false)} />
    </Page>
  );
}
