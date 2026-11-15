import type { QuestionData, TemplateSectionDetail } from '@drmayday/shared';
import { Form, type FormInstance } from 'antd';
import { useState } from 'react';
import { nextOrder } from './mapping';
import { toQuestionFormValues, type QuestionFormValues } from './question-payload';

/** Drawer đang tạo câu hỏi trong một section, hoặc đang sửa một câu hỏi; null = đóng. */
export type QuestionTarget =
  { kind: 'create'; section: TemplateSectionDetail } | { kind: 'edit'; question: QuestionData };

export interface QuestionDrawerState {
  form: FormInstance<QuestionFormValues>;
  target: QuestionTarget | null;
  openCreate: (section: TemplateSectionDetail) => void;
  openEdit: (question: QuestionData) => void;
  close: () => void;
}

/** Trạng thái mở/đóng và form của QuestionDrawer; mỗi lần mở đều reset rồi nạp giá trị ban đầu. */
export function useQuestionDrawerState(): QuestionDrawerState {
  const [form] = Form.useForm<QuestionFormValues>();
  const [target, setTarget] = useState<QuestionTarget | null>(null);

  function open(next: QuestionTarget) {
    form.resetFields();
    form.setFieldsValue(
      next.kind === 'edit'
        ? toQuestionFormValues(next.question, 0)
        : toQuestionFormValues(null, nextOrder(next.section.questions)),
    );
    setTarget(next);
  }

  return {
    form,
    target,
    openCreate: (section) => open({ kind: 'create', section }),
    openEdit: (question) => open({ kind: 'edit', question }),
    close: () => setTarget(null),
  };
}
