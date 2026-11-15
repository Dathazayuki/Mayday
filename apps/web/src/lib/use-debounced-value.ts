import { useEffect, useState } from 'react';

/** Giá trị trễ `delayMs` sau lần đổi cuối: dùng cho ô gõ tìm kiếm gọi API (không gọi theo từng phím). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
