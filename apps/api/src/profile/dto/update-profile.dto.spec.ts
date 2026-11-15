import { PATIENT_EDITABLE_FIELDS } from '@drmayday/shared';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { UpdateProfileDto } from './update-profile.dto.js';

const full = {
  full_name: 'Nguyễn Văn A',
  gender: 'male',
  year_of_birth: 1990,
  career: 'Hoc sinh - Sinh vien',
  ethnic: 'Kinh',
  hamlet_address: 'Thôn 1',
  commune_address: 'Xã A',
  city_address: 'Hà Nội',
  health_insurance_number: 'HS4010123456789',
  health_insurance_validate: '2027-03-31',
  next_of_kin_name: 'Nguyễn Văn C, Thôn 1',
  next_of_kin_phone: '0987654321',
};
const CLEARABLE_FIELDS = ['gender', ...PATIENT_EDITABLE_FIELDS];

/** Lỗi đầu tiên mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function errorFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(UpdateProfileDto, body));
  if (errors.length === 0) return null;
  const { code, data } = validationErrorsToException(errors);
  return { code, data };
}

describe('UpdateProfileDto', () => {
  it('hợp lệ với đủ mọi trường; body rỗng do ProfileService chặn (2001)', async () => {
    expect(await errorFor(full)).toBeNull();
    expect(await errorFor({})).toBeNull();
  });

  it.each(CLEARABLE_FIELDS)(
    '%s = null hoặc chuỗi trống (xoá giá trị) → hợp lệ, service nhận null',
    async (field) => {
      for (const value of [null, '', '   ']) {
        const dto = plainToInstance(UpdateProfileDto, { [field]: value });
        expect(dto[field as keyof UpdateProfileDto]).toBeNull();
        expect(await validate(dto)).toEqual([]);
      }
    },
  );

  it('full_name trống giữ nguyên, không bị DTO chặn: ProfileService trả 2003 thay vì 2001', async () => {
    expect(plainToInstance(UpdateProfileDto, { full_name: '  ' }).full_name).toBe('  ');
    expect(await errorFor({ full_name: '' })).toBeNull();
    expect(await errorFor({ full_name: null })).toBeNull();
  });

  it('chuỗi có nội dung giữ nguyên (cột chữ được trim khi ghi, ở profileUpdateToDb)', () => {
    expect(plainToInstance(UpdateProfileDto, { ethnic: ' Kinh ' }).ethnic).toBe(' Kinh ');
  });

  const nextYear = new Date().getFullYear() + 1;
  it.each<[string, Record<string, unknown>, string]>([
    ['full_name không phải chuỗi', { full_name: 123 }, '2002'],
    ['full_name dài quá 150 ký tự', { full_name: 'A'.repeat(151) }, '2003'],
    ['gender ngoài danh sách', { gender: 'x' }, '2003'],
    ['gender other (MT-59)', { gender: 'other' }, '2003'],
    ['year_of_birth chứa chữ', { year_of_birth: 'abc' }, '2002'],
    ['year_of_birth là chuỗi số', { year_of_birth: '1990' }, '2002'],
    ['year_of_birth là số thực', { year_of_birth: 1990.5 }, '2002'],
    ['year_of_birth trước 1900', { year_of_birth: 1899 }, '2003'],
    ['year_of_birth sau năm hiện tại', { year_of_birth: nextYear }, '2003'],
    ['career ngoài 5 giá trị CSDL', { career: 'Bác sĩ' }, '2003'],
    ['ethnic không phải chuỗi', { ethnic: 1 }, '2002'],
    ['ethnic dài quá 50 ký tự', { ethnic: 'A'.repeat(51) }, '2003'],
    ['hamlet_address dài quá 255 ký tự', { hamlet_address: 'A'.repeat(256) }, '2003'],
    ['commune_address dài quá 100 ký tự', { commune_address: 'A'.repeat(101) }, '2003'],
    [
      'health_insurance_number dài quá 30 ký tự',
      { health_insurance_number: 'A'.repeat(31) },
      '2003',
    ],
    ['next_of_kin_name dài quá 100 ký tự', { next_of_kin_name: 'A'.repeat(101) }, '2003'],
    [
      'health_insurance_validate không có thật',
      { health_insurance_validate: '2026-02-30' },
      '2006',
    ],
    ['health_insurance_validate sai dạng', { health_insurance_validate: '31/03/2027' }, '2006'],
    ['health_insurance_validate là số', { health_insurance_validate: 20270331 }, '2002'],
    ['next_of_kin_phone sai định dạng', { next_of_kin_phone: '12345' }, '2004'],
  ])('%s → %s', async (_name, body, code) => {
    const [field] = Object.keys(body);
    expect(await errorFor(body)).toEqual({ code, data: { field } });
  });

  it('chuỗi ở giới hạn độ dài cột vẫn hợp lệ', async () => {
    expect(
      await errorFor({
        full_name: 'A'.repeat(150),
        ethnic: 'A'.repeat(50),
        hamlet_address: 'A'.repeat(255),
        health_insurance_number: 'A'.repeat(30),
      }),
    ).toBeNull();
  });
});
