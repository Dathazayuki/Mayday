import type { CreateQuestionRequest, UpdateQuestionRequest } from '@drmayday/shared';
import { conflict } from '../common/app.exception.js';
import { QuestionsService } from './questions.service.js';
import {
  optionRecord,
  questionInTemplate,
  questionRecord,
  sectionRecord,
} from './template-record.fixture.js';
import type { QuestionInTemplate, TemplatesRepository } from './templates.repository.js';

const CONFLICT = { code: '2003', httpStatus: 409 };
const invalid = (field: string) => ({ code: '2003', data: { field } });

/**
 * Mẫu TMPL_URT (section 7): Q_HAS_ITCH (radio YES 31 / NO 32) là cha của Q_LEVEL (number, hiện khi
 * YES); Q_NOTE (text) độc lập. Q_FOREIGN (radio YES) thuộc mẫu khác.
 */
const QUESTIONS: Record<string, QuestionInTemplate> = {
  Q_HAS_ITCH: questionInTemplate(),
  Q_LEVEL: questionInTemplate({
    question_id: 'Q_LEVEL',
    type_question: 'number',
    order: 2,
    parent_question_id: 'Q_HAS_ITCH',
    show_if_answer: ['YES'],
    question_options: [],
  }),
  Q_NOTE: questionInTemplate({
    question_id: 'Q_NOTE',
    type_question: 'text',
    question_options: [],
  }),
  Q_FOREIGN: questionInTemplate(
    { question_id: 'Q_FOREIGN', question_options: [optionRecord({ id: 51 })] },
    'TMPL_OTHER',
  ),
};
const LINKS = Object.values(QUESTIONS)
  .filter(({ section }) => section.template_id === 'TMPL_URT')
  .map(({ question_id, parent_question_id }) => ({ question_id, parent_question_id }));

function setup() {
  const repo = {
    findSection: vi.fn<TemplatesRepository['findSection']>().mockResolvedValue(sectionRecord()),
    findQuestion: vi.fn<TemplatesRepository['findQuestion']>(async (id) => QUESTIONS[id] ?? null),
    findQuestionLinks: vi.fn<TemplatesRepository['findQuestionLinks']>().mockResolvedValue(LINKS),
    countChildQuestions: vi.fn<TemplatesRepository['countChildQuestions']>().mockResolvedValue(0),
    createQuestion: vi
      .fn<TemplatesRepository['createQuestion']>()
      .mockResolvedValue(questionRecord()),
    updateQuestion: vi
      .fn<TemplatesRepository['updateQuestion']>()
      .mockResolvedValue(questionRecord()),
    deleteQuestion: vi.fn<TemplatesRepository['deleteQuestion']>().mockResolvedValue(true),
  };
  return { repo, service: new QuestionsService(repo as unknown as TemplatesRepository) };
}

const YES_NO = [
  { option_text: 'Có', option_value: 'YES', order: '1' },
  { option_text: 'Không', option_value: 'NO', order: '2', trigger_image_upload: '1' as const },
];

