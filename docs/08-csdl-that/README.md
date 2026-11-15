# CSDL thật (nhóm DB)

> Tài liệu viết tay. CSDL thật **thay thế** [03-co-so-du-lieu.md](../03-co-so-du-lieu.md) ở mọi chỗ hai bên khác nhau. `docs/03` là file sinh tự động từ tài liệu CSDL cũ nên không sửa.

## Nguồn

| Mục | Giá trị |
|---|---|
| Repo | <https://github.com/ngminhan/mayday-database.git> |
| Commit | `a98776a8c6ac3e73f041acc6fc75f064e6408402` (2026-10-28) |
| File | `final_restructured.sql`: PostgreSQL, 1757 dòng, 43 bảng + 1 view. File ghi "Fresh database only; this file is not a migration" |
| sha256 | `bed1f913dc45e8961448f6be3519212a9f1aa80a08a5fe0873211b72b7176676` (đúng byte của blob, xuống dòng CRLF) |
| Ngày nhận | 2026-11-15 |
| Bản sao trong repo | `apps/api/prisma/vendor/mayday-database/` cùng `source.json`, tạo ở bước A1 của spec A |

**Quy tắc:** cả lớp dùng chung lược đồ này nên phải dùng nguyên văn: không thêm bảng, cột, schema, enum, trigger hay index. Không chạy `prisma db push`/`migrate` lên CSDL này.

## Tài liệu trong thư mục

| File | Nội dung |
|---|---|
| [bao-cao-so-sanh-db.md](bao-cao-so-sanh-db.md) | So sánh với CSDL dev tạm (MySQL theo docs/03): ánh xạ từng bảng, khái niệm còn thiếu, ảnh hưởng tới từng giai đoạn, trạng thái các mục MT, câu hỏi cho nhóm DB |
| [ket-qua-spike-prisma.md](ket-qua-spike-prisma.md) | Kết quả chạy thử Prisma 7.10.1 + PostgreSQL 17: những gì `db pull` sinh ra và phải sửa, dạng lỗi (unique, CHECK, FK hoãn kiểm tra, mất kết nối), `bigint`, `INTERVAL`, cột generated, view |

Thiết kế chuyển đổi:
- [Spec A: nền tảng và giai đoạn 1–2](../superpowers/specs/2026-11-15-csdl-that-a-nen-tang-design.md).
- Tiểu dự án B (hồ sơ và phiên khám, giai đoạn 3/4) và C (giai đoạn 5–8, sàng lọc báo động đỏ, nhắc việc) sẽ có spec riêng.

## Khi nhóm DB đổi lược đồ

1. Thay file trong `apps/api/prisma/vendor/mayday-database/` và cập nhật `source.json` (commit, sha256, ngày). Không sửa nội dung SQL.
2. `pnpm --filter @drmayday/api db:reset`, rồi `pnpm --filter @drmayday/api db:pull` (pull, sửa schema bằng script patch, generate).
3. Đọc diff của `prisma/schema.prisma`. Sửa repository và mapping theo diff. Nếu script patch báo lỗi thì sửa script.
4. Chạy `pnpm --filter @drmayday/api test:db`. Lệnh này kiểm cả việc schema đã commit có khớp file SQL không.
5. Ghi mâu thuẫn mới vào [05-mau-thuan-can-chot.md](../05-mau-thuan-can-chot.md).
