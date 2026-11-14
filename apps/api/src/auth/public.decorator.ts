import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'drmayday:is-public';

/** Route không cần đăng nhập (đăng ký, đăng nhập, health...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
