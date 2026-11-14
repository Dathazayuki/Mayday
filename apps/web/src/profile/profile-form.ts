import {
  PATIENT_EDITABLE_FIELDS,
  isPatientProfile,
  type ProfileData,
  type UpdateProfileRequest,
} from '@drmayday/shared';

/** Giá trị form: chuỗi/số hoặc rỗng (undefined/null/'') = chưa có giá trị. */
export type ProfileFormValues = Record<string, string | number | null | undefined>;

const EDITABLE_FIELDS = ['full_name', 'gender', ...PATIENT_EDITABLE_FIELDS] as const;

function normalize(value: string | number | null | undefined): string | number | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  return value ?? null;
}

/** Giá trị ban đầu của form lấy từ hồ sơ (chỉ các trường người dùng được sửa). */
export function toFormValues(profile: ProfileData): ProfileFormValues {
  const values: ProfileFormValues = { full_name: profile.full_name, gender: profile.gender };
  if (isPatientProfile(profile)) {
    for (const field of PATIENT_EDITABLE_FIELDS) values[field] = profile[field];
  }
  return values;
}

/** Chỉ gồm trường đã đổi so với hồ sơ hiện tại; trường để trống được gửi `null`. */
export function buildProfileChanges(
  profile: ProfileData,
  values: ProfileFormValues,
): UpdateProfileRequest {
  const initial = toFormValues(profile);
  const changes: Record<string, string | number | null> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in initial)) continue;
    const next = normalize(values[field]);
    if (next !== normalize(initial[field])) changes[field] = next;
  }
  return changes as UpdateProfileRequest;
}
