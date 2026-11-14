import {
  LESION_PATHS,
  type CreateLesionEpisodeRequest,
  type CreateLesionLocationRequest,
  type CreateLesionPhotoRequest,
  type LesionEpisodeData,
  type LesionEpisodeListItem,
  type LesionLocationData,
  type LesionPhotoData,
  type LesionPhotoListItem,
  type RecordLesionEpisodeItem,
  type UpdateLesionEpisodeRequest,
  type UpdateLesionLocationRequest,
  type UpdateLesionPhotoRequest,
} from '@drmayday/shared';
import { apiClient } from './api';

export function createEpisode(request: CreateLesionEpisodeRequest): Promise<LesionEpisodeData> {
  return apiClient.post<LesionEpisodeData>(LESION_PATHS.episodes, request);
}

/** Đợt của các bệnh án đang hoạt động; 4002 khi bệnh nhân chưa có bệnh án nào như vậy. */
export function fetchMyEpisodes(): Promise<LesionEpisodeListItem[]> {
  return apiClient.get<LesionEpisodeListItem[]>(LESION_PATHS.myEpisodes);
}

export function fetchEpisode(id: string): Promise<LesionEpisodeData> {
  return apiClient.get<LesionEpisodeData>(LESION_PATHS.episode(id));
}

export function updateEpisode(
  id: string,
  request: UpdateLesionEpisodeRequest,
): Promise<LesionEpisodeData> {
  return apiClient.patch<LesionEpisodeData>(LESION_PATHS.episode(id), request);
}

export function deleteEpisode(id: string): Promise<unknown> {
  return apiClient.delete(LESION_PATHS.episode(id));
}

/** Đợt của một bệnh án, kể cả bệnh án đã đóng (MT-87). */
export function fetchRecordEpisodes(medicalRecordId: string): Promise<RecordLesionEpisodeItem[]> {
  return apiClient.get<RecordLesionEpisodeItem[]>(LESION_PATHS.episodesByRecord(medicalRecordId));
}

export function createLocation(request: CreateLesionLocationRequest): Promise<LesionLocationData> {
  return apiClient.post<LesionLocationData>(LESION_PATHS.locations, request);
}

export function fetchLocations(episodeId: string): Promise<LesionLocationData[]> {
  return apiClient.get<LesionLocationData[]>(LESION_PATHS.locationsByEpisode(episodeId));
}

export function updateLocation(
  id: string,
  request: UpdateLesionLocationRequest,
): Promise<LesionLocationData> {
  return apiClient.patch<LesionLocationData>(LESION_PATHS.location(id), request);
}

export function deleteLocation(id: string): Promise<unknown> {
  return apiClient.delete(LESION_PATHS.location(id));
}

export function createPhoto(request: CreateLesionPhotoRequest): Promise<LesionPhotoData> {
  return apiClient.post<LesionPhotoData>(LESION_PATHS.photos, request);
}

export function fetchPhotos(locationId: string): Promise<LesionPhotoListItem[]> {
  return apiClient.get<LesionPhotoListItem[]>(LESION_PATHS.photosByLocation(locationId));
}

export function updatePhoto(
  id: string,
  request: UpdateLesionPhotoRequest,
): Promise<LesionPhotoData> {
  return apiClient.patch<LesionPhotoData>(LESION_PATHS.photoMilestone(id), request);
}

export function deletePhoto(id: string): Promise<unknown> {
  return apiClient.delete(LESION_PATHS.photo(id));
}
