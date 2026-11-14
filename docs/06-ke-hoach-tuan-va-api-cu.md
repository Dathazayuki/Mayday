# Kế hoạch API theo tuần và danh sách API đã có (ĐATN)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: [Sheet API, tab "1. Weekly API"](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=2125155598); [tab "2. API đã có_ĐATN"](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=0).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.
> Repo code cũ `github.com/doantrunghieu08/datn_cuc_mai` được tab 2 trỏ tới hiện không truy cập công khai được (404).

## Phân phối API theo tuần

Phân phối API theo tuần

| Tuần | Nhóm công việc | API thực hiện | Số API |
|---|---|---|---|
| 1 | Xác thực & tài khoản | signup, login, logout, forgot_password, reset_password, create_staff | 6 |
| 2 | Người dùng + phân quyền | get_user_info, set_user_info, set_user, get_list_users, get_user_detail, edit_user, delete_user, set_role, get_list_roles | 9 |
| 3 | Permission & cơ cấu tổ chức | set_permission, get_list_permissions, edit_permission, delete_permission, set_role_permissions, get_role_permissions, delete_role_permission, toàn bộ Branch | 12 |
| 4 | Ban, phòng + biểu mẫu cơ bản | Toàn bộ Department, Room + set_template, get_list_templates, get_template_detail, edit_template, delete_template | 15 |
| 5 | Chi tiết biểu mẫu | set_template_section, edit_template_section, delete_template_section, set_template_question, edit_template_question, delete_template_question | 6 |
| 6 | Bệnh án – tạo & đọc | get_medicalrecords_classifyquestions, set_medicalrecords_classify, set_medicalrecords_selfcreate, get_medicalrecords_all, get_medicalrecords_id, get_medicalrecords_summary, set_accept_medicalrecords | 7 |
| 7 | Bệnh án – xử lý & quản lý | get_medicalrecords_answers, set_medicalrecords_answers, edit_medicalrecords, edit_status_medicalrecords, get_history_medicalrecords, delete_medicalrecords | 6 |
| 8 | Đợt tổn thương & vị trí | Toàn bộ LesionEpisode + LesionLocation | 9 |
| 9 | Ảnh + UAS7 | Toàn bộ LesionPhoto, toàn bộ ImageAttachment, toàn bộ AnswerImage, toàn bộ UAS7 | 13 |
| 10 | Đơn thuốc, Lab, Thông báo | set_prescription, set_lab_request, get_lab_results, toàn bộ Notification + set_devtoken | 8 |
|  |  |  | 91 |

## API đã có trong đồ án cũ (datn_cuc_mai)


