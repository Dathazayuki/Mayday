import { SetMetadata } from '@nestjs/common';
import type { ResponseCode as Code } from '@drmayday/shared';

export const RESPONSE_CODE_KEY = 'drmayday:response-code';

/** Mã trả về khi thành công. Mặc định 1000; API tạo mới dùng @ResponseCode('1001'). */
export const ResponseCode = (code: Code) => SetMetadata(RESPONSE_CODE_KEY, code);
