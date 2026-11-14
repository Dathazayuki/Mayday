# Phần bổ sung: AI dự đoán ảnh (chỉ có trong Sheet, không có slide)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

## API có trong Sheet nhưng không có slide

### POST /api/ai/predict/image

- Tab Sheet: [`POST /api/ai/predict/image`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1202201005)

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Xuất file ảnh đã gắn Bounding Box từ AI

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | Header truyền Bearer Token xác thực (Bearer <token>) |
| 2 | `image` | file | O | Tệp hình ảnh da gốc cần phát hiện nốt sẩn |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Content-Type` | string | O | Định dạng luồng tệp ảnh nhị phân (image/jpeg) |
| 2 | `Binary_Stream` | file | O | Tệp ảnh nhị phân đã được AI vẽ khung viền (Bounding Box) nốt mề đay |
