import type { FormState, TemplateDetailData } from '@drmayday/shared';
import { Drawer } from 'antd';
import { useState } from 'react';
import { DynamicForm } from '../../../components/dynamic-form/DynamicForm';

function PreviewBody({ template }: { template: TemplateDetailData }) {
  const [answers, setAnswers] = useState<FormState>({});
  return <DynamicForm template={template} value={answers} onChange={setAnswers} />;
}

/**
 * Xem trước phiếu bằng chính DynamicForm: người thiết kế bấm thử đáp án để xem câu hỏi con hiện/ẩn.
 * Đáp án chỉ lưu tạm trong Drawer, mở lại là bắt đầu lại.
 */
export function FormPreview({
  template,
  open,
  onClose,
}: {
  template: TemplateDetailData;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer
      title={`Xem trước: ${template.name}`}
      open={open}
      onClose={onClose}
      size={640}
      destroyOnHidden
    >
      <PreviewBody template={template} />
    </Drawer>
  );
}
