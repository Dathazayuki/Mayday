import type { PatientData } from '@drmayday/shared';
import { useUpdatePatient } from '../../../clinical/patients-api';
import { AccountFields } from '../../../components/account/AccountFields';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import type { EntityModal } from '../../../components/crud/use-entity-modal';
import { PatientEditableFields } from '../../../profile/PatientEditableFields';
import {
  buildProfileChanges,
  toFormValues,
  type ProfileFormValues,
} from '../../../profile/profile-form';

/**
 * Modal "Sửa bệnh nhân" (PUT /doctor/patients/:id, spec B mục 8.3): họ tên, giới tính và trường hồ sơ;
 * số điện thoại (tên đăng nhập) không đổi được. Chỉ gửi trường đã đổi so với lúc mở.
 */
export function EditPatientModal({
  modal,
}: {
  modal: EntityModal<ProfileFormValues, PatientData>;
}) {
  const update = useUpdatePatient();
  return (
    <EntityFormModal<ProfileFormValues, PatientData>
      modal={modal}
      formName="patient-edit"
      entityName="bệnh nhân"
      saving={update.isPending}
      updateOnly
      onUpdate={async (patient, values) => {
        const changes = buildProfileChanges(toFormValues(patient), values);
        // PUT cần ít nhất một trường (2001): không đổi gì thì chỉ đóng modal.
        if (Object.keys(changes).length > 0) {
          await update.mutateAsync({ id: patient.user_id, changes });
        }
      }}
    >
      <AccountFields withCredentials={false} />
      <PatientEditableFields />
    </EntityFormModal>
  );
}
