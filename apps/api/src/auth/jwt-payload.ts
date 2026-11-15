/** Nội dung access token do login ký; jti dùng cho TokenDenylist khi đăng xuất. */
export interface JwtPayload {
  sub: string;
  role_id: string;
  jti: string;
}

/** Payload sau khi JwtAuthGuard verify: có thêm claim `exp`/`iat` (giây). */
export type VerifiedJwt = JwtPayload & { exp: number; iat: number };
