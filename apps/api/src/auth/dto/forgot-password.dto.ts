import type { ForgotPasswordRequest } from '@drmayday/shared';
import { IsDefined, IsString } from 'class-validator';
import { IsVietnamPhone } from '../../common/is-vietnam-phone.decorator.js';

/** POST /auth/forgot-password — Sheet tab "1.4 forgot_password". */
export class ForgotPasswordDto implements ForgotPasswordRequest {
  @IsDefined()
  @IsString()
  @IsVietnamPhone()
  phone: string;
}
