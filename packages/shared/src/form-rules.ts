import type {
  ClassifyQuestion,
  ClassifyRequest,
  MedicalRecordStatus,
} from './contracts/medical-records.js';
import type { FilledBy, QuestionData, TemplateSectionDetail } from './contracts/templates.js';
import type { FormState } from './form-answers.js';
import type { AnswerValue } from './form-tree.js';
import { isValidIsoDate } from './validators.js';

/** Section mà bệnh nhân được điền. */
export const PATIENT_FILLED_BY: readonly FilledBy[] = ['patient', 'patdoc'];

export function isPatientSection(section: Pick<TemplateSectionDetail, 'filled_by'>): boolean {
  return section.filled_by !== null && PATIENT_FILLED_BY.includes(section.filled_by);
}

/** Kiểu câu hỏi tải ảnh (làm ở giai đoạn 5): chưa có ô nhập nên không bắt buộc. */
export const IMAGE_QUESTION_TYPES: readonly QuestionData['type_question'][] = [
  'image_upload',
  'mix_text_image',
];

export const MEDICAL_RECORD_STATUS_LABELS: Record<MedicalRecordStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ tiếp nhận',
  in_progress: 'Đang khám',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
};

/** Bệnh nhân chỉ ghi và huỷ được khi bệnh án còn ở nháp hoặc chờ tiếp nhận. */
export function isPatientEditableStatus(status: MedicalRecordStatus): boolean {
  return status === 'draft' || status === 'pending';
}

function isEmpty(value: AnswerValue): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return typeof value !== 'string' || value.trim() === '';
}

/** Lỗi của một câu hỏi (tiếng Việt) hoặc null nếu hợp lệ. */
export function validateQuestion(question: QuestionData, value: AnswerValue): string | null {
  if (question.type_question === 'group_questions') return null;
  if (IMAGE_QUESTION_TYPES.includes(question.type_question)) return null;
  if (isEmpty(value)) return question.is_required === '1' ? 'Vui lòng trả lời câu hỏi này' : null;
  if (question.type_question === 'number' && !Number.isFinite(Number(value))) {
    return 'Vui lòng nhập một số';
  }
  if (question.type_question === 'date' && !isValidIsoDate(value)) {
    return 'Ngày không đúng định dạng (VD: 2026-11-15)';
  }
  return null;
}

/** Lỗi theo question_id, chỉ xét các câu hỏi được truyền vào (thường là câu đang hiển thị). */
export function validateFormState(
  questions: readonly QuestionData[],
  state: FormState,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const question of questions) {
    const error = validateQuestion(question, state[question.question_id]);
    if (error) errors[question.question_id] = error;
  }
  return errors;
}

/**
 * Trạng thái form phân loại → `answers` của POST /medical_records/classify.
 * API nhận một option_value cho mỗi phần tử, nên câu checkbox được gửi thành nhiều phần tử
 * cùng question_id (mỗi giá trị được chọn một phần tử). Câu chưa trả lời bị bỏ qua.
 */
export function classifyAnswersFromState(
  questions: readonly ClassifyQuestion[],
  state: FormState,
): ClassifyRequest['answers'] {
  return questions.flatMap((question) => {
    const value = state[question.question_id];
    const values = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
    return values.map((option_value) => ({ question_id: question.question_id, option_value }));
  });
}
