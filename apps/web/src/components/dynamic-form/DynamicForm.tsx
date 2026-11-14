import {
  buildQuestionTree,
  FILLED_BY_VALUES,
  isQuestionVisible,
  questionAcceptsImages,
  type FilledBy,
  type FormState,
  type QuestionNode,
  type TemplateDetailData,
  type TemplateSectionDetail,
} from '@drmayday/shared';
import { Card } from 'antd';
import { AnswerImages } from './AnswerImages';
import { QuestionControl } from './QuestionControl';

export interface DynamicFormProps {
  template: TemplateDetailData;
  value: FormState;
  onChange: (next: FormState) => void;
  /** Khoá toàn bộ form (bệnh án đã chốt/huỷ). */
  readOnly?: boolean;
  /** Các `filled_by` được sửa; section thuộc giá trị khác chỉ đọc. Mặc định: tất cả. */
  editableFilledBy?: readonly FilledBy[];
  /** answer_id theo question_id: câu có ảnh và đã có câu trả lời thì hiện ảnh (chỉ xem). */
  answerIdByQuestion?: Record<string, number>;
}

/** Section không khai `filled_by` không bị hạn chế theo người điền. */
function isSectionEditable(section: TemplateSectionDetail, editableFilledBy: readonly FilledBy[]) {
  return section.filled_by === null || editableFilledBy.includes(section.filled_by);
}

function QuestionTree({
  nodes,
  value,
  disabled,
  answerIdByQuestion,
  onAnswer,
}: {
  nodes: QuestionNode[];
  value: FormState;
  disabled: boolean;
  answerIdByQuestion?: Record<string, number>;
  onAnswer: (questionId: string, answer: FormState[string]) => void;
}) {
  // Dừng ở nút bị ẩn: câu con của câu bị ẩn cũng không hiện.
  return nodes
    .filter(({ question }) => isQuestionVisible(question, value))
    .map(({ question, children }) => {
      const inputId = `question-${question.question_id}`;
      return (
        <div key={question.question_id} style={{ marginBottom: 16 }}>
          <label htmlFor={inputId} style={{ display: 'block', marginBottom: 4 }}>
            <strong>{question.question_text}</strong>
            {question.is_required === '1' && <span style={{ color: 'red' }}> *</span>}
          </label>
          {question.help_text && <div style={{ opacity: 0.65 }}>{question.help_text}</div>}
          <QuestionControl
            question={question}
            inputId={inputId}
            value={value[question.question_id]}
            disabled={disabled}
            onChange={(answer) => onAnswer(question.question_id, answer)}
          />
          {questionAcceptsImages(question) && (
            <AnswerImages
              answerId={answerIdByQuestion?.[question.question_id]}
              options={question.options}
            />
          )}
          {children.length > 0 && (
            <div style={{ marginLeft: 24, marginTop: 12 }}>
              <QuestionTree
                nodes={children}
                value={value}
                disabled={disabled}
                answerIdByQuestion={answerIdByQuestion}
                onAnswer={onAnswer}
              />
            </div>
          )}
        </div>
      );
    });
}

/** Hiển thị phiếu khám theo cây câu hỏi; ô nhập chỉ sửa được ở section thuộc `editableFilledBy`. */
export function DynamicForm({
  template,
  value,
  onChange,
  readOnly = false,
  editableFilledBy = FILLED_BY_VALUES,
  answerIdByQuestion,
}: DynamicFormProps) {
  const onAnswer = (questionId: string, answer: FormState[string]) =>
    onChange({ ...value, [questionId]: answer });

  return template.sections.map((section) => (
    <Card key={section.section_id} size="small" title={section.title} style={{ marginBottom: 16 }}>
      <QuestionTree
        nodes={buildQuestionTree(section.questions)}
        value={value}
        disabled={readOnly || !isSectionEditable(section, editableFilledBy)}
        answerIdByQuestion={answerIdByQuestion}
        onAnswer={onAnswer}
      />
    </Card>
  ));
}
