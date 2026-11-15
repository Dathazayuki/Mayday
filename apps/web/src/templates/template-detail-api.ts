import type { TemplateDetailData } from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

/** Tiền tố của mọi query mẫu phiếu (danh sách và chi tiết): mutation làm mới cả nhóm. */
export const TEMPLATES_KEY = ['templates'] as const;

/** Toàn bộ cây biểu mẫu (section, câu hỏi, lựa chọn) theo code_template; chưa có mã thì không gọi API. */
export function useTemplateDetail(code: string | null | undefined) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, 'detail', code],
    queryFn: () => apiClient.get<TemplateDetailData>(`/templates/${code}`),
    enabled: Boolean(code),
  });
}
