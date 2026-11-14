import { isValidIsoDate, type FormState, type QuestionData } from '@drmayday/shared';
import { Checkbox, Input, InputNumber, Radio, Typography } from 'antd';

type Value = FormState[string];

interface Props {
  question: QuestionData;
  /** id của ô nhập, khớp `htmlFor` của nhãn câu hỏi. */
  inputId: string;
  value: Value;
  disabled: boolean;
  onChange: (value: Value) => void;
}

/** Ô trả lời của một câu hỏi theo kiểu. Ngày là chuỗi YYYY-MM-DD, giống trang hồ sơ. */
export function QuestionControl({ question, inputId, value, disabled, onChange }: Props) {
  const text = typeof value === 'string' ? value : '';
  const placeholder = question.placeholder ?? undefined;

  switch (question.type_question) {
    case 'radio':
      return (
        <Radio.Group
          id={inputId}
          disabled={disabled}
          options={question.options.map((o) => ({ value: o.option_value, label: o.option_text }))}
          value={typeof value === 'string' ? value : undefined}
          onChange={(e) => onChange(e.target.value as string)}
        />
      );
    case 'checkbox':
      return (
        <div role="group" aria-label={question.question_text}>
          <Checkbox.Group
            disabled={disabled}
            options={question.options.map((o) => ({ value: o.option_value, label: o.option_text }))}
            value={Array.isArray(value) ? [...value] : []}
            onChange={(values) => onChange(values as string[])}
          />
        </div>
      );
    case 'number':
      return (
        <InputNumber
          id={inputId}
          stringMode
          disabled={disabled}
          placeholder={placeholder}
          style={{ width: '100%' }}
          value={text === '' ? null : text}
          onChange={(next) => onChange(next === null ? '' : String(next))}
        />
      );
    case 'date': {
      const invalid = text.trim() !== '' && !isValidIsoDate(text.trim());
      return (
        <>
          <Input
            id={inputId}
            disabled={disabled}
            placeholder="YYYY-MM-DD"
            status={invalid ? 'error' : undefined}
            value={text}
            onChange={(e) => onChange(e.target.value)}
          />
          {invalid && (
            <Typography.Text type="danger">Ngày không đúng định dạng YYYY-MM-DD</Typography.Text>
          )}
        </>
      );
    }
    // Ảnh của câu hỏi hiển thị bằng AnswerImages (web chỉ xem), nên câu image_upload không có ô nhập.
    case 'image_upload':
      return null;
    case 'mix_text_image':
    case 'text':
      return (
        <Input
          id={inputId}
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'group_questions':
      return null;
  }
}