| STT | Tên API (gốc) | Link mô tả | Tên API (datn_cuc_mai) | Link code | Phân nhóm chức năng | HTTP Method (Gợi ý) | Mô tả chi tiết |
|---|---|---|---|---|---|---|---|
| 1 | signup | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#11-%C4%91%C4%83ng-k%C3%BD-t%C3%A0i-kho%E1%BA%A3n | signup | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/AuthController.js#L22 | Xác thực & Tài khoản | POST | Đăng ký tài khoản mới |
| 2 | login | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#12-%C4%91%C4%83ng-nh%E1%BA%ADp | login | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/AuthController.js#L90 | Xác thực & Tài khoản | POST | Đăng nhập hệ thống, trả về Token xác thực |
| 3 | logout |  | NA | ? | Xác thực & Tài khoản | POST | Đăng xuất, hủy phiên làm việc/Token |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#14-qu%C3%AAn-m%E1%BA%ADt-kh%E1%BA%A9u | forgot_password | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/AuthController.js#L192 | Xác thực & Tài khoản | POST | Quên mật khẩu |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#15-%C4%91%E1%BA%B7t-l%E1%BA%A1i-m%E1%BA%ADt-kh%E1%BA%A9u | reset_password | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/AuthController.js#L247 | Xác thực & Tài khoản | POST | Người dùng nhập mã OTP từ email để đặt mật khẩu mới. |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#16-admin-t%E1%BA%A1o-t%C3%A0i-kho%E1%BA%A3n-nh%C3%A2n-vi%C3%AAn-y-t%E1%BA%BF | create_staff | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/AuthController.js#L288 | Xác thực & Tài khoản | POST | Tạo tài khoản nhân viên y tế |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#21-ki%E1%BB%83m-tra-b%E1%BB%87nh-nh%C3%A2n-c%C3%B3-%C4%91%C6%B0%E1%BB%A3c-ch%E1%BA%A5m-uas7-kh%C3%B4ng | get_uas7scores_eligibility | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/uas7ScoreController.js#L35 | UAS7 | GET | Kiểm tra xem bệnh nhân có được chấm UAS7 không |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#22-t%E1%BA%A1o-%C4%91i%E1%BB%83m-uas7-h%C3%A0ng-ng%C3%A0y | create_uas7scores | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/uas7ScoreController.js#L167 | UAS7 | POST/GET | Tạo điểm UAS7 hằng ngày |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#24-l%E1%BA%A5y-%C4%91i%E1%BB%83m-uas7-trong-7-ng%C3%A0y-g%E1%BA%A7n-nh%E1%BA%A5t | get_uas7scores_week | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/uas7ScoreController.js#L108 | UAS7 | GET | Lấy lịch sử điểm UAS7 của bệnh nhân hằng tuần |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#23-l%E1%BA%A5y-to%C3%A0n-b%E1%BB%99-l%E1%BB%8Bch-s%E1%BB%AD-uas7-c%E1%BB%A7a-b%E1%BB%87nh-nh%C3%A2n | get_uas7scores_patient | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/uas7ScoreController.js#L73 | UAS7 | GET | Lấy toàn bộ lịch sử điểm UAS7 của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#31-upload-1-%E1%BA%A3nh | set_image_attachments | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/ImageAttachmentController.js#L8 | Ảnh | POST | Upload ảnh vùng da bệnh của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#32-upload-nhi%E1%BB%81u-%E1%BA%A3nh | set_multiple_image_attachments | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/ImageAttachmentController.js#L78 | Ảnh | POST | Upload nhiều ảnh vùng da bệnh của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#33-l%E1%BA%A5y-danh-s%C3%A1ch-%E1%BA%A3nh-c%E1%BB%A7a-b%E1%BB%87nh-nh%C3%A2n | get_image_attachments_user | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/ImageAttachmentController.js#L154 | Ảnh | GET | Lấy danh sách ảnh của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#34-xem-%E1%BA%A3nh | get_image_attachments_view | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/ImageAttachmentController.js#L179 | Ảnh | GET | Xem ảnh |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#35-x%C3%B3a-%E1%BA%A3nh | delete_image_attachments | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/ImageAttachmentController.js#L206 | Ảnh | POST / DELETE | xóa ảnh |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#4-medical-records--b%E1%BB%87nh-%C3%A1n | get_medicalrecords_classifyquestions | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L1038 | Bệnh án | GET | Lấy câu hỏi phân loại bệnh án |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#42-ph%C3%A2n-lo%E1%BA%A1i-b%E1%BB%87nh-%C3%A1n | set_medicalrecords_classify | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L1078 | Bệnh án | POST | Phân loại bệnh án |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#43-b%E1%BB%87nh-nh%C3%A2n-t%E1%BB%B1-t%E1%BA%A1o-b%E1%BB%87nh-%C3%A1n | set_medicalrecords_selfcreate | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L29 | Bệnh án | POST | Bác sĩ tạo bệnh án cho bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#44-l%E1%BA%A5y-danh-s%C3%A1ch-b%E1%BB%87nh-%C3%A1n | get_medicalrecords_all | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L90 | Bệnh án | GET | Lấy toàn bộ bệnh án của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#45-xem-chi-ti%E1%BA%BFt-b%E1%BB%87nh-%C3%A1n | get_medicalrecords_id | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L156 | Bệnh án | GET | Bác sĩ xem chi tiết bệnh án của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#46-xem-t%C3%B3m-t%E1%BA%AFt-b%E1%BB%87nh-%C3%A1n | get_medicalrecords_summary | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L201 | Bệnh án | GET | Bác sĩ xem tóm tắt bệnh án của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#47-b%C3%A1c-s%C4%A9-ti%E1%BA%BFp-nh%E1%BA%ADn-b%E1%BB%87nh-%C3%A1n | set_accept_medicalrecords | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L360 | Bệnh án | POST | Bác sĩ tiếp nhận bệnh án của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#48-xem-c%C3%A2u-tr%E1%BA%A3-l%E1%BB%9Di-c%E1%BB%A7a-b%E1%BB%87nh-%C3%A1n | get_medicalrecords_answers | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L791 | Bệnh án | GET | Bác sĩ xem câu trả lời của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#410-c%E1%BA%ADp-nh%E1%BA%ADt-t%E1%BB%ABng-ph%E1%BA%A7n-c%C3%A2u-tr%E1%BA%A3-l%E1%BB%9Di | set_medicalrecords_answers | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L724 | Bệnh án | POST | Bác sĩ chèn câu trả lời của bệnh nhân |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#411-c%E1%BA%ADp-nh%E1%BA%ADt-b%E1%BB%87nh-%C3%A1n | edit_medicalrecords | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L470 | Bệnh án | PUT | Cập nhật bệnh án |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#412-c%E1%BA%ADp-nh%E1%BA%ADt-tr%E1%BA%A1ng-th%C3%A1i-b%E1%BB%87nh-%C3%A1n | edit_status_medicalrecords | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L628 | Bệnh án | PATCH | Cập nhật trạng thái bệnh án |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#413-xem-l%E1%BB%8Bch-s%E1%BB%AD-kh%C3%A1m-c%E1%BB%A7a-b%E1%BB%87nh-nh%C3%A2n | get_history_medicalrecords | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L421 | Bệnh án | GET | Lấy lịch sử bệnh án |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#414-x%C3%B3a-b%E1%BB%87nh-%C3%A1n | delete_medicalrecords | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/MedicalRecordController.js#L593 | Bệnh án | DELETE | Xóa bệnh án |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#51-%C4%91%C4%83ng-k%C3%BD-fcm-token | set_devtoken | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/NotificationController.js#L4 | Token | POST | Đăng ký FCM Token |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#52-l%E1%BA%A5y-danh-s%C3%A1ch-th%C3%B4ng-b%C3%A1o | get_notification | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/NotificationController.js#L34 | Thông báo | GET | Lấy danh sách thông báo |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#53-%C4%91%C3%A1nh-d%E1%BA%A5u-%C4%91%C3%A3-%C4%91%E1%BB%8Dc-1-th%C3%B4ng-b%C3%A1o | set_read_notification | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/NotificationController.js#L61 | Thông báo | PUT | Đánh dấu đã đọc 1 thông báo |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#54-%C4%91%C3%A1nh-d%E1%BA%A5u-t%E1%BA%A5t-c%E1%BA%A3-%C4%91%C3%A3-%C4%91%E1%BB%8Dc | set_read_all_notifications | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/NotificationController.js#L92 | Thông báo | PUT | Đánh dấu tất cả đã đọc |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#55-x%C3%B3a-th%C3%B4ng-b%C3%A1o | delete_notification | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/NotificationController.js#L92 | Thông báo | DELETE | Xóa thông báo |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#61-li%C3%AAn-k%E1%BA%BFt-1-%E1%BA%A3nh-v%C3%A0o-c%C3%A2u-tr%E1%BA%A3-l%E1%BB%9Di | set_answer_image | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/AnswerImageController.js#L23 | Ảnh liên kết câu trả lời | POST | Liên kết 1 ảnh vào câu trả lời |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#62-li%C3%AAn-k%E1%BA%BFt-nhi%E1%BB%81u-%E1%BA%A3nh-c%C3%B9ng-l%C3%BAc | set_multiple_answer_images | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/AnswerImageController.js#L102 | Ảnh liên kết câu trả lời | POST | Liên kết nhiều ảnh cùng lúc |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#63-l%E1%BA%A5y-danh-s%C3%A1ch-%E1%BA%A3nh-c%E1%BB%A7a-c%C3%A2u-tr%E1%BA%A3-l%E1%BB%9Di | get_answer_images | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/AnswerImageController.js#L170 | Ảnh liên kết câu trả lời | GET | Lấy danh sách ảnh của câu trả lời |
|  | NA | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/API_GUIDE.md#64-x%C3%B3a-li%C3%AAn-k%E1%BA%BFt-%E1%BA%A3nh | delete_answer_image | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/AnswerImageController.js#L226 | Ảnh liên kết câu trả lời | DELETE | Xóa liên kết ảnh |
|  |  |  | get_my_lesion_episodes | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionEpisodeController.js#L171 | Đợt tổn thương |  |  |
|  |  |  | create_lesion_episode | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionEpisodeController.js#L76 | Đợt tổn thương |  |  |
|  |  |  | edit_lesion_episode | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionEpisodeController.js#L260 | Đợt tổn thương |  |  |
|  |  |  | delete_lesion_episode | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionEpisodeController.js#L323 | Đợt tổn thương |  |  |
|  |  |  | set_lesion_location | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionLocationController.js#L35 | Vị trí tổn thương |  |  |
|  |  |  | create_lesion_location | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionLocationController.js#L75 | Vị trí tổn thương (không có trong mô tả) |  |  |
|  |  |  | get_lesion_locations_by_episode | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionLocationController.js#L137 | Vị trí tổn thương |  |  |
|  |  |  | edit_lesion_location | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionLocationController.js#L173 | Vị trí tổn thương |  |  |
|  |  |  | delete_lesion_location | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionLocationController.js#L230 | Vị trí tổn thương |  |  |
|  |  |  | set_lesion_photos | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionPhotoController.js#L88 | Ảnh tổn thương |  |  |
|  |  |  | get_lesion_photos_by_location | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionPhotoController.js#L216 | Ảnh tổn thương |  |  |
|  |  |  | edit_lesion_photo_milestone | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionPhotoController.js#L246 | Ảnh tổn thương |  |  |
|  |  |  | delete_lesion_photo | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LesionPhotoController.js#L281 | Ảnh tổn thương |  |  |
|  |  |  | get_user_info |  | Người dùng |  |  |
|  |  |  | set_user_info |  | Người dùng |  |  |
|  |  |  | set_user | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/UserController.js#L14 | Người dùng |  |  |
|  |  |  | get_list_users | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/UserController.js#L67 | Người dùng |  |  |
|  |  |  | get_user_detail | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/UserController.js#L100 | Người dùng |  |  |
|  |  |  | edit_user | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/UserController.js#L129 | Người dùng |  |  |
|  |  |  | delete_user | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/UserController.js#L178 | Người dùng |  |  |
|  |  |  | set_prescription | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/PrescriptionController.js#L14 | Đơn thuốc |  |  |
|  |  |  | set_lab_request | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LabController.js#L18 | Lab |  |  |
|  |  |  | get_lab_results | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/LabController.js#L82 | Lab |  |  |
|  |  |  | set_template | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L18 | Biểu mẫu |  |  |
|  |  |  | get_list_templates | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L138 | Biểu mẫu |  |  |
|  |  |  | get_template_detail | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L178 | Biểu mẫu |  |  |
|  |  |  | edit_template | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L225 | Biểu mẫu |  |  |
|  |  |  | delete_template | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L263 | Biểu mẫu |  |  |
|  |  |  | set_template_section | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L324 | Biểu mẫu |  |  |
|  |  |  | edit_template_section | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L355 | Biểu mẫu |  |  |
|  |  |  | delete_template_section | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L388 | Biểu mẫu |  |  |
|  |  |  | set_template_question | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L417 | Biểu mẫu |  |  |
|  |  |  | edit_template_question | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L509 | Biểu mẫu |  |  |
|  |  |  | delete_template_question | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/TemplateController.js#L583 | Biểu mẫu |  |  |
|  |  |  | set_branch | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/BranchController.js#L5 | Cơ sở |  |  |
|  |  |  | get_list_branches | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/BranchController.js#L50 | Cơ sở |  |  |
|  |  |  | get_branch_detail | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/BranchController.js#L75 | Cơ sở |  |  |
|  |  |  | edit_branch | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/BranchController.js#L106 | Cơ sở |  |  |
|  |  |  | delete_branch | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/BranchController.js#L146 | Cơ sở |  |  |
|  |  |  | set_department | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/DepartmentController.js#L5 | Ban |  |  |
|  |  |  | get_list_departments | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/DepartmentController.js#L49 | Ban |  |  |
|  |  |  | get_department_detail | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/DepartmentController.js#L85 | Ban |  |  |
|  |  |  | edit_department | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/DepartmentController.js#L127 | Ban |  |  |
|  |  |  | delete_department | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/DepartmentController.js#L168 | Ban |  |  |
|  |  |  | set_room | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RoomController.js#L5 | Phòng |  |  |
|  |  |  | get_list_rooms | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RoomController.js#L49 | Phòng |  |  |
|  |  |  | get_room_detail | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RoomController.js#L85 | Phòng |  |  |
|  |  |  | edit_room | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RoomController.js#L127 | Phòng |  |  |
|  |  |  | delete_room | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RoomController.js#L168 | Phòng |  |  |
|  |  |  | set_role | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RoleController.js#L5 | Vai trò |  |  |
|  |  |  | get_list_roles | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RoleController.js#L41 | Vai trò |  |  |
|  |  |  | set_permission | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/PermissionController.js#L5 | Vai trò |  |  |
|  |  |  | get_list_permissions | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/PermissionController.js#L41 | Vai trò |  |  |
|  |  |  | edit_permission | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/PermissionController.js#L59 | Vai trò |  |  |
|  |  |  | delete_permission | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/PermissionController.js#L99 | Vai trò |  |  |
|  |  |  | set_role_permissions | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RolePermissionController.js#L5 | Vai trò |  |  |
|  |  |  | get_role_permissions | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RolePermissionController.js#L54 | Vai trò |  |  |
|  |  |  | delete_role_permission | https://github.com/doantrunghieu08/datn_cuc_mai/blob/main/controllers/RolePermissionController.js#L92 | Vai trò |  |  |
