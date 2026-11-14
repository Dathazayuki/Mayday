import type {
  CreateQuestionRequest,
  CreateSectionRequest,
  CreateTemplateRequest,
  QuestionData,
  SectionData,
  TemplateData,
  TemplateListQuery,
  TemplateSummary,
  UpdateQuestionRequest,
  UpdateSectionRequest,
  UpdateTemplateRequest,
} from '@drmayday/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { TEMPLATES_KEY } from '../templates/template-detail-api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';

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

export const useCreateTemplate = () =>
  useInvalidatingMutation([TEMPLATES_KEY], (body: CreateTemplateRequest) =>
    apiClient.post<TemplateData>('/templates', body),
  );

export const useUpdateTemplate = () =>
  useInvalidatingMutation(
    [TEMPLATES_KEY],
    ({ code, changes }: { code: string; changes: UpdateTemplateRequest }) =>
      apiClient.put<TemplateData>(`/templates/${code}`, changes),
  );

export const useDeleteTemplate = () =>
  useInvalidatingMutation([TEMPLATES_KEY], (code: string) =>
    apiClient.delete<object>(`/templates/${code}`),
  );

export const useCreateSection = () =>
  useInvalidatingMutation(
    [TEMPLATES_KEY],
    ({ code, body }: { code: string; body: CreateSectionRequest }) =>
      apiClient.post<SectionData>(`/templates/${code}/sections`, body),
  );

export const useUpdateSection = () =>
  useInvalidatingMutation(
    [TEMPLATES_KEY],
    ({ id, changes }: { id: string; changes: UpdateSectionRequest }) =>
      apiClient.put<SectionData>(`/templates/sections/${id}`, changes),
  );

export const useDeleteSection = () =>
  useInvalidatingMutation([TEMPLATES_KEY], (id: string) =>
    apiClient.delete<object>(`/templates/sections/${id}`),
  );

export const useCreateQuestion = () =>
  useInvalidatingMutation(
    [TEMPLATES_KEY],
    ({ sectionId, body }: { sectionId: string; body: CreateQuestionRequest }) =>
      apiClient.post<QuestionData>(`/templates/sections/${sectionId}/questions`, body),
  );

export const useUpdateQuestion = () =>
  useInvalidatingMutation(
    [TEMPLATES_KEY],
    ({ id, changes }: { id: string; changes: UpdateQuestionRequest }) =>
      apiClient.put<QuestionData>(`/templates/questions/${id}`, changes),
  );

export const useDeleteQuestion = () =>
  useInvalidatingMutation([TEMPLATES_KEY], (id: string) =>
    apiClient.delete<object>(`/templates/questions/${id}`),
  );
