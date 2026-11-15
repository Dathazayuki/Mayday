import {
  LESION_PATHS,
  type LesionEpisodeData,
  type LesionLocationData,
  type LesionPhotoListItem,
  type RecordLesionEpisodeItem,
} from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

const LESIONS_KEY = ['lesions'] as const;

/** Các đợt tổn thương của một bệnh án, mới nhất trước. */
export function useRecordLesionEpisodes(medicalRecordId: number) {
  return useQuery({
    queryKey: [...LESIONS_KEY, 'record', medicalRecordId],
    queryFn: () =>
      apiClient.get<RecordLesionEpisodeItem[]>(LESION_PATHS.episodesByRecord(medicalRecordId)),
  });
}

export function useLesionEpisode(episodeId: string) {
  return useQuery({
    queryKey: [...LESIONS_KEY, 'episode', episodeId],
    queryFn: () => apiClient.get<LesionEpisodeData>(LESION_PATHS.episode(episodeId)),
  });
}

export function useEpisodeLocations(episodeId: string) {
  return useQuery({
    queryKey: [...LESIONS_KEY, 'locations', episodeId],
    queryFn: () => apiClient.get<LesionLocationData[]>(LESION_PATHS.locationsByEpisode(episodeId)),
  });
}

export function useLocationPhotos(locationId: string) {
  return useQuery({
    queryKey: [...LESIONS_KEY, 'photos', locationId],
    queryFn: () => apiClient.get<LesionPhotoListItem[]>(LESION_PATHS.photosByLocation(locationId)),
  });
}
