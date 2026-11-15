import {
  PASSWORD_MIN_LENGTH,
  isValidVietnamPhone,
  type ChangePasswordRequest,
  type FieldErrors,
} from '@drmayday/shared';

export function validatePhone(phone: string): string | null {
  if (!phone) return 'Vui lòng nhập số điện thoại';
  if (!isValidVietnamPhone(phone)) return 'Số điện thoại không đúng định dạng (VD: 0912345678)';
  return null;
}

/** Số điện thoại không bắt buộc: để trống là hợp lệ. */
export function validateOptionalPhone(phone: string): string | null {
  return phone.trim() ? validatePhone(phone.trim()) : null;
}

function validateNewPassword(password: string, label: string): string | null {
  if (!password) return `Vui lòng nhập ${label}`;
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Độ dài ${label} tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`;
  }
  return null;
}

function validateConfirm(confirm: string, password: string): string | null {
  if (!confirm) return 'Vui lòng nhập lại mật khẩu';
  if (confirm !== password) return 'Mật khẩu nhập lại không khớp';
  return null;
}

export interface SignupValues {
  fullName: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export function validateSignup(values: SignupValues): FieldErrors<keyof SignupValues> {
  const errors: FieldErrors<keyof SignupValues> = {};
  if (!values.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên';
  const phoneError = validatePhone(values.phone);
  if (phoneError) errors.phone = phoneError;
  const passwordError = validateNewPassword(values.password, 'mật khẩu');
  if (passwordError) errors.password = passwordError;
  const confirmError = validateConfirm(values.confirmPassword, values.password);
  if (confirmError) errors.confirmPassword = confirmError;
  return errors;
}

export function validateChangePassword(
  values: ChangePasswordRequest,
): FieldErrors<keyof ChangePasswordRequest> {
  const errors: FieldErrors<keyof ChangePasswordRequest> = {};
  if (!values.old_password) errors.old_password = 'Vui lòng nhập mật khẩu hiện tại';
  const newError = validateNewPassword(values.new_password, 'mật khẩu mới');
  if (newError) errors.new_password = newError;
  const confirmError = validateConfirm(values.confirm_password, values.new_password);
  if (confirmError) errors.confirm_password = confirmError;
  return errors;
}
