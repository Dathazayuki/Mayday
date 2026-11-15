import {
  CAREER_VALUES,
  FIELD_LIMITS,
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

/**
 * PUT /profile — Sheet tab "PUT /api/profile". Mọi trường không bắt buộc; null hoặc chuỗi trống (đổi
 * thành null ngay khi nhận) xoá giá trị. ProfileService kiểm tra phần còn lại: ít nhất 1 trường (2001),
 * full_name không trống (2003), nhân viên không gửi trường của bệnh nhân (2003).
 */
export class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_LIMITS.full_name) // nguoi.ho_ten VARCHAR(150)
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
  @MaxLength(FIELD_LIMITS.ethnic) // benhnhan.dan_toc VARCHAR(50)
  ethnic?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_LIMITS.hamlet_address) // nguoi.dia_chi_so_nha_thon_pho VARCHAR(255)
  hamlet_address?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_LIMITS.commune_address) // nguoi.dia_chi_xa_phuong VARCHAR(100)
  commune_address?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_LIMITS.city_address) // nguoi.dia_chi_tinh_tp VARCHAR(100)
  city_address?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_LIMITS.health_insurance_number) // benhnhan.bhyt_so_the VARCHAR(30)
  health_insurance_number?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @IsIsoDate()
  health_insurance_validate?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_LIMITS.next_of_kin_name) // benhnhan.nguoi_nha_ho_ten_dia_chi TEXT, giữ giới hạn API
  next_of_kin_name?: string | null;

  @BlankAsNull()
  @IsOptional()
  @IsString()
  @IsVietnamPhone()
  next_of_kin_phone?: string | null;
}
