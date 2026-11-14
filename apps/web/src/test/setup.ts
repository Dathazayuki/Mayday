import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';

// Đo được: lần render đầu của antd (test đầu tiên mỗi file) mất ~1,1 giây khi chạy riêng và ~2 giây
// khi chạy cả bộ song song, vượt 1 giây mặc định của findBy*/waitFor (cùng nguyên nhân với testTimeout).
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
