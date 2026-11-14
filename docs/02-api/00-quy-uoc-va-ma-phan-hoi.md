# Mã phản hồi (response code)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: [Sheet API, tab "3. response code"](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1513579546).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

## Bảng mã chi tiết (bảng bên trái của tab)

Các test case trong slide đều dùng bảng này. Trong Sheet, trường `code` của response có kiểu `string`.

| Mã | Message | Ghi chú | Nhóm |
|---|---|---|---|
| 1000 | OK | Xử lý thành công | SUCCESS |
| 2001 | Missing required parameter | Thiếu trường thông tin bắt buộc | VALIDATION |
| 2002 | Invalid parameter type | Sai kiểu dữ liệu truyền vào | VALIDATION |
| 2003 | Invalid parameter value | Giá trị parameter không hợp lệ | VALIDATION |
| 2004 | Invalid phone number format | Số điện thoại không đúng chuẩn VN (03/05/07/08/09) | VALIDATION |
| 2005 | Invalid email format | Email sai định dạng | VALIDATION |
| 2006 | Invalid date format | Ngày tháng không đúng định dạng (YYYY-MM-DD) | VALIDATION |
| 2007 | Request body invalid | Body sai định dạng JSON | VALIDATION |
| 3001 | Token is invalid | JWT Token không hợp lệ hoặc bị giả mạo | AUTH |
| 3002 | Token expired | JWT Token đã hết hạn | AUTH |
| 3003 | User not authenticated | Chưa đăng nhập (Thiếu header Authorization) | AUTH |
| 3004 | OTP incorrect | Mã OTP không chính xác | AUTH |
| 3005 | OTP expired | Mã OTP đã hết hạn (Sau 10 phút) | AUTH |
| 3006 | User phone or email already exists | Số điện thoại hoặc email đã tồn tại | AUTH |
| 3007 | User account not found | Tài khoản không tồn tại | AUTH |
| 3008 | Password incorrect | Mật khẩu không chính xác | AUTH |
| 3009 | Old password incorrect | Mật khẩu cũ không chính xác khi đổi mật khẩu | AUTH |
| 3101 | Permission denied | Không có quyền thực hiện thao tác | AUTHORIZATION |
| 3102 | Admin role required | Chỉ dành cho Admin | AUTHORIZATION |
| 3103 | Doctor role required | Chỉ dành cho Bác sĩ | AUTHORIZATION |
| 3104 | Patient role required | Chỉ dành cho Bệnh nhân | AUTHORIZATION |
| 3105 | Doctor not assigned to this record | Bác sĩ không phụ trách bệnh án này | AUTHORIZATION |
| 3106 | Cannot access another user's data | Bệnh nhân không được xem dữ liệu người khác | AUTHORIZATION |
| 4001 | Medical record not found | Không tìm thấy bệnh án | MEDICAL_RECORD |
| 4002 | Active medical record required | Bệnh nhân cần có bệnh án đang hoạt động | MEDICAL_RECORD |
| 4003 | Medical record already completed | Bệnh án đã hoàn thành, không thể sửa | MEDICAL_RECORD |
| 4004 | Medical record not in pending status | Chỉ tiếp nhận bệnh án đang ở trạng thái pending | MEDICAL_RECORD |
| 4005 | Medical record already accepted by another doctor | Bệnh án đã có bác sĩ khác tiếp nhận | MEDICAL_RECORD |
| 4006 | Classification options incomplete | Thiếu câu trả lời phân loại | MEDICAL_RECORD |
| 4007 | Answers list cannot be empty | Danh sách câu trả lời rỗng | MEDICAL_RECORD |
| 4008 | Question not found in template | Câu hỏi không thuộc mẫu bệnh án này | MEDICAL_RECORD |
| 4009 | Invalid medical record status | Trạng thái bệnh án không hợp lệ | MEDICAL_RECORD |
| 4101 | Template not found | Không tìm thấy mẫu bệnh án | TEMPLATE |
| 4102 | Template code already exists | Mã template code đã tồn tại | TEMPLATE |
| 4103 | Section not found | Không tìm thấy Section | TEMPLATE |
| 4104 | Question not found | Không tìm thấy Question | TEMPLATE |
| 4105 | Template in use cannot be deleted | Mẫu bệnh án đang được dùng, không thể xóa | TEMPLATE |
| 5001 | Patient not eligible for UAS7 scoring | Không có bệnh án mãn tính đang hoạt động | UAS7 |
| 5002 | UAS7 score for this date already submitted | Đã chấm điểm ngày này rồi | UAS7 |
| 5003 | Invalid ISS7 itch score value | Điểm ngứa ISS7 phải từ 0 đến 3 | UAS7 |
| 5004 | Invalid HSS7 hive score value | Điểm mề đay HSS7 phải từ 0 đến 3 | UAS7 |
| 5005 | Score date is required | Thiếu ngày chấm điểm score_date | UAS7 |
| 6001 | Image file is required | Chưa chọn file ảnh upload | IMAGE |
| 6002 | Unsupported image file format | Chỉ chấp nhận file ảnh (jpg, png, webp) | IMAGE |
| 6003 | Image file size exceeds limit | Vượt quá dung lượng tối đa (5MB/10MB) | IMAGE |
| 6004 | Exceeded maximum batch upload count | Upload tối đa 10 ảnh 1 lần | IMAGE |
| 6005 | Image attachment not found | Không tìm thấy ảnh đính kèm | IMAGE |
| 6006 | Image already mapped to answer | Ảnh đã được liên kết với câu trả lời này | IMAGE |
| 6007 | MinIO object storage error | Lỗi MinIO server storage | IMAGE |
| 7001 | Lesion episode not found | Không tìm thấy đợt tổn thương | LESION |
| 7002 | Lesion location not found | Không tìm thấy vị trí tổn thương | LESION |
| 7003 | Lesion photo record not found | Không tìm thấy ảnh chụp tổn thương | LESION |
| 7004 | Lesion name cannot be empty | Tên đợt tổn thương không được để rỗng | LESION |
| 7005 | Body part cannot be empty | Vị trí body_part không được để rỗng | LESION |
| 7006 | Invalid milestone value | Milestone chỉ nhận: start, peak, normal | LESION |
| 7007 | Symptom score out of range | Điểm triệu chứng ngứa/đau/rát phải từ 0 đến 10 | LESION |
| 8001 | Medicines list cannot be empty | Đơn thuốc phải có ít nhất 1 thuốc | PRESCRIPTION |
| 8002 | Medicine name is required | Tên thuốc không được để rỗng | PRESCRIPTION |
| 8003 | Prescription already exists for this record | Bệnh án này đã kê đơn rồi | PRESCRIPTION |
| 8101 | Lab tests list cannot be empty | Phải chọn ít nhất 1 xét nghiệm | LAB |
| 8102 | Test name is required | Tên xét nghiệm không được để rỗng | LAB |
| 8103 | Lab request not found | Không tìm thấy yêu cầu xét nghiệm | LAB |
| 9001 | AI model inference failed | Lỗi chạy mô hình YOLO AI | AI |
| 9002 | AI service unavailable | Server AI không phản hồi (502 Bad Gateway) | AI |
| 9003 | Invalid itch severity for AI calculation | Điểm ngứa cho AI phải từ 0 đến 3 | AI |
| 9101 | FCM token is required | Thiếu FCM Token đăng ký | NOTI |
| 9102 | Notification not found | Không tìm thấy thông báo | NOTI |
| 9901 | Internal server error | Lỗi hệ thống nội bộ | SYSTEM |
| 9902 | Database connection error | Lỗi kết nối cơ sở dữ liệu | SYSTEM |
| 9903 | Third-party service error | Lỗi dịch vụ bên thứ 3 (MinIO, FCM, Email) | SYSTEM |

