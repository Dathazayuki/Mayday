import {
  CHOICE_QUESTION_TYPES,
  type CreateQuestionRequest,
  type OptionInput,
  type QuestionData,
  type QuestionType,
  type UpdateQuestionRequest,
} from '@drmayday/shared';
import { fromFlag, toFlag } from './mapping';

/**
 * Chuyển đổi giữa giá trị form (số, boolean) và dạng của API mẫu phiếu (chuỗi, cờ "0"/"1"):
 * mọi chuyển đổi của màn hình thiết kế gom về file này.
 */

export interface OptionFormValue {
  /** Có khi là lựa chọn đã lưu: gửi lại id để server sửa thay vì xoá rồi tạo mới. */
  id?: string;
  option_text: string;
  option_value: string;
  trigger_image_upload: boolean;
}

export interface QuestionFormValues {
  question_id: string;
  question_text: string;
  type_question: QuestionType;
  order: number;
  placeholder?: string;
  help_text?: string;
  is_required: boolean;
  allow_image: boolean;
  parent_question_id?: string;
  /** option_value của câu hỏi cha làm câu hỏi này hiện ra. */
  trigger_values?: string[];
  options?: OptionFormValue[];
}

const isChoice = (type: QuestionType) => CHOICE_QUESTION_TYPES.includes(type);
const trimmed = (text: string | undefined) => text?.trim() ?? '';

/** show_if_answer gửi lên là chuỗi JSON mảng option_value của câu hỏi cha (MT-69). */
export function buildShowIfAnswer(values: readonly string[] | undefined): string | undefined {
  return values && values.length > 0 ? JSON.stringify(values) : undefined;
}

/** Thứ tự lựa chọn lấy theo vị trí trong bảng; chỉ khi sửa mới gửi lại id của lựa chọn cũ. */
function toOptionInputs(options: readonly OptionFormValue[] = [], keepIds: boolean): OptionInput[] {
  return options.map((option, index) => ({
    ...(keepIds && option.id !== undefined && { id: option.id }),
    option_text: option.option_text.trim(),
    option_value: option.option_value.trim(),
    order: String(index + 1),
    trigger_image_upload: toFlag(option.trigger_image_upload),
  }));
}

export function toCreateQuestionRequest(values: QuestionFormValues): CreateQuestionRequest {
  const showIf = values.parent_question_id ? buildShowIfAnswer(values.trigger_values) : undefined;
  const placeholder = trimmed(values.placeholder);
  const helpText = trimmed(values.help_text);
  return {
    question_id: values.question_id.trim(),
    question_text: values.question_text.trim(),
    type_question: values.type_question,
    order: String(values.order),
    is_required: toFlag(values.is_required),
    allow_image: toFlag(values.allow_image),
    ...(placeholder && { placeholder }),
    ...(helpText && { help_text: helpText }),
    ...(values.parent_question_id && { parent_question_id: values.parent_question_id }),
    ...(showIf && { show_if_answer: showIf }),
    ...(isChoice(values.type_question) && {
      options: toOptionInputs(values.options, false),
    }),
  };
}

/**
 * PUT gửi lại toàn bộ trường của form (trường để trống → null để xoá). `options` là danh sách đầy đủ
 * sau khi sửa; câu hỏi chuyển sang kiểu không có lựa chọn thì gửi [] để xoá lựa chọn cũ.
 */
export function toUpdateQuestionRequest(
  values: QuestionFormValues,
  original: QuestionData,
): UpdateQuestionRequest {
  const parent = values.parent_question_id ?? null;
  const showIf = parent ? buildShowIfAnswer(values.trigger_values) : undefined;
  let options: OptionInput[] | undefined;
  if (isChoice(values.type_question)) options = toOptionInputs(values.options, true);
  else if (original.options.length > 0) options = [];
  return {
    question_text: values.question_text.trim(),
    type_question: values.type_question,
    order: String(values.order),
    is_required: toFlag(values.is_required),
    allow_image: toFlag(values.allow_image),
    placeholder: trimmed(values.placeholder) || null,
    help_text: trimmed(values.help_text) || null,
    parent_question_id: parent,
    show_if_answer: showIf ?? null,
    ...(options && { options }),
  };
}

/** Giá trị ban đầu của form: câu hỏi cần sửa, hoặc mặc định khi tạo mới (order = thứ tự kế tiếp). */
export function toQuestionFormValues(
  question: QuestionData | null,
  nextOrder: number,
): QuestionFormValues {
  if (!question) {
    return {
      question_id: '',
      question_text: '',
      type_question: 'text',
      order: nextOrder,
      is_required: false,
      allow_image: false,
      options: [],
    };
  }
  return {
    question_id: question.question_id,
    question_text: question.question_text,
    type_question: question.type_question,
    order: Number(question.order),
    placeholder: question.placeholder ?? '',
    help_text: question.help_text ?? '',
    is_required: fromFlag(question.is_required),
    allow_image: fromFlag(question.allow_image),
    parent_question_id: question.parent_question_id ?? undefined,
    trigger_values: question.show_if_answer ?? [],
    options: question.options.map((option) => ({
      id: option.id,
      option_text: option.option_text,
      option_value: option.option_value,
      trigger_image_upload: fromFlag(option.trigger_image_upload),
    })),
  };
}
