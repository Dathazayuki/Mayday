import type { LoginRequest } from '@drmayday/shared';
import { IsDefined, IsNotEmpty, IsString } from 'class-validator';
import { IsVietnamPhone } from '../../common/is-vietnam-phone.decorator.js';

/** POST /auth/login — Sheet tab "1.2 login". */
export class LoginDto implements LoginRequest {
  @IsDefined()
  @IsString()
  @IsVietnamPhone()
  phone: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty() // chuỗi rỗng → 2001 như mọi trường bắt buộc
  password: string;
}
