import {
  CAREER_VALUES,
  GENDER_VALUES,
  type Career,
  type Gender,
  type UpdateProfileRequest,
} from '@drmayday/shared';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { BlankAsNull } from '../../common/blank-as-null.decorator.js';
import { IsIsoDate } from '../../common/is-iso-date.decorator.js';
import { IsVietnamPhone } from '../../common/is-vietnam-phone.decorator.js';
import { IsYearOfBirth } from '../../common/is-year-of-birth.decorator.js';

/** Các cột chữ của `patients` là varchar(100). */
const PATIENT_TEXT_MAX_LENGTH = 100;

/**
 * PUT /profile — Sheet tab "PUT /api/profile". Mọi trường không bắt buộc; null hoặc chuỗi trống (đổi
 * thành null ngay khi nhận) xoá giá trị. ProfileService kiểm tra phần còn lại: ít nhất 1 trường (2001),
 * full_name không trống (2003), nhân viên không gửi trường của bệnh nhân (2003).
 */
export class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional()
  @IsString()
  @MaxLength(255) // users.ho_ten varchar(255)
  full_name?: string;

  @BlankAsNull()
  @IsOptional()
  @IsIn(GENDER_VALUES)
  gender?: Gender | null;

  @BlankAsNull()
  @IsOptional()
  @IsInt()
  @IsYearOfBirth()
  year_of_birth?: number | null;

  @BlankAsNull()
  @IsOptional()
  @IsIn(CAREER_VALUES)
  career?: Career | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  ethnic?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  hamlet_address?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  commune_address?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  city_address?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  work_place?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  health_insurance_number?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @IsIsoDate()
  health_insurance_validate?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(PATIENT_TEXT_MAX_LENGTH)
  next_of_kin_name?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @IsVietnamPhone()
  next_of_kin_phone?: string | null;
}
