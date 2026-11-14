import {
  CAREER_VALUES,
  GENDER_VALUES,
  type Career,
  type Gender,
  type UpdateProfileRequest,
} from '@drmayday/shared';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsIsoDate } from '../../common/is-iso-date.decorator.js';
import { IsOptionalOrBlank } from '../../common/is-optional-or-blank.decorator.js';
import { IsVietnamPhone } from '../../common/is-vietnam-phone.decorator.js';
import { IsYearOfBirth } from '../../common/is-year-of-birth.decorator.js';

/** Các cột chữ của `patients` là varchar(100). */
const PATIENT_TEXT_MAX_LENGTH = 100;

/**
 * PUT /profile — Sheet tab "PUT /api/profile". Mọi trường không bắt buộc; null hoặc chuỗi trống xoá
 * giá trị (profileUpdateToDb đổi thành null). ProfileService kiểm tra phần còn lại: ít nhất 1 trường
 * (2001), full_name không trống (2003), nhân viên không gửi trường của bệnh nhân (2003).
 */
export class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional()
  @IsString()
  @MaxLength(255) // users.ho_ten varchar(255)
  full_name?: string;

  @IsOptionalOrBlank()
  @IsIn(GENDER_VALUES)
  gender?: Gender | null;

  @IsOptionalOrBlank()
  @IsInt()
  @IsYearOfBirth()
  year_of_birth?: number | null;

  @IsOptionalOrBlank()
  @IsIn(CAREER_VALUES)
  career?: Career | null;

  @IsOptionalOrBlank()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  ethnic?: string | null;

  @IsOptionalOrBlank()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  hamlet_address?: string | null;

  @IsOptionalOrBlank()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  commune_address?: string | null;

  @IsOptionalOrBlank()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  city_address?: string | null;

  @IsOptionalOrBlank()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  work_place?: string | null;

  @IsOptionalOrBlank()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  health_insurance_number?: string | null;

  @IsOptionalOrBlank()
  @IsString()
  @IsIsoDate()
  health_insurance_validate?: string | null;

  @IsOptionalOrBlank()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  next_of_kin_name?: string | null;

  @IsOptionalOrBlank()
  @IsString()
  @IsVietnamPhone()
  next_of_kin_phone?: string | null;
}