describe('QuestionsService.create', () => {
  const text = (override: Partial<CreateQuestionRequest> = {}): CreateQuestionRequest => ({
    question_id: 'Q_NEW',
    question_text: 'Câu hỏi mới',
    type_question: 'text',
    order: '3',
    ...override,
  });

  it('section không tồn tại → 4103, không ghi', async () => {
    const { service, repo } = setup();
    repo.findSection.mockResolvedValue(null);
    await expect(service.create(99, text())).rejects.toMatchObject({ code: '4103' });
    expect(repo.createQuestion).not.toHaveBeenCalled();
  });

  it('câu text không lựa chọn → ghi vào section và trả dạng câu hỏi đầy đủ', async () => {
    const { service, repo } = setup();
    await expect(service.create(7, text())).resolves.toMatchObject({
      question_id: 'Q_HAS_ITCH',
      section_id: '7',
      options: [{ id: '31' }, { id: '32' }],
    });
    expect(repo.findSection).toHaveBeenCalledWith(7);
    expect(repo.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ question_id: 'Q_NEW', section_id: 7, order: 3, options: [] }),
    );
  });

  it('radio kèm lựa chọn → ghi câu hỏi cùng lựa chọn', async () => {
    const { service, repo } = setup();
    await service.create(7, text({ type_question: 'radio', options: YES_NO }));
    expect(repo.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          { option_text: 'Có', option_value: 'YES', order: 1, trigger_image_upload: undefined },
          { option_text: 'Không', option_value: 'NO', order: 2, trigger_image_upload: true },
        ],
      }),
    );
  });

  it.each<[string, Partial<CreateQuestionRequest>, object]>([
    [
      'radio không có lựa chọn',
      { type_question: 'radio' },
      { code: '2001', data: { field: 'options' } },
    ],
    ['checkbox với options rỗng', { type_question: 'checkbox', options: [] }, { code: '2001' }],
    ['kiểu text mà gửi lựa chọn', { options: YES_NO }, invalid('options')],
    [
      'option_value trùng nhau',
      { type_question: 'radio', options: [YES_NO[0]!, { ...YES_NO[1]!, option_value: 'YES' }] },
      invalid('options'),
    ],
    [
      'câu hỏi cha không tồn tại',
      { parent_question_id: 'Q_KHONG_CO' },
      invalid('parent_question_id'),
    ],
    [
      'câu hỏi cha thuộc mẫu khác',
      { parent_question_id: 'Q_FOREIGN' },
      invalid('parent_question_id'),
    ],
    ['câu hỏi cha là chính nó', { parent_question_id: 'Q_NEW' }, invalid('parent_question_id')],
    [
      'show_if_answer mà không có câu hỏi cha',
      { show_if_answer: '["YES"]' },
      invalid('show_if_answer'),
    ],
    [
      'show_if_answer không thuộc lựa chọn của câu hỏi cha',
      { parent_question_id: 'Q_HAS_ITCH', show_if_answer: '["YES","MAYBE"]' },
      invalid('show_if_answer'),
    ],
    [
      'câu hỏi cha không có lựa chọn nào khớp show_if_answer',
      { parent_question_id: 'Q_NOTE', show_if_answer: '["YES"]' },
      invalid('show_if_answer'),
    ],
  ])('%s → lỗi, không ghi', async (_name, override, error) => {
    const { service, repo } = setup();
    await expect(service.create(7, text(override))).rejects.toMatchObject(error);
    expect(repo.createQuestion).not.toHaveBeenCalled();
  });

  it('câu hỏi con: cha cùng mẫu, show_if_answer thuộc lựa chọn của cha → ghi mảng đã parse', async () => {
    const { service, repo } = setup();
    await service.create(
      7,
      text({
        parent_question_id: 'Q_HAS_ITCH',
        show_if_answer: '["YES"]',
        type_question: 'number',
      }),
    );
    expect(repo.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ parent_question_id: 'Q_HAS_ITCH', show_if_answer: ['YES'] }),
    );
  });

  it('có câu hỏi cha nhưng không có show_if_answer → câu con luôn hiện, ghi được', async () => {
    const { service, repo } = setup();
    await service.create(7, text({ parent_question_id: 'Q_NOTE' }));
    expect(repo.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ parent_question_id: 'Q_NOTE', show_if_answer: null }),
    );
  });

  it('trùng question_id → 2003 / 409 (repository báo)', async () => {
    const { service, repo } = setup();
    repo.createQuestion.mockRejectedValue(conflict());
    await expect(service.create(7, text())).rejects.toMatchObject(CONFLICT);
  });
});

