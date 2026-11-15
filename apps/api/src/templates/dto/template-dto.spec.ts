import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_INT } from '../../common/id.js';
import { validationErrorsToException } from '../../common/validation.js';
import { CreateQuestionDto, UpdateQuestionDto } from './question.dto.js';
import { CreateSectionDto, UpdateSectionDto } from './section.dto.js';
import { CreateTemplateDto, ListTemplatesQuery, UpdateTemplateDto } from './template.dto.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
async function codeFor<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

/** Như codeFor nhưng trả cả tên trường lỗi. */
async function errorFor<T extends object>(
  type: ClassConstructor<T>,
  body: Record<string, unknown>,
) {
  const { code, data } = validationErrorsToException(await validate(plainToInstance(type, body)));
  return { code, data };
}

/** Cột TEXT của MySQL chứa tối đa 65 535 byte. */
const TOO_LONG_TEXT = 'a'.repeat(65_536);

describe('CreateTemplateDto', () => {
  const valid = { code_template: 'TMPL_URT_2', name: 'Phiếu khám mề đay' };

  it('chỉ cần code_template và name; description, version, is_active không bắt buộc', async () => {
    expect(await codeFor(CreateTemplateDto, valid)).toBeNull();
    expect(
      await codeFor(CreateTemplateDto, {
        ...valid,
        description: 'Mô tả',
        version: '2.1',
        is_active: '0',
      }),
    ).toBeNull();
  });

  it.each([
    ['thiếu code_template', { code_template: undefined }, '2001'],
    ['code_template chữ thường', { code_template: 'tmpl_urt' }, '2003'],
    ['code_template có dấu cách', { code_template: 'TMPL URT' }, '2003'],
    ['code_template dài quá 255 ký tự', { code_template: 'A'.repeat(256) }, '2003'],
    ['code_template không phải chuỗi', { code_template: 12 }, '2002'],
    ['thiếu name', { name: undefined }, '2001'],
    ['name chỉ có khoảng trắng', { name: '   ' }, '2003'],
    ['name dài quá 255 ký tự', { name: 'a'.repeat(256) }, '2003'],
    ['description vượt dung lượng cột TEXT', { description: TOO_LONG_TEXT }, '2003'],
    ['version dài quá 50 ký tự', { version: '1'.repeat(51) }, '2003'],
    ['version null', { version: null }, '2001'],
    ['is_active ngoài "0"/"1"', { is_active: '2' }, '2003'],
    ['is_active là số', { is_active: 1 }, '2003'],
    ['is_active null', { is_active: null }, '2001'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateTemplateDto, { ...valid, ...override })).toBe(code);
  });

  it('description dài nhưng vừa cột TEXT (tính theo byte UTF-8) → hợp lệ; vượt → 2003', async () => {
    expect(
      await codeFor(CreateTemplateDto, { ...valid, description: 'a'.repeat(65_535) }),
    ).toBeNull();
    // "ạ" chiếm 3 byte: 21 846 ký tự = 65 538 byte.
    expect(await codeFor(CreateTemplateDto, { ...valid, description: 'ạ'.repeat(21_846) })).toBe(
      '2003',
    );
  });
});

describe('UpdateTemplateDto', () => {
  it('mọi trường không bắt buộc; description null xoá mô tả', async () => {
    expect(await codeFor(UpdateTemplateDto, {})).toBeNull();
    expect(await codeFor(UpdateTemplateDto, { description: null, is_active: '1' })).toBeNull();
  });

  it.each([
    ['name null', { name: null }, '2001'],
    ['name rỗng', { name: '' }, '2001'],
    ['version chỉ có khoảng trắng', { version: '  ' }, '2003'],
    ['is_active ngoài "0"/"1"', { is_active: 'x' }, '2003'],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeFor(UpdateTemplateDto, body)).toBe(code);
  });
});

describe('ListTemplatesQuery', () => {
  it('kế thừa phân trang; is_active vắng hoặc rỗng = không lọc', async () => {
    expect(plainToInstance(ListTemplatesQuery, {})).toMatchObject({ page: 1, limit: 20 });
    expect(plainToInstance(ListTemplatesQuery, { is_active: ' ' }).is_active).toBeUndefined();
    expect(await codeFor(ListTemplatesQuery, { is_active: '' })).toBeNull();
    expect(await codeFor(ListTemplatesQuery, { is_active: '0', page: '2' })).toBeNull();
  });

  it.each([
    ['is_active ngoài "0"/"1"', { is_active: 'true' }, '2003'],
    ['page 0', { page: '0' }, '2003'],
    ['limit không phải số', { limit: 'abc' }, '2002'],
  ])('%s → %s', async (_name, query, code) => {
    expect(await codeFor(ListTemplatesQuery, query)).toBe(code);
  });
});

