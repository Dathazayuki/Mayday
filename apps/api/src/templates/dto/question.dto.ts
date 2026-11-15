import {
  QUESTION_TYPES,
  type CreateQuestionRequest,
  type Flag,
  type OptionInput,
  type QuestionType,
  type UpdateQuestionRequest,
} from '@drmayday/shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { isPresent } from '../../common/is-present.js';
import {
  CodeRule,
  FlagRule,
  LongTextRule,
  NonBlankLongTextRule,
  NonBlankTextRule,
  OPTION_VALUE_MAX_LENGTH,
  OrderRule,
  QUESTION_ID_MAX_LENGTH,
  ShowIfAnswerRule,
  TextRule,
  VARCHAR_MAX_LENGTH,
} from './field-rules.js';

/** Lựa chọn khi tạo câu hỏi: trigger_image_upload mặc định "0". */
export class OptionDto implements Omit<OptionInput, 'id'> {
  @IsDefined()
  @NonBlankTextRule(VARCHAR_MAX_LENGTH)
  option_text: string;

  @IsDefined()
  @NonBlankTextRule(OPTION_VALUE_MAX_LENGTH)
  option_value: string;

  @IsDefined()
  @OrderRule()
  order: string | number;

  @ValidateIf(isPresent)
  @FlagRule()
  trigger_image_upload?: Flag;
}

/**
 * Lựa chọn trong PUT câu hỏi: có `id` (chuỗi chữ số) = sửa lựa chọn cũ của câu hỏi, không có = tạo
 * mới. id có thuộc câu hỏi hay không do QuestionsService kiểm tra (2003).
 */
export class OptionUpsertDto extends OptionDto implements OptionInput {
  @ValidateIf(isPresent)
  @IsString()
  @Matches(/^\d+$/)
  id?: string;
}

/**
 * POST /templates/sections/:section_id/questions (ques01). Ràng buộc giữa các trường do
 * QuestionsService kiểm tra.
 */
export class CreateQuestionDto implements CreateQuestionRequest {
  @IsDefined()
  @CodeRule(QUESTION_ID_MAX_LENGTH)
  question_id: string;

  @IsDefined()
  @NonBlankLongTextRule()
  question_text: string;

  @IsDefined()
  @IsIn(QUESTION_TYPES)
  type_question: QuestionType;

  @IsDefined()
  @OrderRule()
  order: string | number;

  @IsOptional()
  @TextRule(VARCHAR_MAX_LENGTH)
  placeholder?: string;

  @ValidateIf(isPresent)
  @FlagRule()
  is_required?: Flag;

  @IsOptional()
  @CodeRule(QUESTION_ID_MAX_LENGTH)
  parent_question_id?: string;

  @IsOptional()
  @ShowIfAnswerRule()
  show_if_answer?: string;

  @IsOptional()
  @LongTextRule()
  help_text?: string;

  @ValidateIf(isPresent)
  @FlagRule()
  allow_image?: Flag;

  @ValidateIf(isPresent)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];
}

/**
 * PUT /templates/questions/:id (ques02, MT-38): ít nhất một trường (2001); null xoá placeholder,
 * help_text, câu hỏi cha, show_if_answer. `options` là danh sách đầy đủ sau khi sửa.
 */
export class UpdateQuestionDto implements UpdateQuestionRequest {
  @ValidateIf(isPresent)
  @NonBlankLongTextRule()
  question_text?: string;

  @ValidateIf(isPresent)
  @IsIn(QUESTION_TYPES)
  type_question?: QuestionType;

  @IsOptional()
  @TextRule(VARCHAR_MAX_LENGTH)
  placeholder?: string | null;

  @ValidateIf(isPresent)
  @OrderRule()
  order?: string | number;

  @ValidateIf(isPresent)
  @FlagRule()
  is_required?: Flag;

  @IsOptional()
  @CodeRule(QUESTION_ID_MAX_LENGTH)
  parent_question_id?: string | null;

  @IsOptional()
  @ShowIfAnswerRule()
  show_if_answer?: string | null;

  @IsOptional()
  @LongTextRule()
  help_text?: string | null;

  @ValidateIf(isPresent)
  @FlagRule()
  allow_image?: Flag;

  @ValidateIf(isPresent)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionUpsertDto)
  options?: OptionUpsertDto[];
}