describe('QuestionsService.update', () => {
  it('body không có trường nào → 2001, không tra CSDL', async () => {
    const { service, repo } = setup();
    await expect(service.update('Q_NOTE', {})).rejects.toMatchObject({ code: '2001' });
    expect(repo.findQuestion).not.toHaveBeenCalled();
  });

  it('không tồn tại → 4104', async () => {
    const { service, repo } = setup();
    await expect(service.update('Q_KHONG_CO', { order: 1 })).rejects.toMatchObject({
      code: '4104',
    });
    expect(repo.updateQuestion).not.toHaveBeenCalled();
  });

  it('chỉ sửa trường thường → ghi, không đụng lựa chọn, không tra câu hỏi cha', async () => {
    const { service, repo } = setup();
    await expect(
      service.update('Q_NOTE', { question_text: 'Ghi chú khác', placeholder: null }),
    ).resolves.toMatchObject({ question_id: 'Q_HAS_ITCH' });
    expect(repo.updateQuestion).toHaveBeenCalledWith(
      'Q_NOTE',
      expect.objectContaining({ question_text: 'Ghi chú khác', placeholder: null }),
      undefined,
    );
    expect(repo.findQuestion).toHaveBeenCalledTimes(1);
  });

  it('options là danh sách đầy đủ: có id → sửa, không id → tạo, lựa chọn cũ vắng mặt → xoá', async () => {
    const { service, repo } = setup();
    await service.update('Q_HAS_ITCH', {
      options: [
        { id: '31', option_text: 'Có ạ', option_value: 'YES', order: '1' },
        { option_text: 'Không rõ', option_value: 'UNKNOWN', order: 3, trigger_image_upload: '1' },
      ],
    });
    expect(repo.updateQuestion).toHaveBeenCalledWith('Q_HAS_ITCH', expect.any(Object), {
      update: [
        {
          id: 31,
          option_text: 'Có ạ',
          option_value: 'YES',
          order: 1,
          trigger_image_upload: undefined,
        },
      ],
      create: [
        { option_text: 'Không rõ', option_value: 'UNKNOWN', order: 3, trigger_image_upload: true },
      ],
      remove: [32],
    });
  });

  it.each<[string, string, UpdateQuestionRequest, object]>([
    [
      'id lựa chọn không thuộc câu hỏi',
      'Q_HAS_ITCH',
      { options: [{ id: '51', option_text: 'Có', option_value: 'YES', order: 1 }] },
      invalid('options'),
    ],
    [
      'id lựa chọn không phải số nguyên dương',
      'Q_HAS_ITCH',
      { options: [{ id: '0', option_text: 'Có', option_value: 'YES', order: 1 }] },
      invalid('options'),
    ],
    [
      'một id lựa chọn xuất hiện hai lần',
      'Q_HAS_ITCH',
      {
        options: [
          { id: '31', option_text: 'Có', option_value: 'YES', order: 1 },
          { id: '31', option_text: 'Không', option_value: 'NO', order: 2 },
        ],
      },
      invalid('options'),
    ],
    [
      'option_value trùng nhau',
      'Q_HAS_ITCH',
      {
        options: [
          { id: '31', option_text: 'Có', option_value: 'YES', order: 1 },
          { option_text: 'Có nữa', option_value: 'YES', order: 2 },
        ],
      },
      invalid('options'),
    ],
    [
      'radio với options rỗng',
      'Q_HAS_ITCH',
      { options: [] },
      { code: '2001', data: { field: 'options' } },
    ],
    [
      'đổi radio sang text mà vẫn giữ lựa chọn cũ',
      'Q_HAS_ITCH',
      { type_question: 'text' },
      invalid('options'),
    ],
    [
      'đổi text sang checkbox mà không có lựa chọn',
      'Q_NOTE',
      { type_question: 'checkbox' },
      { code: '2001' },
    ],
    ['kiểu text mà gửi lựa chọn', 'Q_NOTE', { options: YES_NO }, invalid('options')],
    [
      'câu hỏi cha là chính nó',
      'Q_NOTE',
      { parent_question_id: 'Q_NOTE' },
      invalid('parent_question_id'),
    ],
    [
      'câu hỏi cha là câu con của nó (tạo vòng)',
      'Q_HAS_ITCH',
      { parent_question_id: 'Q_LEVEL' },
      invalid('parent_question_id'),
    ],
    [
      'câu hỏi cha thuộc mẫu khác',
      'Q_NOTE',
      { parent_question_id: 'Q_FOREIGN' },
      invalid('parent_question_id'),
    ],
    [
      'bỏ câu hỏi cha mà vẫn giữ show_if_answer cũ',
      'Q_LEVEL',
      { parent_question_id: null },
      invalid('show_if_answer'),
    ],
    [
      'show_if_answer mới không thuộc lựa chọn của câu hỏi cha hiện tại',
      'Q_LEVEL',
      { show_if_answer: '["MAYBE"]' },
      invalid('show_if_answer'),
    ],
    [
      'đổi câu hỏi cha mà show_if_answer cũ không thuộc lựa chọn của cha mới',
      'Q_LEVEL',
      { parent_question_id: 'Q_NOTE' },
      invalid('show_if_answer'),
    ],
  ])('%s → lỗi, không ghi', async (_name, id, dto, error) => {
    const { service, repo } = setup();
    await expect(service.update(id, dto)).rejects.toMatchObject(error);
    expect(repo.updateQuestion).not.toHaveBeenCalled();
  });

  it('đổi radio sang text kèm options [] → xoá hết lựa chọn cũ', async () => {
    const { service, repo } = setup();
    await service.update('Q_HAS_ITCH', { type_question: 'text', options: [] });
    expect(repo.updateQuestion).toHaveBeenCalledWith(
      'Q_HAS_ITCH',
      expect.objectContaining({ type_question: 'text' }),
      { update: [], create: [], remove: [31, 32] },
    );
  });

  it('show_if_answer mới thuộc lựa chọn của câu hỏi cha hiện tại → ghi mảng đã parse', async () => {
    const { service, repo } = setup();
    await service.update('Q_LEVEL', { show_if_answer: '["NO"]' });
    expect(repo.findQuestion).toHaveBeenCalledWith('Q_HAS_ITCH');
    expect(repo.updateQuestion).toHaveBeenCalledWith(
      'Q_LEVEL',
      expect.objectContaining({ show_if_answer: ['NO'] }),
      undefined,
    );
  });

  it('bỏ cả câu hỏi cha và show_if_answer → câu hỏi gốc', async () => {
    const { service, repo } = setup();
    await service.update('Q_LEVEL', { parent_question_id: null, show_if_answer: null });
    expect(repo.updateQuestion).toHaveBeenCalledWith(
      'Q_LEVEL',
      expect.objectContaining({ parent_question_id: null, show_if_answer: null }),
      undefined,
    );
  });

  it('câu hỏi bị xoá giữa lúc kiểm tra và lúc ghi → 4104', async () => {
    const { service, repo } = setup();
    repo.updateQuestion.mockResolvedValue(null);
    await expect(service.update('Q_NOTE', { order: 2 })).rejects.toMatchObject({ code: '4104' });
  });
});