describe('CreateSectionDto', () => {
  const valid = { title: 'Thông tin chung', order: '1' };

  it('title và order bắt buộc; order nhận chuỗi chữ số hoặc số nguyên không âm', async () => {
    expect(await codeFor(CreateSectionDto, valid)).toBeNull();
    expect(await codeFor(CreateSectionDto, { ...valid, order: 0 })).toBeNull();
    expect(await codeFor(CreateSectionDto, { ...valid, order: String(MAX_INT) })).toBeNull();
    expect(
      await codeFor(CreateSectionDto, { ...valid, is_required: '1', filled_by: 'patdoc' }),
    ).toBeNull();
  });

  it.each([
    ['thiếu title', { title: undefined }, '2001'],
    ['title chỉ có khoảng trắng', { title: ' ' }, '2003'],
    ['thiếu order', { order: undefined }, '2001'],
    ['order rỗng', { order: '' }, '2001'],
    ['order âm (chuỗi)', { order: '-1' }, '2003'],
    ['order âm (số)', { order: -1 }, '2003'],
    ['order không phải số', { order: 'abc' }, '2003'],
    ['order số thập phân', { order: 1.5 }, '2003'],
    ['order dạng 1e2', { order: '1e2' }, '2003'],
    ['order có khoảng trắng', { order: ' 1' }, '2003'],
    ['order vượt INT tối đa', { order: MAX_INT + 1 }, '2003'],
    ['order (chuỗi) vượt INT tối đa', { order: String(MAX_INT + 1) }, '2003'],
    ['order kiểu boolean', { order: true }, '2003'],
    ['is_required ngoài "0"/"1"', { is_required: '2' }, '2003'],
    ['filled_by ngoài patient/doctor/patdoc', { filled_by: 'nurse' }, '2003'],
    ['filled_by null', { filled_by: null }, '2001'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateSectionDto, { ...valid, ...override })).toBe(code);
  });
});

describe('UpdateSectionDto', () => {
  it('mọi trường không bắt buộc', async () => {
    expect(await codeFor(UpdateSectionDto, {})).toBeNull();
    expect(await codeFor(UpdateSectionDto, { order: 3, filled_by: 'doctor' })).toBeNull();
  });

  it.each([
    ['title null', { title: null }, '2001'],
    ['order sai', { order: 'x' }, '2003'],
    ['is_required là số', { is_required: 0 }, '2003'],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeFor(UpdateSectionDto, body)).toBe(code);
  });
});

