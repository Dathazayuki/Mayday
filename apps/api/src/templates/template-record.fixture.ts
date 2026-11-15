import type {
  question_options,
  questions,
  template_sections,
  templates,
} from '../generated/prisma/client.js';
import type { QuestionInTemplate, QuestionRecord } from './templates.repository.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');
const UPDATED_AT = new Date('2026-11-16T04:05:06.000Z');
const TIMESTAMPS = { created_at: CREATED_AT, updated_at: UPDATED_AT };

/** Mẫu phiếu mẫu cho unit test; ghi đè từng phần bằng `overrides`. */
export function templateRecord(overrides: Partial<templates> = {}): templates {
  return {
    code_template: 'TMPL_URT',
    name: 'Phiếu khám mề đay',
    description: 'Khám lần đầu',
    version: '1.0',
    is_active: true,
    ...TIMESTAMPS,
    ...overrides,
  };
}

/** Section 7 của mẫu TMPL_URT. */
export function sectionRecord(overrides: Partial<template_sections> = {}): template_sections {
  return {
    section_id: 7,
    template_id: 'TMPL_URT',
    title: 'Thông tin chung',
    order: 1,
    is_required: false,
    filled_by: 'patient',
    ...TIMESTAMPS,
    ...overrides,
  };
}

/** Lựa chọn 31 (YES) của câu hỏi Q_HAS_ITCH. */
export function optionRecord(overrides: Partial<question_options> = {}): question_options {
  return {
    id: 31,
    question_id: 'Q_HAS_ITCH',
    option_text: 'Có',
    option_value: 'YES',
    order: 1,
    has_text_input: false,
    trigger_image_upload: false,
    image_upload_label: null,
    ...TIMESTAMPS,
    ...overrides,
  };
}

/** Câu hỏi radio Q_HAS_ITCH (section 7) với hai lựa chọn YES (31), NO (32). */
export function questionRecord(overrides: Partial<QuestionRecord> = {}): QuestionRecord {
  const row: questions = {
    question_id: 'Q_HAS_ITCH',
    section_id: 7,
    question_text: 'Bạn có bị ngứa không?',
    type_question: 'radio',
    placeholder: null,
    order: 1,
    is_required: true,
    parent_question_id: null,
    show_if_answer: null,
    condition_rules: null,
    help_text: null,
    allow_image: false,
    ...TIMESTAMPS,
  };
  return {
    ...row,
    question_options: [
      optionRecord(),
      optionRecord({ id: 32, option_text: 'Không', option_value: 'NO', order: 2 }),
    ],
    ...overrides,
  };
}

/** Câu hỏi kèm mã mẫu phiếu chứa nó (kết quả TemplatesRepository.findQuestion). */
export function questionInTemplate(
  overrides: Partial<QuestionRecord> = {},
  templateId = 'TMPL_URT',
): QuestionInTemplate {
  return { ...questionRecord(overrides), section: { template_id: templateId } };
}
