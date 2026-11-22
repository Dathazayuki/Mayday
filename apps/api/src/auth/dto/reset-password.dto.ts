import { PASSWORD_MIN_LENGTH } from '@drmayday/shared';
import { IsDefined, IsString, Matches, MinLength } from 'class-validator';
import { IsVietnamPhone } from '../../common/is-vietnam-phone.decorator.js';

/** POST /auth/reset-password — đặt lại mật khẩu bằng OTP 6 chữ số. */
export class ResetPasswordDto {
  @IsDefined()
  @IsString()
  @IsVietnamPhone()
  phone: string;

  @IsDefined()
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;

  @IsDefined()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  new_password: string;
}
