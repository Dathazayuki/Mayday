-- Chạy một lần khi khởi tạo volume mysql-data: CSDL riêng cho test tích hợp (pnpm --filter @drmayday/api test:db).
CREATE DATABASE IF NOT EXISTS `drmayday_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON `drmayday_test`.* TO 'drmayday'@'%';
