import { CODE_PATTERN } from '@drmayday/shared';
import type { FormRule } from 'antd';

/** Quy tắc cho ô mã định danh (code_template ≤ 255, question_id ≤ 50): bắt buộc, A-Z 0-9 _. */
export const codeRules = (label: string, maxLength: number): FormRule[] => [
  { required: true, message: `Vui lòng nhập ${label}` },
  { max: maxLength, message: `Tối đa ${maxLength} ký tự` },
  {
    pattern: CODE_PATTERN,
    message: 'Chỉ gồm chữ in hoa, số và dấu gạch dưới (VD: TMPL_URT)',
  },
];
