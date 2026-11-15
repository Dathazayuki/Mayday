import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { createValidationPipe, validationErrorsToException } from '../../common/validation.js';
import {
  BIRTH_YEAR_QUERY_MAX,
  CreatePatientDto,
  SearchPatientsQuery,
  UpdatePatientDto,
} from './patient.dto.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
async function codeFor<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

/** Body sau ValidationPipe toàn cục (whitelist). */
async function throughPipe(type: ClassConstructor<object>, body: Record<string, unknown>) {
  return (await createValidationPipe().transform(body, { type: 'body', metatype: type })) as Record<
    string,
    unknown
  >;
}

describe('SearchPatientsQuery (docpat01)', () => {
  it('kế thừa phân trang; mọi bộ lọc vắng = không lọc', async () => {
    expect(plainToInstance(SearchPatientsQuery, {})).toMatchObject({
      page: 1,
      limit: 20,
      keyword: undefined,
      gender: undefined,
      min_year: undefined,
      max_year: undefined,
    });
    expect(await codeFor(SearchPatientsQuery, {})).toBeNull();
  });

  it('keyword, gender cắt khoảng trắng hai đầu; rỗng hoặc chỉ có khoảng trắng = không lọc', async () => {
    expect(plainToInstance(SearchPatientsQuery, { keyword: '  Mai ' }).keyword).toBe('Mai');
    expect(plainToInstance(SearchPatientsQuery, { keyword: '   ' }).keyword).toBeUndefined();
    expect(plainToInstance(SearchPatientsQuery, { gender: '' }).gender).toBeUndefined();
    expect(await codeFor(SearchPatientsQuery, { keyword: '   ', gender: '' })).toBeNull();
  });

  it('năm sinh: chuỗi số nguyên → number; 0 hợp lệ (luật của Sheet); rỗng = không lọc', async () => {
    expect(plainToInstance(SearchPatientsQuery, { min_year: '1990', max_year: '0' })).toMatchObject(
      {
        min_year: 1990,
        max_year: 0,
      },
    );
    expect(await codeFor(SearchPatientsQuery, { min_year: '1990', max_year: '0' })).toBeNull();
    expect(plainToInstance(SearchPatientsQuery, { min_year: '' }).min_year).toBeUndefined();
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['gender other (MT-59)', { gender: 'other' }, '2003'],
    ['min_year âm', { min_year: '-1' }, '2003'],
    [`max_year > ${BIRTH_YEAR_QUERY_MAX}`, { max_year: '10000' }, '2003'],
    ['min_year không phải số nguyên', { min_year: '1990.5' }, '2002'],
    ['min_year có chữ', { min_year: 'abc' }, '2002'],
    ['keyword lặp lại (mảng)', { keyword: ['a', 'b'] }, '2002'],
    ['limit 101', { limit: '101' }, '2003'],
  ])('%s → %s', async (_name, query, code) => {
    expect(await codeFor(SearchPatientsQuery, query)).toBe(code);
  });
});

describe('CreatePatientDto (docpat02)', () => {
  const valid = { full_name: 'Lê Thị Mai', phone: '0911111111', password: 'matkhau' };

  it('đủ full_name, phone, password là hợp lệ; gender và trường hồ sơ không bắt buộc', async () => {
    expect(await codeFor(CreatePatientDto, valid)).toBeNull();
    expect(
      await codeFor(CreatePatientDto, {
        ...valid,
        gender: 'female',
        year_of_birth: 1990,
        career: 'Cong nhan',
        ethnic: 'Kinh',
        health_insurance_validate: '2027-03-31',
        next_of_kin_phone: '0987654321',
      }),
    ).toBeNull();
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['thiếu password (MT-119)', { password: undefined }, '2001'],
    ['password ngắn hơn 6 ký tự', { password: '12345' }, '2003'],
    ['thiếu full_name', { full_name: undefined }, '2001'],
    ['full_name chỉ có khoảng trắng', { full_name: '   ' }, '2003'],
    ['thiếu phone', { phone: undefined }, '2001'],
    ['phone sai định dạng', { phone: '12345' }, '2004'],
    ['gender other (MT-59)', { gender: 'other' }, '2003'],
    ['career ngoài 5 giá trị', { career: 'Bac si' }, '2003'],
    ['year_of_birth ngoài 1900..năm nay', { year_of_birth: 1800 }, '2003'],
    ['year_of_birth không phải số', { year_of_birth: 'abc' }, '2002'],
    ['ethnic dài quá 50 ký tự', { ethnic: 'a'.repeat(51) }, '2003'],
    [
      'health_insurance_validate không có thật',
      { health_insurance_validate: '2027-02-30' },
      '2006',
    ],
    ['next_of_kin_phone sai định dạng', { next_of_kin_phone: '123' }, '2004'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreatePatientDto, { ...valid, ...override })).toBe(code);
  });

  it('trường hồ sơ để trống → null (BlankAsNull); work_place không có cột → whitelist lược bỏ', async () => {
    expect(plainToInstance(CreatePatientDto, { ...valid, ethnic: ' ' }).ethnic).toBeNull();
    const dto = await throughPipe(CreatePatientDto, { ...valid, work_place: 'Công ty A' });
    expect(dto).not.toHaveProperty('work_place');
    expect(dto).toMatchObject(valid);
  });
});

describe('UpdatePatientDto (PUT /doctor/patients/:id)', () => {
  it('như PUT profile: mọi trường không bắt buộc, body rỗng vẫn qua validate (service trả 2001)', async () => {
    expect(await codeFor(UpdatePatientDto, {})).toBeNull();
    expect(
      await codeFor(UpdatePatientDto, { full_name: 'B', gender: null, ethnic: 'Kinh' }),
    ).toBeNull();
    expect(await codeFor(UpdatePatientDto, { next_of_kin_phone: '123' })).toBe('2004');
  });

  it('phone không có trong DTO: whitelist lược bỏ (không đổi được số điện thoại)', async () => {
    const dto = await throughPipe(UpdatePatientDto, { phone: '0999999999', ethnic: 'Kinh' });
    expect(dto).not.toHaveProperty('phone');
    expect(dto).toMatchObject({ ethnic: 'Kinh' });
  });
});