## Bảng mã gộp theo chuẩn cũ (bảng bên phải của tab)

Ánh xạ các mã chi tiết vào bộ mã cũ (9992–9999, 1001–1010) theo vị trí bit.

| Vị trí Bit | Code | Chuỗi nhị phân (19 bit) | Giá trị Thập phân | Message | Note | Mã code đã gộp |
|---|---|---|---|---|---|---|
| - | 1000 | 0000000000000000000 | 0 | OK | Xử lý thành công | 1000 |
| Bit 0 | 9992 | 0000000000000000001 | 1 | Post is not existed | Đối tượng không tồn tại | 3007, 4001, 4008, 4101, 4103, 4104, 6005, 7001, 7002, 7003, 8103, 9102 |
| Bit 1 | 9993 | 0000000000000000010 | 2 | Code verify is incorrect | Mã xác thực không đúng | 3004, 3005 |
| Bit 2 | 9994 | 0000000000000000100 | 4 | No Data or end of list data | Không có dữ liệu / Hết dữ liệu | 4002, 5001 |
| Bit 3 | 9995 | 0000000000000001000 | 8 | User is not validated | Người dùng chưa xác thực | 3008, 3009 |
| Bit 4 | 9996 | 0000000000000010000 | 16 | User existed. | Người dùng/Dữ liệu đã tồn tại | 3006, 4102 |
| Bit 5 | 9997 | 0000000000000100000 | 32 | Method is invalid | Phương thức không đúng | - |
| Bit 6 | 9998 | 0000000000001000000 | 64 | Token is invalid. | Sai token | 3001, 3002, 3003 |
| Bit 7 | 9999 | 0000000000010000000 | 128 | Exception error. | Lỗi exception | 9001, 9002, 9901, 9903 |
| Bit 8 | 1001 | 0000000000100000000 | 256 | Can not connect to DB. | Lỗi mất kết nối DB/thực thi SQL | 9902 |
| Bit 9 | 1002 | 0000000001000000000 | 512 | Parameter is not enough | Số lượng Parameter không đầy đủ | 2001, 4006, 4007, 5005, 6001, 7004, 7005, 8001, 8002, 8101, 8102, 9101 |
| Bit 10 | 1003 | 0000000010000000000 | 1024 | Parameter type is invalid. | Kiểu tham số không đúng đắn | 2002, 2007, 6002 |
| Bit 11 | 1004 | 0000000100000000000 | 2048 | Parameter value is invalid. | Giá trị của tham số không hợp lệ | 2003, 2004, 2005, 2006, 4004, 4009, 5003, 5004, 7006, 7007, 9003 |
| Bit 12 | 1005 | 0000001000000000000 | 4096 | Unknown error. | Unknown error | - |
| Bit 13 | 1006 | 0000010000000000000 | 8192 | File size is too big. | Cỡ file vượt mức cho phép | 6003 |
| Bit 14 | 1007 | 0001000000000000000 | 16384 | Upload File Failed!. | Upload thất bại | 6007 |
| Bit 15 | 1008 | 0010000000000000000 | 32768 | Maximum number of images. | Số lượng images vượt quá quy định | 6004 |
| Bit 16 | 1009 | 0100000000000000000 | 65536 | Not access. | Không có quyền truy cập tài nguyên | 3101, 3102, 3103, 3104, 3105, 3106 |
| Bit 17 | 1010 | 1000000000000000000 | 131072 | Action has been done previously by this user. | Hành động đã được thực hiện trước đây | 4003, 4005, 4105, 5002, 6006, 8003 |
