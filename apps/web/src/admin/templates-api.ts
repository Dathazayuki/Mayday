import type {
  CreateQuestionRequest,
  CreateSectionRequest,
  CreateTemplateRequest,
  QuestionData,
  SectionData,
  TemplateData,
  TemplateDetailData,
  TemplateListQuery,
  TemplateSummary,
  UpdateQuestionRequest,
  UpdateSectionRequest,
  UpdateTemplateRequest,
} from '@drmayday/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

const TEMPLATES_KEY = ['templates'] as const;

/** Danh sách phân trang phía server; giữ trang cũ trên màn hình trong lúc tải trang mới. */
export function useTemplates({
  page,
  limit,
  is_active,
}: Required<Pick<TemplateListQuery, 'page' | 'limit'>> & Pick<TemplateListQuery, 'is_active'>) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, 'list', { page, limit, is_active }],
    queryFn: () => apiClient.getPage<TemplateSummary>('/templates/all', { page, limit, is_active }),
    placeholderData: keepPreviousData,
  });
}

/** Toàn bộ cây biểu mẫu (section, câu hỏi, lựa chọn) theo code_template. */
export function useTemplateDetail(code: string) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, 'detail', code],
    queryFn: () => apiClient.get<TemplateDetailData>(`/templates/${code}`),
  });
}

/** Mọi thay đổi làm mới cả danh sách lẫn chi tiết (cùng tiền tố TEMPLATES_KEY). */
function useInvalidatingMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export const useCreateTemplate = () =>
  useInvalidatingMutation((body: CreateTemplateRequest) =>
    apiClient.post<TemplateData>('/templates', body),
  );

export const useUpdateTemplate = () =>
  useInvalidatingMutation(({ code, changes }: { code: string; changes: UpdateTemplateRequest }) =>
    apiClient.put<TemplateData>(`/templates/${code}`, changes),
  );

export const useDeleteTemplate = () =>
  useInvalidatingMutation((code: string) => apiClient.delete<object>(`/templates/${code}`));

export const useCreateSection = () =>
  useInvalidatingMutation(({ code, body }: { code: string; body: CreateSectionRequest }) =>
    apiClient.post<SectionData>(`/templates/${code}/sections`, body),
  );

export const useUpdateSection = () =>
  useInvalidatingMutation(({ id, changes }: { id: string; changes: UpdateSectionRequest }) =>
    apiClient.put<SectionData>(`/templates/sections/${id}`, changes),
  );

export const useDeleteSection = () =>
  useInvalidatingMutation((id: string) => apiClient.delete<object>(`/templates/sections/${id}`));

export const useCreateQuestion = () =>
  useInvalidatingMutation(
    ({ sectionId, body }: { sectionId: string; body: CreateQuestionRequest }) =>
      apiClient.post<QuestionData>(`/templates/sections/${sectionId}/questions`, body),
  );

export const useUpdateQuestion = () =>
  useInvalidatingMutation(({ id, changes }: { id: string; changes: UpdateQuestionRequest }) =>
    apiClient.put<QuestionData>(`/templates/questions/${id}`, changes),
  );

export const useDeleteQuestion = () =>
  useInvalidatingMutation((id: string) => apiClient.delete<object>(`/templates/questions/${id}`));
