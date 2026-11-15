import { useNavigate } from 'react-router';
import { useCreatePatient } from '../../../clinical/patients-api';
import { AccountFields } from '../../../components/account/AccountFields';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import type { EntityModal } from '../../../components/crud/use-entity-modal';
import { PatientEditableFields } from '../../../profile/PatientEditableFields';
import { toCreatePatientRequest, type CreatePatientFormValues } from './create-patient-request';

/**
 * Modal "Thêm bệnh nhân" (POST /doctor/patients/create): luôn tạo tài khoản đăng nhập kèm hồ sơ, nên
 * mật khẩu bắt buộc (MT-119); tạo xong mở trang chi tiết bệnh nhân (spec B, mục 8.2).
 */
export function CreatePatientModal({
  modal,
}: {
  modal: EntityModal<CreatePatientFormValues, never>;
}) {
  const create = useCreatePatient();
  const navigate = useNavigate();
  return (
    <EntityFormModal<CreatePatientFormValues, never>
      modal={modal}
      formName="patient"
      entityName="bệnh nhân"
      saving={create.isPending}
      createOnly
      onCreate={async (values) => {
        const patient = await create.mutateAsync(toCreatePatientRequest(values));
        navigate(`/patients/${patient.user_id}`);
      }}
    >
      <AccountFields withCredentials phoneHint="Số điện thoại là tên đăng nhập của bệnh nhân" />
      <PatientEditableFields />
    </EntityFormModal>
  );
}
