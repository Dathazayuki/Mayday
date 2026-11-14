import type { TemplateSectionDetail } from '@drmayday/shared';
import { Form, Input, InputNumber, Select, Switch } from 'antd';
import { EntityFormModal } from '../../../admin/EntityFormModal';
import { useCreateSection, useUpdateSection } from '../../../admin/templates-api';
import type { EntityModal } from '../../../admin/use-entity-modal';
import { toSectionRequest, type SectionFormValues } from './section-payload';
import { FILLED_BY_OPTIONS } from './template-labels';

/** Modal "Thêm section" / "Sửa section" của một mẫu phiếu. */
export function SectionFormModal({
  modal,
  templateCode,
}: {
  modal: EntityModal<SectionFormValues, TemplateSectionDetail>;
  templateCode: string;
}) {
  const create = useCreateSection();
  const update = useUpdateSection();

  return (
    <EntityFormModal<SectionFormValues, TemplateSectionDetail>
      modal={modal}
      formName="section"
      entityName="section"
      saving={create.isPending || update.isPending}
      onCreate={(values) =>
        create.mutateAsync({ code: templateCode, body: toSectionRequest(values) })
      }
      onUpdate={(section, values) =>
        update.mutateAsync({ id: section.section_id, changes: toSectionRequest(values) })
      }
    >
      <Form.Item
        label="Tiêu đề"
        name="title"
        rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tiêu đề' }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Thứ tự"
        name="order"
        rules={[{ required: true, message: 'Vui lòng nhập thứ tự' }]}
      >
        <InputNumber min={0} precision={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="Người điền" name="filled_by">
        <Select allowClear placeholder="Chưa chọn" options={FILLED_BY_OPTIONS} />
      </Form.Item>
      <Form.Item label="Bắt buộc" name="is_required" valuePropName="checked">
        <Switch />
      </Form.Item>
    </EntityFormModal>
  );
}
