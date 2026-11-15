import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// envDir trỏ về thư mục gốc monorepo để dùng chung file .env (VITE_API_BASE_URL).
export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  // strictPort: API chỉ cho phép CORS từ http://localhost:5173, không tự đổi sang cổng khác.
  server: { port: 5173, strictPort: true },
});
