/** POST /api/v1/auth/login — Sheet, tab "1.2 login". */
export interface LoginRequest {
  phone: string;
  password: string;
}

/** data.user_info của login. Sheet ghi mọi trường kiểu string (MT-06, MT-31). */
export interface LoginUserInfo {
  user_id: string;
  full_name: string;
  phone: string;
  role_id: string;
}

export interface LoginResponseData {
  token: string;
  user_info: LoginUserInfo;
}
