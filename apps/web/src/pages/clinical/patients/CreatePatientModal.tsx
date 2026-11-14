import { useCreatePatient } from '../../../clinical/patients-api';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import type { EntityModal } from '../../../components/crud/use-entity-modal';
import { PatientEditableFields } from '../../../profile/PatientEditableFields';
import { AccountFields } from '../../../components/account/AccountFields';
import { toCreatePatientRequest, type CreatePatientFormValues } from './create-patient-request';

/** Modal "Thêm bệnh nhân" (POST /doctor/patients/create): tài khoản kèm hồ sơ bệnh nhân. */
export function CreatePatientModal({
  modal,
}: {
  modal: EntityModal<CreatePatientFormValues, never>;
}) {
  const create = useCreatePatient();
  return (
    <EntityFormModal<CreatePatientFormValues, never>
      modal={modal}
      formName="patient"
      entityName="bệnh nhân"
      saving={create.isPending}
      createOnly
      onCreate={(values) => create.mutateAsync(toCreatePatientRequest(values))}
    >
      <AccountFields withCredentials />
      <PatientEditableFields />
    </EntityFormModal>
  );
}
