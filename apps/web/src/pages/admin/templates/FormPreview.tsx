import {
  buildQuestionTree,
  isQuestionVisible,
  type AnswerValue,
  type QuestionData,
  type QuestionNode,
  type TemplateDetailData,
} from '@drmayday/shared';
import { Button, Card, Checkbox, DatePicker, Drawer, Input, InputNumber, Radio } from 'antd';
import { useState } from 'react';

type Answers = Record<string, AnswerValue>;

/** Ô trả lời của một câu hỏi: chỉ radio/checkbox bấm được (để thử rẽ nhánh), các kiểu khác chỉ hiển thị. */
function PreviewControl({
  question,
  answer,
  onAnswer,
}: {
  question: QuestionData;
  answer: AnswerValue;
  onAnswer: (value: AnswerValue) => void;
}) {
  const options = question.options.map((o) => ({ value: o.option_value, label: o.option_text }));
  switch (question.type_question) {
    case 'radio':
      return (
        <Radio.Group
          options={options}
          value={typeof answer === 'string' ? answer : undefined}
          onChange={(e) => onAnswer(e.target.value as string)}
        />
      );
    case 'checkbox':
      return (
        <Checkbox.Group
          options={options}
          value={Array.isArray(answer) ? [...answer] : []}
          onChange={(values) => onAnswer(values as string[])}
        />
      );
    case 'number':
      return <InputNumber disabled placeholder={question.placeholder ?? undefined} />;
    case 'date':
      return <DatePicker disabled />;
    case 'image_upload':
      return <Button disabled>Tải ảnh</Button>;
    case 'mix_text_image':
      return (
        <>
          <Input disabled placeholder={question.placeholder ?? undefined} />
          <Button disabled style={{ marginTop: 8 }}>
            Tải ảnh
          </Button>
        </>
      );
    case 'text':
      return <Input disabled placeholder={question.placeholder ?? undefined} />;
    case 'group_questions':
      return null;
  }
}

/** Duyệt cây từ gốc và dừng ở nút bị ẩn: câu hỏi con của câu bị ẩn cũng không hiện. */
function PreviewTree({
  nodes,
  answers,
  onAnswer,
}: {
  nodes: QuestionNode[];
  answers: Answers;
  onAnswer: (questionId: string, value: AnswerValue) => void;
}) {
  return nodes
    .filter(({ question }) => isQuestionVisible(question, answers))
    .map(({ question, children }) => (
      <div key={question.question_id} style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 4 }}>
          <strong>{question.question_text}</strong>
          {question.is_required === '1' && <span style={{ color: 'red' }}> *</span>}
        </div>
        {question.help_text && <div style={{ opacity: 0.65 }}>{question.help_text}</div>}
        <PreviewControl
          question={question}
          answer={answers[question.question_id]}
          onAnswer={(value) => onAnswer(question.question_id, value)}
        />
        {children.length > 0 && (
          <div style={{ marginLeft: 24, marginTop: 12 }}>
            <PreviewTree nodes={children} answers={answers} onAnswer={onAnswer} />
          </div>
        )}
      </div>
    ));
}

function PreviewBody({ template }: { template: TemplateDetailData }) {
  const [answers, setAnswers] = useState<Answers>({});
  const onAnswer = (questionId: string, value: AnswerValue) =>
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

  return template.sections.map((section) => (
    <Card key={section.section_id} size="small" title={section.title} style={{ marginBottom: 16 }}>
      <PreviewTree
        nodes={buildQuestionTree(section.questions)}
        answers={answers}
        onAnswer={onAnswer}
      />
    </Card>
  ));
}

/**
 * Xem trước phiếu ở chế độ chỉ đọc: người thiết kế bấm thử đáp án để xem câu hỏi con hiện/ẩn.
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
