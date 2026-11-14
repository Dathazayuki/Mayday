/** State truyền qua router tới trang đăng nhập. */
export interface LoginLocationState {
  from?: string;
  notice?: typeof PASSWORD_CHANGED_NOTICE;
}

export const PASSWORD_CHANGED_NOTICE = 'password-changed';
