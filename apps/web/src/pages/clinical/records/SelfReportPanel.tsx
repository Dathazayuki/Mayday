import type { MedicalRecordData } from '@drmayday/shared';
import { useUpdateMedicalRecord } from '../../../clinical/medical-records-api';
import { recordChanges, selfReportBlock } from '../../../clinical/record-blocks';
import { ClinicalPanel } from './ClinicalPanel';

/**
 * Panel "Bệnh nhân tự khai" (khối `self_report`, D-B31, spec B mục 8.7): 4 biến "App BN (BS sửa)", biểu
 * hiện bệnh chỉ ở hồ sơ mạn. Nhân viên sửa theo luật của nhân viên (`edit` của `allowed_actions`).
 */
export function SelfReportPanel({ record }: { record: MedicalRecordData }) {
  const update = useUpdateMedicalRecord();
  const blocks = [selfReportBlock(record)];
  return (
    <ClinicalPanel
      title="Bệnh nhân tự khai"
      note="Bệnh nhân sửa được tới khi tiếp nhận"
      formName="record-self-report"
      blocks={blocks}
      editable={record.allowed_actions.includes('edit')}
      toChanges={recordChanges}
      onSave={(body) => update.mutateAsync({ id: record.medical_record_id, body })}
    />
  );
}