describe('QuestionsService.remove', () => {
  it('không tồn tại → 4104, không xoá', async () => {
    const { service, repo } = setup();
    await expect(service.remove('Q_KHONG_CO')).rejects.toMatchObject({ code: '4104' });
    expect(repo.deleteQuestion).not.toHaveBeenCalled();
  });

  it('còn câu hỏi con → 2003 / 409, không xoá (MT-68)', async () => {
    const { service, repo } = setup();
    repo.countChildQuestions.mockResolvedValue(1);
    await expect(service.remove('Q_HAS_ITCH')).rejects.toMatchObject(CONFLICT);
    expect(repo.countChildQuestions).toHaveBeenCalledWith('Q_HAS_ITCH');
    expect(repo.deleteQuestion).not.toHaveBeenCalled();
  });

  it('không còn câu hỏi con → xoá (lựa chọn CASCADE)', async () => {
    const { service, repo } = setup();
    await service.remove('Q_NOTE');
    expect(repo.deleteQuestion).toHaveBeenCalledWith('Q_NOTE');
  });

  it('câu hỏi bị xoá giữa lúc kiểm tra và lúc xoá → 4104', async () => {
    const { service, repo } = setup();
    repo.deleteQuestion.mockResolvedValue(false);
    await expect(service.remove('Q_NOTE')).rejects.toMatchObject({ code: '4104' });
  });
});
