import { Button } from 'antd';
import { useState, type ReactNode } from 'react';
import {
  initialFormValues,
  type ClinicalBlock,
  type ClinicalFormValues,
} from '../../../clinical/clinical-form';
import { Panel } from '../../../layout/Panel';
import { ClinicalDescriptions } from './ClinicalDescriptions';
import { ClinicalFieldset } from './ClinicalFieldset';
import { ClinicalForm } from './ClinicalForm';

/**
 * Panel lâm sàng của màn chi tiết (spec B, mục 8.7): chế độ xem (`Descriptions`); nút "Sửa" ở `extra` khi
 * `editable` (có `edit` trong `allowed_actions`) → form dựng từ bộ mô tả, "Lưu" gửi PATCH chỉ với trường
 * đã đổi. Hồ sơ hoàn tất/đã huỷ không có `edit` nên chỉ có chế độ xem (kể cả khi đang sửa dở mà hồ sơ
 * vừa được hoàn tất hay huỷ).
 */
export function ClinicalPanel<T extends object>({
  title,
  note,
  formName,
  blocks,
  editable,
  toChanges,
  onSave,
}: {
  title: string;
  note?: ReactNode;
  formName: string;
  blocks: readonly ClinicalBlock[];
  editable: boolean;
  toChanges: (values: ClinicalFormValues) => T;
  onSave: (changes: T) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Panel
      role="region"
      aria-label={title}
      title={title}
      extra={
        editable && !editing ? (
          <Button size="small" aria-label={`Sửa ${title}`} onClick={() => setEditing(true)}>
            Sửa
          </Button>
        ) : null
      }
    >
      {note && <p className="dm-panel__note">{note}</p>}
      {editing && editable ? (
        <ClinicalForm
          name={formName}
          initialValues={initialFormValues(blocks)}
          toChanges={toChanges}
          onSave={onSave}
          onClose={() => setEditing(false)}
        >
          <ClinicalFieldset blocks={blocks} />
        </ClinicalForm>
      ) : (
        <ClinicalDescriptions blocks={blocks} />
      )}
    </Panel>
  );
}
