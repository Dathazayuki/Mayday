import {
  RECORD_TYPE_LABELS,
  type MedicalRecordData,
  type MedicalRecordDetails,
  type UpdateMedicalRecordRequest,
} from '@drmayday/shared';
import { useUpdateMedicalRecord } from '../../../clinical/medical-records-api';
import { recordChanges, recordCoreBlock, recordTypeBlock } from '../../../clinical/record-blocks';
import { ClinicalPanel } from './ClinicalPanel';

/**
 * Panel "Hồ sơ" (trường lõi, mục 3.2, nhóm theo docs/04) và panel "Bệnh án mày đay cấp" (mục 3.3) hoặc
 * "Bệnh án mày đay mạn" (mục 3.4) của màn chi tiết (spec B, mục 8.7). Chỉ có ở dạng của nhân viên
 * (`details` khác null, D-B21).
 */
export function CaseFieldsPanel({
  record,
  details,
}: {
  record: MedicalRecordData;
  details: MedicalRecordDetails;
}) {
  const update = useUpdateMedicalRecord();
  const editable = record.allowed_actions.includes('edit');
  const save = (body: UpdateMedicalRecordRequest) =>
    update.mutateAsync({ id: record.medical_record_id, body });
  const core = [recordCoreBlock(record, details)];
  const typed = [recordTypeBlock(record.record_type, details)];
  return (
    <>
      <ClinicalPanel
        title="Hồ sơ"
        formName="record-core"
        blocks={core}
        editable={editable}
        toChanges={recordChanges}
        onSave={save}
      />
      <ClinicalPanel
        title={`Bệnh án ${RECORD_TYPE_LABELS[record.record_type].toLowerCase()}`}
        formName={`record-${record.record_type === 'CAP' ? 'acute' : 'chronic'}`}
        blocks={typed}
        editable={editable}
        toChanges={recordChanges}
        onSave={save}
      />
    </>
  );
}
