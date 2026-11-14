import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';

// Khi chạy cả bộ test song song, lần render đầu của antd có thể mất hơn 1 giây mặc định của findBy*/waitFor.
configure({ asyncUtilTimeout: 5000 });

// Ant Design dùng matchMedia cho layout co giãn; jsdom không có sẵn.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// Dropdown/Menu của antd quan sát kích thước; jsdom không có ResizeObserver.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