describe('CreateQuestionDto', () => {
  const valid = {
    question_id: 'Q_ITCH_LEVEL',
    question_text: 'Mức độ ngứa?',
    type_question: 'radio',
    order: '2',
    options: [{ option_text: 'Nhẹ', option_value: 'MILD', order: '1' }],
  };

  it('hợp lệ với trường bắt buộc; trường tuỳ chọn đúng dạng', async () => {
    expect(await codeFor(CreateQuestionDto, valid)).toBeNull();
    expect(
      await codeFor(CreateQuestionDto, {
        ...valid,
        placeholder: 'Chọn một',
        is_required: '1',
        parent_question_id: 'Q_HAS_ITCH',
        show_if_answer: '["YES","MAYBE"]',
        help_text: 'Theo thang UAS7',
        allow_image: '0',
        options: [
          { option_text: 'Nặng', option_value: 'SEVERE', order: 2, trigger_image_upload: '1' },
        ],
      }),
    ).toBeNull();
  });

  it.each([
    ['thiếu question_id', { question_id: undefined }, '2001'],
    ['question_id chữ thường', { question_id: 'q_itch' }, '2003'],
    ['question_id dài quá 50 ký tự', { question_id: 'Q'.repeat(51) }, '2003'],
    ['thiếu question_text', { question_text: undefined }, '2001'],
    ['question_text chỉ có khoảng trắng', { question_text: '  ' }, '2003'],
    ['question_text vượt dung lượng cột TEXT', { question_text: TOO_LONG_TEXT }, '2003'],
    ['thiếu type_question', { type_question: undefined }, '2001'],
    ['type_question ngoài enum', { type_question: 'label' }, '2003'],
    ['thiếu order', { order: undefined }, '2001'],
    ['order sai', { order: '-2' }, '2003'],
    ['placeholder dài quá 255 ký tự', { placeholder: 'a'.repeat(256) }, '2003'],
    ['help_text vượt dung lượng cột TEXT', { help_text: TOO_LONG_TEXT }, '2003'],
    ['allow_image ngoài "0"/"1"', { allow_image: 'yes' }, '2003'],
    ['parent_question_id sai định dạng', { parent_question_id: 'q-1' }, '2003'],
    ['show_if_answer không phải JSON', { show_if_answer: 'YES' }, '2003'],
    ['show_if_answer là mảng rỗng', { show_if_answer: '[]' }, '2003'],
    ['show_if_answer có chuỗi rỗng', { show_if_answer: '["YES",""]' }, '2003'],
    ['show_if_answer là object JSON', { show_if_answer: '{"value":"YES"}' }, '2003'],
    ['show_if_answer là mảng (chưa stringify)', { show_if_answer: ['YES'] }, '2002'],
    ['options không phải mảng', { options: 'YES' }, '2002'],
    ['options null', { options: null }, '2001'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateQuestionDto, { ...valid, ...override })).toBe(code);
  });

  it.each([
    ['thiếu option_text', { option_text: undefined }, '2001', 'options.0.option_text'],
    ['thiếu option_value', { option_value: undefined }, '2001', 'options.0.option_value'],
    [
      'option_value dài quá 50 ký tự',
      { option_value: 'V'.repeat(51) },
      '2003',
      'options.0.option_value',
    ],
    [
      'option_text dài quá 255 ký tự',
      { option_text: 'a'.repeat(256) },
      '2003',
      'options.0.option_text',
    ],
    ['thiếu order', { order: undefined }, '2001', 'options.0.order'],
    ['order sai', { order: 'x' }, '2003', 'options.0.order'],
    [
      'trigger_image_upload ngoài "0"/"1"',
      { trigger_image_upload: 'yes' },
      '2003',
      'options.0.trigger_image_upload',
    ],
  ])('lựa chọn %s → %s (field %s)', async (_name, override, code, field) => {
    const body = { ...valid, options: [{ ...valid.options[0], ...override }] };
    expect(await errorFor(CreateQuestionDto, body)).toEqual({ code, data: { field } });
  });

  it('id của lựa chọn khi tạo bị bỏ qua (whitelist)', async () => {
    const dto = plainToInstance(CreateQuestionDto, {
      ...valid,
      options: [{ ...valid.options[0], id: '9' }],
    });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto.options?.[0]).not.toHaveProperty('id');
  });
});

describe('UpdateQuestionDto', () => {
  it('mọi trường không bắt buộc; null xoá placeholder, help_text, câu hỏi cha, show_if_answer', async () => {
    expect(await codeFor(UpdateQuestionDto, {})).toBeNull();
    expect(
      await codeFor(UpdateQuestionDto, {
        placeholder: null,
        help_text: null,
        parent_question_id: null,
        show_if_answer: null,
      }),
    ).toBeNull();
  });

  it('options: phần tử có id (chuỗi số) là sửa, không id là tạo; options rỗng hợp lệ', async () => {
    expect(
      await codeFor(UpdateQuestionDto, {
        options: [
          { id: '31', option_text: 'Có', option_value: 'YES', order: '1' },
          { option_text: 'Không', option_value: 'NO', order: 2 },
        ],
      }),
    ).toBeNull();
    expect(await codeFor(UpdateQuestionDto, { options: [] })).toBeNull();
  });

  it.each([
    ['question_text null', { question_text: null }, '2001'],
    ['type_question null', { type_question: null }, '2001'],
    ['type_question ngoài enum', { type_question: 'label' }, '2003'],
    ['order null', { order: null }, '2001'],
    ['is_required null', { is_required: null }, '2001'],
    ['show_if_answer không phải JSON', { show_if_answer: '[YES]' }, '2003'],
    [
      'id lựa chọn là số',
      { options: [{ id: 31, option_text: 'Có', option_value: 'YES', order: 1 }] },
      '2002',
    ],
    [
      'id lựa chọn không phải chuỗi chữ số',
      { options: [{ id: 'abc', option_text: 'Có', option_value: 'YES', order: 1 }] },
      '2003',
    ],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeFor(UpdateQuestionDto, body)).toBe(code);
  });
});
