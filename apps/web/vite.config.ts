import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// envDir trỏ về thư mục gốc monorepo để dùng chung file .env (VITE_API_BASE_URL).
export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  server: { port: 5173 },
});
