/** Kiểu câu hỏi theo enum questions.type_question (tài liệu CSDL, đã gồm track changes). */
export const QUESTION_TYPES = [
  'text',
  'number',
  'date',
  'radio',
  'checkbox',
  'image_upload',
  'group_questions',
  'mix_text_image',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
/** Kiểu câu hỏi bắt buộc có lựa chọn (Sheet ques01: "Nếu type là radio/checkbox"). */
export const CHOICE_QUESTION_TYPES: readonly QuestionType[] = ['radio', 'checkbox'];

export const FILLED_BY_VALUES = ['patient', 'doctor', 'patdoc'] as const;
export type FilledBy = (typeof FILLED_BY_VALUES)[number];

/** Cờ dạng chuỗi theo Sheet ("0" hoặc "1"). */
export type Flag = '0' | '1';
/** Mã định danh code_template / question_id (VD TMPL_URT, Q_ITCH_LEVEL). */
export const CODE_PATTERN = /^[A-Z0-9_]+$/;

/** GET /api/v1/templates/all phần tử (total nằm ngoài data). */
export interface TemplateSummary {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: Flag;
  created_at: string;
}

/** data của POST /templates (1001) và PUT /templates/:id. */
export interface TemplateData extends TemplateSummary {
  updated_at: string;
}

export interface CreateTemplateRequest {
  code_template: string;
  name: string;
  description?: string;
  version?: string;
  is_active?: Flag;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string | null;
  version?: string;
  is_active?: Flag;
}

export interface TemplateListQuery {
  page?: number;
  limit?: number;
  is_active?: Flag;
}

/** data của POST /templates/:template_id/sections và PUT /templates/sections/:id. */
export interface SectionData {
  section_id: string;
  template_id: string;
  title: string;
  order: string;
  is_required: Flag;
  filled_by: FilledBy | null;
}

export interface CreateSectionRequest {
  title: string;
  order: string | number;
  is_required?: Flag;
  filled_by?: FilledBy;
}

export type UpdateSectionRequest = Partial<CreateSectionRequest>;

export interface OptionData {
  id: string;
  option_text: string;
  option_value: string;
  order: string;
  trigger_image_upload: Flag;
}

/** Lựa chọn gửi lên: có id = sửa lựa chọn cũ (chỉ PUT), không có id = tạo mới. */
export interface OptionInput {
  id?: string;
  option_text: string;
  option_value: string;
  order: string | number;
  trigger_image_upload?: Flag;
}

/** Dạng câu hỏi đầy đủ (MT-22): data của POST/PUT câu hỏi và phần tử trong chi tiết mẫu. */
export interface QuestionData {
  question_id: string;
  section_id: string;
  question_text: string;
  type_question: QuestionType;
  placeholder: string | null;
  order: string;
  is_required: Flag;
  parent_question_id: string | null;
  /** Đã parse: mảng option_value của câu hỏi cha (MT-69). */
  show_if_answer: string[] | null;
  help_text: string | null;
  allow_image: Flag;
  options: OptionData[];
}

export interface CreateQuestionRequest {
  question_id: string;
  question_text: string;
  type_question: QuestionType;
  order: string | number;
  placeholder?: string;
  is_required?: Flag;
  parent_question_id?: string;
  /** Chuỗi JSON, VD '["YES"]'. */
  show_if_answer?: string;
  help_text?: string;
  allow_image?: Flag;
  options?: Omit<OptionInput, 'id'>[];
}

/** options (nếu gửi) là danh sách đầy đủ sau khi sửa (upsert + xoá phần còn lại). */
export interface UpdateQuestionRequest {
  question_text?: string;
  type_question?: QuestionType;
  placeholder?: string | null;
  order?: string | number;
  is_required?: Flag;
  parent_question_id?: string | null;
  show_if_answer?: string | null;
  help_text?: string | null;
  allow_image?: Flag;
  options?: OptionInput[];
}

export interface TemplateSectionDetail extends Omit<SectionData, 'template_id'> {
  questions: QuestionData[];
}

/** GET /api/v1/templates/:id — toàn bộ cây biểu mẫu. */
export interface TemplateDetailData extends TemplateData {
  sections: TemplateSectionDetail[];
}
