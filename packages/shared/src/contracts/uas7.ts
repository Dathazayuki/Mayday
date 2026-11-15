/** GET /api/v1/uas7-scores/eligibility — mọi giá trị là chuỗi (slide uas701). */
export interface Uas7EligibilityData {
  eligible: 'true' | 'false';
  medical_record_id?: string;
}

/** POST /api/v1/uas7-scores — điểm truyền dạng chuỗi số "0".."3". */
export interface CreateUas7ScoreRequest {
  medical_record_id: string;
  score_date: string;
  iss7: string;
  hss7: string;
  note?: string;
}

/** Bản ghi điểm UAS7 (POST trả mảng 1 phần tử — MT-75; GET lịch sử trả mảng). */
export interface Uas7ScoreData {
  patient_id: string;
  medical_record_id: string;
  score_date: string;
  iss7: string;
  hss7: string;
  daily_score: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/uas7-scores/week/:patientId — thêm start_date/end_date để hiển thị kỳ tính. */
export interface Uas7WeekData {
  patient_id: string;
  week_score: string;
  severity_label: string;
  completed_days: string;
  start_date: string;
  end_date: string;
}
