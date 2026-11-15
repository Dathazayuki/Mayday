import {
  FILLED_BY_VALUES,
  QUESTION_TYPES,
  type FilledBy,
  type QuestionType,
} from '@drmayday/shared';

/** Nhãn tiếng Việt của enum questions.type_question, một chỗ duy nhất cho cả bảng lẫn ô chọn. */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Văn bản',
  number: 'Số',
  date: 'Ngày',
  radio: 'Chọn một',
  checkbox: 'Chọn nhiều',
  image_upload: 'Tải ảnh',
  group_questions: 'Nhóm câu hỏi',
  mix_text_image: 'Văn bản + ảnh',
};

export const FILLED_BY_LABELS: Record<FilledBy, string> = {
  patient: 'Bệnh nhân',
  doctor: 'Bác sĩ',
  patdoc: 'Bệnh nhân và bác sĩ',
};

export const QUESTION_TYPE_OPTIONS = QUESTION_TYPES.map((value) => ({
  value,
  label: QUESTION_TYPE_LABELS[value],
}));

export const FILLED_BY_OPTIONS = FILLED_BY_VALUES.map((value) => ({
  value,
  label: FILLED_BY_LABELS[value],
}));
