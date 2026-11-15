import { applyDecorators } from '@nestjs/common';
import { IntersectionType, OmitType } from '@nestjs/swagger';
import {
  GENDER_VALUES,
  type CreatePatientRequest,
  type Gender,
  type PatientSearchQuery,
  type UpdatePatientRequest,
} from '@drmayday/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SignupDto } from '../../auth/dto/signup.dto.js';
import { integerQueryValue, PaginationQuery } from '../../common/paginated.js';
import { isBlank } from '../../common/text.js';
import { UpdateProfileDto } from '../../profile/dto/update-profile.dto.js';

/** Năm lớn nhất của bộ lọc năm sinh (năm 4 chữ số): ngoài [0, 9999] → 2003; 0 nghĩa như vắng (docpat01). */
export const BIRTH_YEAR_QUERY_MAX = 9999;

/** Query chuỗi tuỳ chọn: bỏ khoảng trắng hai đầu; vắng, rỗng hoặc chỉ có khoảng trắng = không lọc. */
const TrimmedQuery = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );

/** min_year/max_year: chuỗi số nguyên → number; vắng hoặc rỗng = không lọc; sai dạng → 2002. */
const BirthYearQuery = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      isBlank(value) ? undefined : integerQueryValue(value),
    ),
    IsInt(),
    Min(0),
    Max(BIRTH_YEAR_QUERY_MAX),
  );

/**
 * GET /doctor/patients/search (docpat01). Luật bắt cặp min_year/max_year của Sheet (bằng nhau, một bên
 * là 0 hoặc vắng → đúng năm đó; min_year > max_year → 2003) do PatientsService áp.
 */
export class SearchPatientsQuery extends PaginationQuery implements PatientSearchQuery {
  @IsOptional()
  @TrimmedQuery()
  @IsString()
  keyword?: string;

  @IsOptional()
  @TrimmedQuery()
  @IsIn(GENDER_VALUES) // other → 2003 (MT-59)
  gender?: Gender;

  @BirthYearQuery()
  min_year?: number;

  @BirthYearQuery()
  max_year?: number;
}

/**
 * POST /doctor/patients/create (docpat02): trường tài khoản như signup (`password` bắt buộc, MT-119)
 * cộng trường hồ sơ bệnh nhân như PUT profile. `work_place` không có cột: whitelist lược bỏ.
 */
export class CreatePatientDto
  extends IntersectionType(SignupDto, OmitType(UpdateProfileDto, ['full_name', 'gender'] as const))
  implements CreatePatientRequest {}

/**
 * PUT /doctor/patients/:id (MT-120): đúng các trường của PUT profile; số điện thoại không đổi được
 * (`phone` không có trong DTO nên whitelist lược bỏ). Ít nhất 1 trường do PatientsService kiểm (2001).
 */
export class UpdatePatientDto extends UpdateProfileDto implements UpdatePatientRequest {}
