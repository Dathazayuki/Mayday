import {
  FIELD_LIMITS,
  GENDER_VALUES,
  PASSWORD_MIN_LENGTH,
  type Gender,
  type SignupRequest,
} from '@drmayday/shared';
import {
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsVietnamPhone } from '../../common/is-vietnam-phone.decorator.js';

/** POST /auth/signup — Sheet tab "1.1 signup". */
export class SignupDto implements SignupRequest {
  @IsDefined()
  @IsString()
  @MaxLength(FIELD_LIMITS.full_name) // nguoi.ho_ten VARCHAR(150)
  @Matches(/\S/) // chỉ có khoảng trắng → 2003
  full_name: string;

  @IsDefined()
  @IsString()
  @IsVietnamPhone()
  phone: string;

  @IsDefined()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  password: string;

  @IsOptional()
  @IsIn(GENDER_VALUES)
  gender?: Gender;
}
