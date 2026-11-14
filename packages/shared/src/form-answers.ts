import type { AnswerData, AnswerInput } from './contracts/medical-records.js';
import type { QuestionData } from './contracts/templates.js';
import {
  buildQuestionTree,
  isQuestionVisible,
  type AnswerValue,
  type QuestionNode,
} from './form-tree.js';

/** Trạng thái form: radio/text/date/number → chuỗi, checkbox → mảng option_value. */
export type FormState = Record<string, AnswerValue>;

const IGNORED_TYPES = new Set(['image_upload', 'group_questions']);

/** Câu trả lời từ API → trạng thái form (bỏ câu không thuộc mẫu và câu không có giá trị). */
export function answersToState(
  questions: readonly QuestionData[],
  answers: readonly AnswerData[],
): FormState {
  const byId = new Map(questions.map((q) => [q.question_id, q]));
  const state: FormState = {};
  for (const answer of answers) {
    const question = byId.get(answer.question_id);
    if (!question || IGNORED_TYPES.has(question.type_question)) continue;
    const value = toStateValue(question, answer);
    if (value !== undefined) state[question.question_id] = value;
  }
  return state;
}

function toStateValue(question: QuestionData, answer: AnswerData): AnswerValue {
  switch (question.type_question) {
    case 'radio': {
      if (typeof answer.answer_value === 'string') return answer.answer_value;
      const option = question.options.find((o) => Number(o.id) === answer.question_option_id);
      return option?.option_value;
    }
    case 'checkbox':
      return Array.isArray(answer.answer_value)
        ? answer.answer_value.filter((v): v is string => typeof v === 'string')
        : undefined;
    case 'number':
      return typeof answer.answer_value === 'number' ? String(answer.answer_value) : undefined;
    default:
      return answer.answer_text ?? undefined;
  }
}

/** Các câu hỏi đang hiển thị theo trạng thái hiện tại (duyệt cây, dừng ở nút bị ẩn). */
export function collectVisibleQuestions(
  questions: readonly QuestionData[],
  state: FormState,
): QuestionData[] {
  const visible: QuestionData[] = [];
  const walk = (nodes: QuestionNode[]) => {
    for (const node of nodes) {
      if (!isQuestionVisible(node.question, state)) continue;
      visible.push(node.question);
      walk(node.children);
    }
  };
  walk(buildQuestionTree(questions));
  return visible;
}

/** Trạng thái form → câu trả lời gửi API, chỉ cho các câu hỏi được truyền vào (thường là câu đang hiển thị). */
export function stateToAnswerInputs(
  questions: readonly QuestionData[],
  state: FormState,
): AnswerInput[] {
  const inputs: AnswerInput[] = [];
  for (const question of questions) {
    if (IGNORED_TYPES.has(question.type_question)) continue;
    const input = toAnswerInput(question, state[question.question_id]);
    if (input) inputs.push(input);
  }
  return inputs;
}

function toAnswerInput(question: QuestionData, value: AnswerValue): AnswerInput | undefined {
  const { question_id } = question;
  switch (question.type_question) {
    case 'radio': {
      const option =
        typeof value === 'string'
          ? question.options.find((o) => o.option_value === value)
          : undefined;
      return option
        ? { question_id, question_option_id: Number(option.id), answer_value: option.option_value }
        : undefined;
    }
    case 'checkbox':
      return Array.isArray(value) && value.length > 0
        ? { question_id, answer_value: [...value] }
        : undefined;
    case 'number': {
      const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
      return Number.isFinite(number) ? { question_id, answer_value: number } : undefined;
    }
    default:
      return typeof value === 'string' && value.trim() !== ''
        ? { question_id, answer_text: value.trim() }
        : undefined;
  }
}
