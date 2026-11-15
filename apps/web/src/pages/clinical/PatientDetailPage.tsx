import type {
  MedicalRecordHistoryItem,
  MedicalRecordStatus,
  PatientData,
  RecordType,
} from '@drmayday/shared';
import { Button, Descriptions, Skeleton } from 'antd';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { usePatientHistory } from '../../clinical/medical-records-api';
import { usePatient } from '../../clinical/patients-api';
import { RecordTypeBadge } from '../../clinical/record-type';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { EntityTable } from '../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { useEntityModal } from '../../components/crud/use-entity-modal';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDate, formatDateTime, formatInstantDate } from '../../lib/format-date';
import { genderLabel, patientFieldItems } from '../../profile/patient-field-items';
import { toFormValues, type ProfileFormValues } from '../../profile/profile-form';
import { AccountBadge } from './patients/AccountBadge';
import { EditPatientModal } from './patients/EditPatientModal';
import { CreateRecordModal } from './records/CreateRecordModal';

const BACK = { to: '/patients', label: 'Bệnh nhân' };

/** Panel "Thông tin hành chính": mọi trường của PatientData. */
function AdministrativePanel({ patient }: { patient: PatientData }) {
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Họ và tên', value: patient.full_name },
    { label: 'Số điện thoại', value: patient.phone },
    { label: 'Giới tính', value: genderLabel(patient.gender) },
    ...patientFieldItems(patient),
    { label: 'Tài khoản đăng nhập', value: <AccountBadge hasAccount={patient.has_account} /> },
    { label: 'Ngày tạo', value: formatInstantDate(patient.created_at) },
  ];
  return (
    <Panel title="Thông tin hành chính">
      <Descriptions
        column={{ xs: 1, md: 2 }}
        bordered
        size="small"
        items={items.map((item) => ({ key: item.label, label: item.label, children: item.value }))}
      />
    </Panel>
  );
}

/** Panel "Bệnh án" (spec B, mục 8.3): lịch sử bệnh án của bệnh nhân (medrec13); bấm dòng → màn chi tiết. */
function RecordsPanel({ patientId }: { patientId: number }) {
  const navigate = useNavigate();
  const { data, error, isPending } = usePatientHistory(patientId);
  return (
    <Panel title="Bệnh án" flush>
      <QueryErrorAlert error={error} />
      <EntityTable<MedicalRecordHistoryItem>
        rowKey="medical_record_id"
        data={data}
        loading={isPending}
        emptyText="Chưa có bệnh án"
        onRowClick={(row) => navigate(`/medical-records/${row.medical_record_id}`)}
        columns={[
          {
            title: 'Mã',
            dataIndex: 'medical_record_id',
            render: (value: number) => <span className="num">#{value}</span>,
          },
          {
            title: 'Loại',
            dataIndex: 'record_type',
            render: (value: RecordType) => <RecordTypeBadge type={value} />,
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (value: MedicalRecordStatus) => <MedicalRecordStatusTag status={value} />,
          },
          {
            title: 'Khám lần đầu',
            dataIndex: 'first_visit_at',
            render: (value: string | null) => (value ? formatDateTime(value) : 'Chưa đến khám'),
          },
          {
            title: 'Lần khám gần nhất',
            dataIndex: 'last_visit_date',
            render: (value: string | null) => (value ? formatDate(value) : '—'),
          },
          {
            title: 'Dặn dò',
            dataIndex: 'instructions',
            render: (value: string | null) => value ?? '—',
          },
        ]}
      />
    </Panel>
  );
}

/**
 * Trang chi tiết bệnh nhân (spec B, mục 8.3): thông tin hành chính, "Sửa thông tin", "Tạo bệnh án" (bệnh
 * nhân điền sẵn) và panel "Bệnh án".
 */
export function PatientDetailPage() {
  const id = Number(useParams().id);
  const { data, error, isPending } = usePatient(id);
  const editModal = useEntityModal<ProfileFormValues, PatientData>((patient) =>
    patient ? toFormValues(patient) : {},
  );
  const [creatingRecord, setCreatingRecord] = useState(false);

  const fallbackTitle = `Bệnh nhân #${id}`;
  if (error) {
    return (
      <Page title={fallbackTitle} back={BACK}>
        <QueryErrorAlert error={error} />
      </Page>
    );
  }
  if (isPending) {
    return (
      <Page title={fallbackTitle} back={BACK}>
        <Skeleton active />
      </Page>
    );
  }
  return (
    <Page
      title={data.full_name}
      subtitle={
        <span>
          Mã BN <span className="num">#{data.user_id}</span> · {data.phone}
        </span>
      }
      back={BACK}
      actions={
        <>
          <Button onClick={() => editModal.openEdit(data)}>Sửa thông tin</Button>
          <Button type="primary" onClick={() => setCreatingRecord(true)}>
            Tạo bệnh án
          </Button>
        </>
      }
    >
      <AdministrativePanel patient={data} />
      <RecordsPanel patientId={id} />
      <EditPatientModal modal={editModal} />
      <CreateRecordModal
        open={creatingRecord}
        patient={{ id: data.user_id, name: data.full_name, phone: data.phone }}
        onClose={() => setCreatingRecord(false)}
      />
    </Page>
  );
}
