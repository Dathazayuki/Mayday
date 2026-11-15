-- Chạy một lần khi khởi tạo volume postgres-data: CSDL riêng cho test tích hợp. Không nạp schema ở đây; schema chỉ nạp qua apps/api/scripts/load-schema.mjs (spec A, mục 3.2).
CREATE DATABASE drmayday_test;
