import { CLINICAL_GROUP_LABELS } from '@drmayday/shared';
import { Descriptions } from 'antd';
import { formatClinicalValue } from '../../../clinical/clinical-display';
import {
  blockValue,
  clinicalSections,
  shownInView,
  type ClinicalBlock,
} from '../../../clinical/clinical-form';

/**
 * Chế độ xem của các khối (spec B, mục 8.7): `Descriptions` theo phân nhóm docs/04, ô trống hiện "—", ô
 * ghi rõ chỉ hiện khi cờ đang bật. Tiêu đề nhóm chỉ hiện khi có từ hai nhóm trở lên.
 */
export function ClinicalDescriptions({ blocks }: { blocks: readonly ClinicalBlock[] }) {
  const sections = clinicalSections(blocks);
  return sections.map((section) => (
    <section key={section.key} className="dm-clinical-group">
      {sections.length > 1 && (
        <h3 className="dm-clinical-group__title">{CLINICAL_GROUP_LABELS[section.group]}</h3>
      )}
      <Descriptions
        column={{ xs: 1, md: 2 }}
        bordered
        size="small"
        items={section.fields
          .filter((field) => shownInView(field, section.block))
          .map((field) => ({
            key: field.key,
            label: field.label,
            children: formatClinicalValue(field, blockValue(section.block, field)),
          }))}
      />
    </section>
  ));
}
