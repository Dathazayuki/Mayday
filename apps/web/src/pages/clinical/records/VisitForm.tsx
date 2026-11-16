import type { RecordType, VisitData } from '@drmayday/shared';
import { Button } from 'antd';
import { useState } from 'react';
import { initialFormValues, type ClinicalBlock } from '../../../clinical/clinical-form';
import { visitBlocks, visitChanges } from '../../../clinical/record-blocks';
import { useUpdateVisit } from '../../../clinical/visits-api';
import { ClinicalDescriptions } from './ClinicalDescriptions';
import { ClinicalFieldset } from './ClinicalFieldset';
import { ClinicalForm } from './ClinicalForm';
import { RoomField } from './RoomField';

/**
 * Một phiên khám trong panel "Phiên khám" (`VisitForm`, spec B mục 8.7): xem lõi (mục 3.5) và khối theo
 * loại (3.6 hoặc 3.7); "Sửa" khi `editable` (`edit_visits`) → form có thêm ô phòng khám, "Lưu" gửi
 * PATCH /visits/:id chỉ với trường đã đổi.
 */
export function VisitForm({
  visit,
  recordType,
  editable,
}: {
  visit: VisitData;
  recordType: RecordType;
  editable: boolean;
}) {
  const [editing, setEditing] = useState<{ blocks: ClinicalBlock[]; roomId: number | null } | null>(
    null,
  );
  const update = useUpdateVisit();
  const blocks = visitBlocks(visit, recordType);

  if (editing && editable) {
    // Dữ liệu chụp lúc bấm "Sửa" dùng cho cả giá trị ban đầu lẫn phép so sánh (dữ liệu tải lại giữa chừng không thành thay đổi).
    return (
      <ClinicalForm
        name={`visit-${visit.visit_id}`}
        initialValues={{
          ...initialFormValues(editing.blocks),
          room_id: editing.roomId ?? undefined,
        }}
        toChanges={(values) => visitChanges(editing.roomId, editing.blocks, values)}
        onSave={(body) => update.mutateAsync({ id: visit.visit_id, body })}
        onClose={() => setEditing(null)}
      >
        <RoomField />
        <ClinicalFieldset blocks={editing.blocks} />
      </ClinicalForm>
    );
  }
  return (
    <>
      {editable && (
        <div className="dm-visit__actions">
          <Button
            size="small"
            aria-label={`Sửa phiên khám lần ${visit.visit_number}`}
            onClick={() => setEditing({ blocks, roomId: visit.room_id })}
          >
            Sửa
          </Button>
        </div>
      )}
      <ClinicalDescriptions blocks={blocks} />
    </>
  );
}
