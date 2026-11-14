import { Banner } from '@/components/banner';
import { PrimaryButton } from '@/components/primary-button';

/** Lỗi tải dữ liệu kèm nút "Thử lại". */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      <Banner tone="error" message={message} />
      <PrimaryButton title="Thử lại" variant="secondary" onPress={onRetry} />
    </>
  );
}
