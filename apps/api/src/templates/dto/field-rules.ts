import { applyDecorators } from '@nestjs/common';
import { CODE_PATTERN, isValidShowIfAnswer, type Flag } from '@drmayday/shared';
import { IsByteLength, IsIn, IsString, Matches, MaxLength, ValidateBy } from 'class-validator';
import { MAX_INT } from '../../common/id.js';

/** Độ dài tối đa theo cột của CSDL (spec giai đoạn 3, mục 2). */
export const CODE_TEMPLATE_MAX_LENGTH = 255;
export const QUESTION_ID_MAX_LENGTH = 50;
/** Cột varchar(255): name, title, placeholder, option_text. */
export const VARCHAR_MAX_LENGTH = 255;
export const VERSION_MAX_LENGTH = 50;
export const OPTION_VALUE_MAX_LENGTH = 50;
/** Cột TEXT của MySQL chứa tối đa 65 535 byte (UTF-8). */
const TEXT_MAX_BYTES = 65_535;

const FLAGS: readonly Flag[] = ['0', '1'];
/** Chuỗi chỉ gồm chữ số thập phân: không dấu, không dạng 1.5, 1e2 hay có khoảng trắng. */
const DIGITS_PATTERN = /^\d+$/;

/** Cờ của Sheet: chỉ nhận "0"/"1", giá trị khác (kể cả số 0/1) → 2003 (spec mục 3.1). */
export const FlagRule = () => IsIn(FLAGS);

/** Mã định danh (code_template, question_id): A-Z 0-9 _, tối đa `maxLength` ký tự; sai → 2003. */
export const CodeRule = (maxLength: number) =>
  applyDecorators(IsString(), Matches(CODE_PATTERN), MaxLength(maxLength));

/** Cột varchar: chuỗi tối đa `maxLength` ký tự. */
export const TextRule = (maxLength: number) => applyDecorators(IsString(), MaxLength(maxLength));

/** Như TextRule, không chỉ gồm khoảng trắng (sai → 2003). */
export const NonBlankTextRule = (maxLength: number) =>
  applyDecorators(TextRule(maxLength), Matches(/\S/));

/** Cột TEXT: chuỗi không vượt dung lượng của cột (đếm theo byte UTF-8), vượt → 2003. */
export const LongTextRule = () => applyDecorators(IsString(), IsByteLength(0, TEXT_MAX_BYTES));

/** Như LongTextRule, không chỉ gồm khoảng trắng (sai → 2003). */
export const NonBlankLongTextRule = () => applyDecorators(LongTextRule(), Matches(/\S/));

/** `order`: số nguyên không âm (số hoặc chuỗi chữ số), không vượt INT của MySQL. */
function isOrder(value: unknown): boolean {
  if (typeof value === 'string' && !DIGITS_PATTERN.test(value)) return false;
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const order = Number(value);
  return Number.isInteger(order) && order >= 0 && order <= MAX_INT;
}

/** `order` nhận chuỗi số nguyên không âm hoặc số nguyên; sai → 2003 (spec mục 3.1). */
export const OrderRule = () => ValidateBy({ name: 'isOrder', validator: { validate: isOrder } });

/**
 * `show_if_answer`: chuỗi JSON là mảng option_value khác rỗng của câu hỏi cha (MT-69). Không phải
 * chuỗi → 2002; không parse được hoặc sai cấu trúc → 2003.
 */
export const ShowIfAnswerRule = () =>
  applyDecorators(
    IsString(),
    ValidateBy({
      name: 'isShowIfAnswer',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidShowIfAnswer(value),
      },
    }),
  );
