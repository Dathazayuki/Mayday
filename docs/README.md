# Tài liệu chuẩn dự án DrMayDay

> Hướng dẫn cài đặt và chạy code: [README ở thư mục gốc](../README.md).

Hệ thống quản lý khám bệnh và theo dõi bệnh mề đay (DrMayDay). Thư mục `docs/` là **tài liệu chuẩn** của dự án. Toàn bộ nội dung được tổng hợp và đối chiếu từ tài liệu gốc, bản chụp ngày **2026-11-14**.

## Quy tắc sử dụng

1. Khi triển khai, tra cứu ở đây trước.
2. **Trước khi code một API hoặc một bảng, mở lại tài liệu gốc để đối chiếu.** Mỗi mục đều có link về đúng tab Sheet hoặc đúng file gốc, vì tài liệu gốc có thể đã thay đổi sau ngày chụp.
3. Gặp chỗ lệch giữa các nguồn thì xem [05-mau-thuan-can-chot.md](05-mau-thuan-can-chot.md). Mục nào đang "Chờ chốt" thì không tự quyết.
4. Các file có dòng "sinh tự động" thì **không sửa tay**. Muốn cập nhật thì chạy lại script (xem cuối trang).

## Mục lục

| File | Nội dung | Nguồn gốc |
|---|---|---|
| [01-tong-quan-yeu-cau.md](01-tong-quan-yeu-cau.md) | Tổng quan đề tài, yêu cầu chức năng và phi chức năng, tóm tắt CSDL | SLIDE1 |
| [02-api/README.md](02-api/README.md) | **Danh sách đủ 100 API**: method, đường dẫn, mã slide | Sheet API + SLIDE2–11 |
| [02-api/00-quy-uoc-va-ma-phan-hoi.md](02-api/00-quy-uoc-va-ma-phan-hoi.md) | Bảng mã phản hồi (response code) | Sheet, tab "3. response code" |
| `02-api/01` → `02-api/11` | Từng phần API: mô tả, test case, bảng Input/Output, kết quả đối chiếu ảnh slide | Sheet + slide |
| [03-co-so-du-lieu.md](03-co-so-du-lieu.md) | Tài liệu mô tả CSDL, **kèm các sửa đổi đang theo dõi (track changes)** | Google Doc CSDL |
| [04-tu-dien-du-lieu-183-bien.md](04-tu-dien-du-lieu-183-bien.md) | Từ điển 183 biến lâm sàng, luật cảnh báo phản vệ, CDSS | Google Doc của BV Da liễu TW |
| [05-mau-thuan-can-chot.md](05-mau-thuan-can-chot.md) | **Mâu thuẫn giữa các nguồn và điểm cần chốt** (viết tay) | Tổng hợp |
| [06-ke-hoach-tuan-va-api-cu.md](06-ke-hoach-tuan-va-api-cu.md) | Kế hoạch 10 tuần (91 API) và danh sách API của đồ án cũ | Sheet, tab 1 và 2 |
| [07-tien-do.md](07-tien-do.md) | **Checklist tiến độ triển khai** theo giai đoạn/slice (viết tay) | Kế hoạch trong `superpowers/plans/` |
| `nguon/` | Bản chụp tài liệu gốc (xlsx, docx), tên tab Sheet, bản chép nội dung ảnh slide | Tải tự động |

## Tài liệu gốc

| Tài liệu | Vị trí |
|---|---|
| 11 bộ slide (SLIDE1 tổng quan, SLIDE2–11 các phần API) | `tai-lieu-goc/` |
| Sheet API (103 tab: kế hoạch, API cũ, mã phản hồi, 100 tab đặc tả) | <https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA> |
| Tài liệu mô tả CSDL | <https://docs.google.com/document/d/1smCGZ0DYY9HXpxjmnyOGg-3Or34GPX-L> |
| Từ điển dữ liệu 183 biến (v2.0, 04/09/2026) | <https://docs.google.com/document/d/1kGWCfqyb7g1yOBE8qmR4P_u1dLlFqjuB> |

## Mức độ đã đọc và đối chiếu

- **Slide:** đọc toàn bộ chữ và ghi chú của 11 file (363 slide). Không có SmartArt, biểu đồ hay đối tượng nhúng nào bị bỏ sót.
- **Ảnh trong slide:** 100 ảnh bảng API đều đã được chép lại (`nguon/anh-slide-chep-lai/`) và đối chiếu với Sheet. 96 ảnh khớp, 4 slide gắn nhầm ảnh (đã ghi chú). Ảnh "Danh sách API" là một mã QR.
- **Sheet:** đủ 103 tab. Tên tab thật (có method và đường dẫn) lấy từ trang htmlview, vì bản xlsx bị cắt tên.
- **Tài liệu CSDL:** đọc cả phần trong content control và các sửa đổi đang theo dõi. Bản xuất chữ của Google Docs **không hiện** các sửa đổi này.
- **Từ điển dữ liệu:** đọc toàn bộ.
- **Chưa truy cập được:** xem mục D trong [05-mau-thuan-can-chot.md](05-mau-thuan-can-chot.md).

## Cập nhật khi tài liệu gốc thay đổi

Yêu cầu Python 3.11+ cùng các gói `openpyxl`, `python-pptx`, `python-docx`.

```bash
python docs/_tools/fetch_sources.py   # tải bản chụp mới vào docs/nguon/
python docs/_tools/build_docs.py      # sinh lại các file .md tự động
```

Nếu slide thay đổi, chép file mới vào `tai-lieu-goc/` rồi chạy `build_docs.py`. Sau mỗi lần cập nhật, xem lại [05-mau-thuan-can-chot.md](05-mau-thuan-can-chot.md) vì file này viết tay, không tự cập nhật. Các đường dẫn ghi trong slide và kết quả đối chiếu ảnh được khai báo trong `build_docs.py` (`SLIDE_PATHS`, `IMAGE_NOTES`, `TEXT_NOTES`), nên khi slide đổi thì cũng cần cập nhật các khai báo này.
