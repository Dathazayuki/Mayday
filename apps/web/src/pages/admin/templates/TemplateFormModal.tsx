import type { TemplateSummary } from '@drmayday/shared';
import { Form, Input, Select } from 'antd';
import { EntityFormModal } from '../../../admin/EntityFormModal';
import { useCreateTemplate, useUpdateTemplate } from '../../../admin/templates-api';
import type { EntityModal } from '../../../admin/use-entity-modal';
import { codeRules } from './code-rules';
import { TEMPLATE_STATUS_OPTIONS, type TemplateFormValues } from './template-form';

/** Modal "Thêm mẫu phiếu" / "Sửa mẫu phiếu": mã mẫu chỉ nhập khi tạo, không đổi được sau đó. */
export function TemplateFormModal({
  modal,
}: {
  modal: EntityModal<TemplateFormValues, TemplateSummary>;
}) {
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const description = (values: TemplateFormValues) => values.description?.trim() ?? '';

  return (
    <EntityFormModal<TemplateFormValues, TemplateSummary>
      modal={modal}
      formName="template"
      entityName="mẫu phiếu"
      saving={create.isPending || update.isPending}
      onCreate={(values) =>
        create.mutateAsync({
          code_template: values.code_template.trim(),
          name: values.name.trim(),
          ...(description(values) && { description: description(values) }),
          version: values.version.trim(),
          is_active: values.is_active,
        })
      }
      onUpdate={(template, values) =>
        update.mutateAsync({
          code: template.code_template,
          changes: {
            name: values.name.trim(),
            description: description(values) || null,
            version: values.version.trim(),
            is_active: values.is_active,
          },
        })
      }
    >
      <Form.Item label="Mã mẫu phiếu" name="code_template" rules={codeRules('mã mẫu phiếu', 255)}>
        <Input placeholder="VD: TMPL_URT" disabled={modal.editing !== 'new'} />
      </Form.Item>
      <Form.Item
        label="Tên mẫu phiếu"
        name="name"
        rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên mẫu phiếu' }]}
      >
        <Input />
      </Form.Item>
      <Form.Item label="Mô tả" name="description">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item
        label="Phiên bản"
        name="version"
        rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập phiên bản' }]}
      >
        <Input />
      </Form.Item>
      <Form.Item label="Trạng thái" name="is_active">
        <Select options={TEMPLATE_STATUS_OPTIONS} />
      </Form.Item>
    </EntityFormModal>
  );
}
