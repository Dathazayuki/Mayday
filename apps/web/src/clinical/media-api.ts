import { MEDIA_PATHS, type AnswerImageItem } from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

/** Ảnh gắn với một câu trả lời; chưa có answerId (câu chưa trả lời) thì không gọi API. */
export function useAnswerImages(answerId: number | undefined) {
  return useQuery({
    queryKey: ['answer-images', answerId],
    queryFn: () => apiClient.get<AnswerImageItem[]>(MEDIA_PATHS.answerImagesOf(answerId!)),
    enabled: answerId !== undefined,
  });
}
