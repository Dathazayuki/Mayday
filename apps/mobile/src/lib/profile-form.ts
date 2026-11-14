import {
  isPatientProfile,
  isValidIsoDate,
  isValidVietnamPhone,
  isValidYearOfBirth,
  type Career,
  type Gender,
  type ProfileData,
  type UpdateProfileRequest,
} from '@drmayday/shared';

/** Các trường chữ tự do của bệnh nhân, nhập như văn bản. */
export const PROFILE_TEXT_FIELDS = [
  { key: 'ethnic', label: 'Dân tộc' },
  { key: 'hamlet_address', label: 'Thôn / xóm / số nhà' },
  { key: 'commune_address', label: 'Xã / phường' },
  { key: 'city_address', label: 'Tỉnh / thành phố' },
  { key: 'work_place', label: 'Nơi làm việc' },
  { key: 'health_insurance_number', label: 'Số thẻ BHYT' },
  { key: 'next_of_kin_name', label: 'Người thân (họ tên)' },
] as const;
type ProfileTextKey = (typeof PROFILE_TEXT_FIELDS)[number]['key'];

/** Giá trị trên form: số và chuỗi giữ dạng chuỗi, rỗng nghĩa là chưa có giá trị. */
export type ProfileFormValues = Record<
  | ProfileTextKey
  | 'full_name'
  | 'year_of_birth'
  | 'health_insurance_validate'
  | 'next_of_kin_phone',
  string
> & { gender: Gender | null; career: Career | null };
export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

export function toFormValues(profile: ProfileData): ProfileFormValues {
  const patient = isPatientProfile(profile) ? profile : null;
  return {
    full_name: profile.full_name,
    gender: profile.gender,
    career: patient?.career ?? null,
    year_of_birth: patient?.year_of_birth?.toString() ?? '',
    health_insurance_validate: patient?.health_insurance_validate ?? '',
    next_of_kin_phone: patient?.next_of_kin_phone ?? '',
    ethnic: patient?.ethnic ?? '',
    hamlet_address: patient?.hamlet_address ?? '',
    commune_address: patient?.commune_address ?? '',
    city_address: patient?.city_address ?? '',
    work_place: patient?.work_place ?? '',
    health_insurance_number: patient?.health_insurance_number ?? '',
    next_of_kin_name: patient?.next_of_kin_name ?? '',
  };
}

export function validateProfileForm(values: ProfileFormValues): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  if (!values.full_name.trim()) errors.full_name = 'Họ và tên không được để trống';
  const year = values.year_of_birth.trim();
  if (year && !(/^\d+$/.test(year) && isValidYearOfBirth(Number(year)))) {
    errors.year_of_birth = `Năm sinh phải từ 1900 đến ${new Date().getFullYear()}`;
  }
  const insuranceDate = values.health_insurance_validate.trim();
  if (insuranceDate && !isValidIsoDate(insuranceDate)) {
    errors.health_insurance_validate = 'Ngày không hợp lệ, nhập dạng YYYY-MM-DD (VD: 2027-12-31)';
  }
  const kinPhone = values.next_of_kin_phone.trim();
  if (kinPhone && !isValidVietnamPhone(kinPhone)) {
    errors.next_of_kin_phone = 'Số điện thoại không đúng định dạng (VD: 0912345678)';
  }
  return errors;
}

/** Chỉ gồm các trường đã đổi so với bản gốc; chữ để trống thành null. */
export function buildProfileUpdate(
  values: ProfileFormValues,
  original: ProfileFormValues,
): UpdateProfileRequest {
  const update: Record<string, string | number | null> = {};
  for (const key of Object.keys(values) as (keyof ProfileFormValues)[]) {
    const next = values[key];
    if (next === original[key] || (typeof next === 'string' && next.trim() === original[key])) {
      continue;
    }
    if (typeof next !== 'string') update[key] = next;
    else if (key === 'full_name') update[key] = next.trim();
    else if (key === 'year_of_birth') update[key] = next.trim() ? Number(next) : null;
    else update[key] = next.trim() || null;
  }
  return update as UpdateProfileRequest;
}
