import {
  PATIENT_EDITABLE_FIELDS,
  isPatientProfile,
  type PatientEditableField,
  type ProfileData,
  type UpdateProfileRequest,
} from '@drmayday/shared';

/** Nhãn tiếng Việt của các trường bệnh nhân: dùng chung cho trang hồ sơ và Drawer chi tiết của admin. */
export const PATIENT_FIELD_LABELS: Record<PatientEditableField, string> = {
  year_of_birth: 'Năm sinh',
  career: 'Nghề nghiệp',
  ethnic: 'Dân tộc',
  hamlet_address: 'Thôn/Xóm',
  commune_address: 'Xã/Phường',
  city_address: 'Tỉnh/Thành phố',
  work_place: 'Nơi làm việc',
  health_insurance_number: 'Số thẻ BHYT',
  health_insurance_validate: 'Hạn thẻ BHYT',
  next_of_kin_name: 'Người thân',
  next_of_kin_phone: 'Số điện thoại người thân',
};

/** Giá trị form có cùng dạng với body PUT; trường trống có thể là undefined hoặc chuỗi rỗng. */
export type ProfileFormValues = UpdateProfileRequest;

/** Giá trị ban đầu của form: chỉ gồm các trường người dùng được sửa (bệnh nhân có thêm nhóm riêng). */
export function toFormValues(profile: ProfileData): ProfileFormValues {
  const values: ProfileFormValues = { full_name: profile.full_name, gender: profile.gender };
  if (isPatientProfile(profile)) {
    for (const field of PATIENT_EDITABLE_FIELDS) Object.assign(values, { [field]: profile[field] });
  }
  return values;
}

function normalize(value: unknown): unknown {
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  return value ?? null;
}

/**
 * Chỉ gồm trường đã đổi so với giá trị ban đầu của form; trường để trống được gửi `null`.
 * So với bản chụp lúc khởi tạo form (không phải dữ liệu refetch) để không ghi đè dữ liệu mới của server.
 */
export function buildProfileChanges(
  initial: ProfileFormValues,
  values: ProfileFormValues,
): UpdateProfileRequest {
  const changes: UpdateProfileRequest = {};
  for (const field of Object.keys(initial) as (keyof ProfileFormValues)[]) {
    const next = normalize(values[field]);
    if (next !== normalize(initial[field])) Object.assign(changes, { [field]: next });
  }
  return changes;
}
