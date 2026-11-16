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
 * vừa được hoàn tất hay huỷ). Dữ liệu được chụp lại lúc bấm "Sửa" và dùng cho cả giá trị ban đầu lẫn phép
 * so sánh: dữ liệu tải lại giữa chừng không làm giá trị cũ của form bị coi là thay đổi.
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
  /** Body PATCH từ khối lúc bắt đầu sửa và giá trị form: chỉ trường đã đổi. */
  toChanges: (blocks: readonly ClinicalBlock[], values: ClinicalFormValues) => T;
  onSave: (changes: T) => Promise<unknown>;
}) {
  const [editBlocks, setEditBlocks] = useState<readonly ClinicalBlock[] | null>(null);
  return (
    <Panel
      role="region"
      aria-label={title}
      title={title}
      extra={
        editable && editBlocks === null ? (
          <Button size="small" aria-label={`Sửa ${title}`} onClick={() => setEditBlocks(blocks)}>
            Sửa
          </Button>
        ) : null
      }
    >
      {note && <p className="dm-panel__note">{note}</p>}
      {editBlocks && editable ? (
        <ClinicalForm
          name={formName}
          initialValues={initialFormValues(editBlocks)}
          toChanges={(values) => toChanges(editBlocks, values)}
          onSave={onSave}
          onClose={() => setEditBlocks(null)}
        >
          <ClinicalFieldset blocks={editBlocks} />
        </ClinicalForm>
      ) : (
        <ClinicalDescriptions blocks={blocks} />
      )}
    </Panel>
  );
}
