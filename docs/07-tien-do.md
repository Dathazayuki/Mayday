# Tiến độ triển khai

> Tài liệu viết tay, cập nhật sau mỗi slice. Ký hiệu: `[x]` xong (đã kiểm thử và review), `[~]` đang làm, `[ ]` chưa làm.
> Kế hoạch chi tiết từng giai đoạn: [superpowers/plans/](superpowers/plans/). Mâu thuẫn cần chốt: [05-mau-thuan-can-chot.md](05-mau-thuan-can-chot.md).

## Giai đoạn 0 — Nền tảng (xong 2026-11-15)

- [x] Monorepo pnpm, `packages/shared` (mã phản hồi, API client)
- [x] Khung API NestJS (envelope, mã lỗi, validation, guard JWT, Prisma lười, Swagger)
- [x] Khung Web (đăng nhập, layout, route bảo vệ)
- [x] Khung Mobile (đăng nhập, 5 tab)
- [x] MinIO bằng Docker

## Giai đoạn 1 — Xác thực, tài khoản, hồ sơ

Spec: [2026-11-15-giai-doan-1-xac-thuc-design.md](superpowers/specs/2026-11-15-giai-doan-1-xac-thuc-design.md) · Kế hoạch: [2026-11-15-giai-doan-1-xac-thuc.md](superpowers/plans/2026-11-15-giai-doan-1-xac-thuc.md)

- [ ] Slice 1.1 — Hợp đồng dùng chung (kiểu request/response, giới tính, nghề nghiệp, validators)
- [ ] Slice 1.2 — CSDL MySQL dev + schema nhóm A + seed + test tích hợp
- [ ] Slice 1.3 — API đăng ký / đăng nhập / đăng xuất + blacklist token
- [ ] Slice 1.4 — API quên mật khẩu / đổi mật khẩu / hồ sơ cá nhân
- [ ] Slice 1.5 — API tạo nhân viên (admin) + guard vai trò
- [ ] Slice 1.6 — Web: đăng xuất qua API, hồ sơ cá nhân, đổi mật khẩu
- [ ] Slice 1.7 — Mobile: đăng ký, quên mật khẩu, hồ sơ, đổi mật khẩu, đăng xuất
- [ ] Slice 1.8 — Tích hợp, chạy thử thật, tài liệu

## Các giai đoạn tiếp theo

- [ ] Giai đoạn 2 — Quản trị người dùng, vai trò, quyền (RBAC động), cơ sở vật chất
- [ ] Giai đoạn 3 — Mẫu phiếu khám động
- [ ] Giai đoạn 4 — Bệnh nhân, bệnh án
- [ ] Giai đoạn 5 — Kho ảnh / tệp đính kèm (MinIO)
- [ ] Giai đoạn 6 — Tổn thương da, UAS7
- [ ] Giai đoạn 7 — Đơn thuốc, xét nghiệm
- [ ] Giai đoạn 8 — Thông báo (FCM)
- [ ] Giai đoạn 9 — AI (chờ MT-24)
