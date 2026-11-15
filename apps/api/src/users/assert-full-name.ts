import { AppException } from '../common/app.exception.js';
import { isBlank } from '../common/text.js';

/**
 * full_name khi sửa (PUT profile, PUT admin/users/:id): vắng thì giữ nguyên. null lọt qua
 * `@IsOptional()` của DTO, nhưng họ tên không xoá được nên null hoặc chỉ có khoảng trắng → 2003.
 */
export function assertFullNameNotBlank(fullName: string | null | undefined): void {
  if (fullName === null || isBlank(fullName)) {
    throw new AppException('2003', { field: 'full_name' });
  }
}
