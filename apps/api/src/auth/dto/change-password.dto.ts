import { PASSWORD_MIN_LENGTH, type ChangePasswordRequest } from '@drmayday/shared';
import { IsDefined, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * PUT /auth/change-password — Sheet tab "1.5 change_password". confirm_password khớp new_password
 * hay không do AuthService kiểm tra (2003), trước khi kiểm tra mật khẩu cũ.
 */
export class ChangePasswordDto implements ChangePasswordRequest {
  @IsDefined()
  @IsString()
  @IsNotEmpty() // chuỗi rỗng → 2001 như mọi trường bắt buộc
  old_password: string;

  @IsDefined()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  new_password: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  confirm_password: string;
}
