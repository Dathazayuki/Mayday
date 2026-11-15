import {
  CHOICE_QUESTION_TYPES,
  isValidShowIfAnswer,
  type TemplateSectionDetail,
} from '@drmayday/shared';
import { Button, Drawer, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import { useCreateQuestion, useUpdateQuestion } from '../../../admin/templates-api';
import { useRunAction } from '../../../components/crud/use-run-action';
import { codeRules } from './code-rules';
import { OptionsEditor } from './OptionsEditor';
import type { QuestionDrawerState } from './question-drawer-state';
import { parentCandidates } from './question-parents';
import {
  buildShowIfAnswer,
  toCreateQuestionRequest,
  toUpdateQuestionRequest,
  type QuestionFormValues,
} from './question-payload';
import { QUESTION_TYPE_OPTIONS } from './template-labels';

/** Drawer tạo/sửa câu hỏi: một form cho cả hai chế độ (mã câu hỏi chỉ nhập khi tạo). */
export function QuestionDrawer({
  drawer,
  sections,
}: {
  drawer: QuestionDrawerState;
  sections: TemplateSectionDetail[];
}) {
  const { form, target, close } = drawer;
  const create = useCreateQuestion();
  const update = useUpdateQuestion();
  const run = useRunAction();
  const type = Form.useWatch('type_question', form);
  const parentId = Form.useWatch('parent_question_id', form);

  const editing = target?.kind === 'edit' ? target.question : null;
  const candidates = parentCandidates(sections, editing?.question_id);
  const triggerOptions = (candidates.find((q) => q.question_id === parentId)?.options ?? []).map(
    (o) => ({ value: o.option_value, label: `${o.option_text} (${o.option_value})` }),
  );

  async function handleFinish(values: QuestionFormValues) {
    if (!target) return;
    const ok =
      target.kind === 'create'
        ? await run(
            () =>
              create.mutateAsync({
                sectionId: target.section.section_id,
                body: toCreateQuestionRequest(values),
              }),
            'Đã thêm câu hỏi',
          )
        : await run(
            () =>
              update.mutateAsync({
                id: target.question.question_id,
                changes: toUpdateQuestionRequest(values, target.question),
              }),
            'Đã cập nhật câu hỏi',
          );
    if (ok) close();
  }

  return (
    <Drawer
      title={editing ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
      open={target !== null}
      onClose={close}
      size={560}
      forceRender
      extra={
        <Space>
          <Button onClick={close}>Huỷ</Button>
          <Button
            type="primary"
            loading={create.isPending || update.isPending}
            onClick={() => form.submit()}
          >
            Lưu
          </Button>
        </Space>
      }
    >
      <Form<QuestionFormValues>
        name="question"
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleFinish}
      >
        <Form.Item label="Mã câu hỏi" name="question_id" rules={codeRules('mã câu hỏi', 50)}>
          <Input placeholder="VD: Q_ITCH_LEVEL" disabled={editing !== null} />
        </Form.Item>
        <Form.Item
          label="Nội dung câu hỏi"
          name="question_text"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập nội dung câu hỏi' }]}
        >
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item label="Loại câu hỏi" name="type_question">
          <Select options={QUESTION_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item
          label="Thứ tự"
          name="order"
          rules={[{ required: true, message: 'Vui lòng nhập thứ tự' }]}
        >
          <InputNumber min={0} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Gợi ý nhập" name="placeholder">
          <Input />
        </Form.Item>
        <Form.Item label="Hướng dẫn" name="help_text">
          <Input />
        </Form.Item>
        <Space size="large">
          <Form.Item label="Bắt buộc" name="is_required" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Cho phép kèm ảnh" name="allow_image" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
        {type && CHOICE_QUESTION_TYPES.includes(type) && (
          <Form.Item label="Lựa chọn" required>
            <OptionsEditor />
          </Form.Item>
        )}
        <Form.Item label="Câu hỏi cha" name="parent_question_id">
          <Select
            allowClear
            placeholder="Không có (câu hỏi gốc)"
            options={candidates.map((q) => ({
              value: q.question_id,
              label: `${q.question_id} - ${q.question_text}`,
            }))}
            onChange={() => form.setFieldValue('trigger_values', [])}
          />
        </Form.Item>
        <Form.Item
          label="Giá trị kích hoạt"
          name="trigger_values"
          extra="Câu hỏi này chỉ hiện khi câu trả lời của câu hỏi cha là một trong các giá trị đã chọn."
          rules={[
            {
              validator: (_, values: string[] | undefined) => {
                if (!parentId) return Promise.resolve();
                const raw = buildShowIfAnswer(values);
                return raw && isValidShowIfAnswer(raw)
                  ? Promise.resolve()
                  : Promise.reject(new Error('Chọn ít nhất 1 giá trị kích hoạt'));
              },
            },
          ]}
        >
          <Select mode="multiple" disabled={!parentId} options={triggerOptions} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
