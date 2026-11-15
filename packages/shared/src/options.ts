/**
 * Giá trị gender theo Sheet (signup, profile). CSDL thật chỉ có Nam/Nu (`ck_nguoi_gioi_tinh`, SQL:62)
 * nên bỏ "other": gửi other → 2003 (MT-59, vẫn lệch Sheet).
 */
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
] as const;
export type Gender = (typeof GENDER_OPTIONS)[number]['value'];
export const GENDER_VALUES: readonly Gender[] = GENDER_OPTIONS.map((o) => o.value);

/** Nghề nghiệp: đúng 5 giá trị enum `patients.nghe_nghiep` của tài liệu CSDL (spec giai đoạn 1, mục 3.1). */
export const CAREER_OPTIONS = [
  { value: 'Cong nhan', label: 'Công nhân' },
  { value: 'Nong dan', label: 'Nông dân' },
  { value: 'Hoc sinh - Sinh vien', label: 'Học sinh - Sinh viên' },
  { value: 'Can bo cong chuc', label: 'Cán bộ công chức' },
  { value: 'Khac', label: 'Khác' },
] as const;
export type Career = (typeof CAREER_OPTIONS)[number]['value'];
export const CAREER_VALUES: readonly Career[] = CAREER_OPTIONS.map((o) => o.value);

/** Sheet signup/create_user: "Tối thiểu 6 ký tự". */
export const PASSWORD_MIN_LENGTH = 6;
