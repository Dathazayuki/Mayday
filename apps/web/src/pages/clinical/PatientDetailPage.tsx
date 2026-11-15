import type { PatientData } from '@drmayday/shared';
import { Button, Descriptions, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { usePatient } from '../../clinical/patients-api';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { useEntityModal } from '../../components/crud/use-entity-modal';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDateTime } from '../../lib/format-date';
import { genderLabel, patientFieldItems } from '../../profile/patient-field-items';
import { toFormValues, type ProfileFormValues } from '../../profile/profile-form';
import { AccountBadge } from './patients/AccountBadge';
import { EditPatientModal } from './patients/EditPatientModal';

const BACK = { to: '/patients', label: 'Bệnh nhân' };

/** Panel "Thông tin hành chính": mọi trường của PatientData. */
function AdministrativePanel({ patient }: { patient: PatientData }) {
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Họ và tên', value: patient.full_name },
    { label: 'Số điện thoại', value: patient.phone },
    { label: 'Giới tính', value: genderLabel(patient.gender) },
    ...patientFieldItems(patient),
    { label: 'Tài khoản đăng nhập', value: <AccountBadge hasAccount={patient.has_account} /> },
    { label: 'Ngày tạo', value: formatDateTime(patient.created_at) },
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

/**
 * Trang chi tiết bệnh nhân (spec B, mục 8.3): thông tin hành chính và "Sửa thông tin". Nút "Tạo bệnh
 * án" và panel "Bệnh án" thêm ở B4 (cần API bệnh án của B2).
 */
export function PatientDetailPage() {
  const id = Number(useParams().id);
  const { data, error, isPending } = usePatient(id);
  const editModal = useEntityModal<ProfileFormValues, PatientData>((patient) =>
    patient ? toFormValues(patient) : {},
  );

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
      actions={<Button onClick={() => editModal.openEdit(data)}>Sửa thông tin</Button>}
    >
      <AdministrativePanel patient={data} />
      <EditPatientModal modal={editModal} />
    </Page>
  );
}
