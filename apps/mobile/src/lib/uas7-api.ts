import type {
  CreateUas7ScoreRequest,
  Uas7EligibilityData,
  Uas7ScoreData,
  Uas7WeekData,
} from '@drmayday/shared';
import { apiClient } from './api';

const BASE = '/uas7-scores';

export function fetchEligibility(): Promise<Uas7EligibilityData> {
  return apiClient.get<Uas7EligibilityData>(`${BASE}/eligibility`);
}

/** Máy chủ trả mảng 1 phần tử (MT-75); trả về chính bản ghi vừa tạo. */
export async function submitScore(request: CreateUas7ScoreRequest): Promise<Uas7ScoreData> {
  const [created] = await apiClient.post<Uas7ScoreData[]>(BASE, request);
  return created;
}

/** Lịch sử điểm, mới nhất trước. */
export function fetchScoreHistory(patientId: number): Promise<Uas7ScoreData[]> {
  return apiClient.get<Uas7ScoreData[]>(`${BASE}/patient/${patientId}`);
}

/** 7 ngày gần nhất (không gửi start_date). */
export function fetchWeek(patientId: number): Promise<Uas7WeekData> {
  return apiClient.get<Uas7WeekData>(`${BASE}/week/${patientId}`);
}
