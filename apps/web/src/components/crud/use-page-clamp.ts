import { PAGE_DEFAULT } from '@drmayday/shared';

/**
 * Trang hiện tại không còn dòng nào (vừa xoá dòng cuối của trang cuối): lùi về trang cuối hợp lệ.
 * Bỏ qua dữ liệu giữ chỗ của trang trước (placeholderData) vì chưa phải kết quả của trang này.
 */
export function usePageClamp({
  data,
  isPlaceholderData,
  page,
  limit,
  setPage,
}: {
  data: { items: readonly unknown[]; total: number } | undefined;
  isPlaceholderData: boolean;
  page: number;
  limit: number;
  setPage: (page: number) => void;
}) {
  if (data && !isPlaceholderData && data.items.length === 0 && page > PAGE_DEFAULT) {
    setPage(Math.max(PAGE_DEFAULT, Math.ceil(data.total / limit)));
  }
}
