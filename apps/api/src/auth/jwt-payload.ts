/** Nội dung access token. Giai đoạn 1 phát hành token khi đăng nhập; jti dùng cho token_blacklist. */
export interface JwtPayload {
  sub: string;
  role_id: string;
  jti: string;
}
