# Phần 4: Quản lý Bệnh nhân và Hồ sơ Bệnh án (Medical Records)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE5_DrMayDay.pptx`; [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. Cột NN: `O` = bắt buộc, `X` = không bắt buộc.

### search_patients  (docpat01) (Bản cập nhật 11/10/2026 thêm phân trang và keyword)

- Tab Sheet: [`GET /api/doctor/patients/search`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1200680805)
- Ảnh slide 5: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: API dành cho Bác sĩ để tìm kiếm hồ sơ bệnh nhân theo tên hoặc số điện thoại trước khi tạo bệnh án.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực của Bác sĩ |
| 2 | `keyword` | string | X | (Query) Từ khóa tìm kiếm chung. Có thể là một phần số điện thoại hoặc một phần tên bệnh nhân. |
| 3 | `gender` | string | X | (Query) Lọc theo giới tính (VD: "male", "female", "other"). |
| 4 | `min_year` | string | X | (Query) Năm sinh bắt đầu. Nếu nhập trùng max_year (VD: min=1999, max=1999) HOẶC 1 trong 2 giá trị bằng 0 (hoặc không truyền lên), Backend tự động hiểu là tìm chính xác bệnh nhân sinh năm đó. |
| 5 | `max_year` | string | X | (Query) Năm sinh kết thúc. Áp dụng chung logic bắt cặp với min_year như mô tả ở trên. |
| 6 | `page` | string | X | (Query) Số trang hiện tại (VD: "1") |
| 7 | `limit` | string | X | (Query) Số lượng bản ghi trên một trang (VD: "20") |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng danh sách các bệnh nhân phù hợp |
|  | ↳ `user_id` | int | O | ID của bệnh nhân |
|  | ↳ `full_name` | string | O | Họ và tên |
|  | ↳ `phone` | string | O | Số điện thoại |
|  | ↳ `gender` | string | X | Giới tính |
|  | ↳ `year_of_birth` | int | X | Năm sinh |
|  | ↳ `total_records` | string | O | Tổng số bản ghi tìm được (phục vụ Frontend làm nút bấm phân trang) |

#### Mô tả docpat01 (Bản cập nhật 11/10)

- API dành cho Bác sĩ để tìm kiếm hồ sơ bệnh nhân theo tên hoặc số điện thoại trước khi tạo bệnh án.
- Tìm kiếm linh hoạt: Sử dụng keyword để tìm theo một phần số điện thoại hoặc một phần tên bệnh nhân.
- Bộ lọc nâng cao: Hỗ trợ lọc theo giới tính (gender) và khoảng năm sinh (min_year đến max_year). Nếu nhập min_year trùng max_year hoặc chỉ truyền 1 trong 2 giá trị, Backend sẽ tự động hiểu là tìm chính xác bệnh nhân sinh vào năm đó.
- Tính năng Phân trang: Áp dụng page (số trang hiện tại) và limit (số lượng bản ghi/trang) để tối ưu danh sách hiển thị, đầu ra cung cấp thêm total_records để Frontend xử lý nút bấm phân trang.
- _(slide 6)_

#### Các test case cho docpat01 (Bản cập nhật 11/10)

- Bác sĩ tìm kiếm bằng keyword hợp lệ kết hợp tham số page và limit.
- Kết quả mong đợi: Mã 1000 | Thành công. Trả về mảng danh sách bệnh nhân (gồm user_id, full_name, phone, gender, year_of_birth) và tổng số bản ghi (total_records).
- Bác sĩ tìm kiếm chính xác năm sinh bằng cách chỉ truyền min_year = 1990 (bỏ trống max_year).
- Kết quả mong đợi: Mã 1000 | Thành công. Trả về danh sách các bệnh nhân sinh đúng vào năm 1990.
- Truyền request nhưng thiếu Bearer Token xác thực trong Header.
- Kết quả mong đợi: Mã lỗi từ chối truy cập do thiếu quyền xác thực của Bác sĩ.
- _(slide 7)_

### create_patient  (docpat02) (input) (Bản cập nhật 11/10/2026)

- Tab Sheet: [`POST /api/doctor/patients/create`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=298841007)
- Đường dẫn ghi trong slide: `POST /api/v1/doctor/patients/`
- Ảnh slide 8: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bác sĩ/Lễ tân tạo mới một hồ sơ bệnh nhân vào hệ thống (Có thể nhập đầy đủ thông tin y tế cơ bản của bệnh nhân).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực của Bác sĩ |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `full_name` | string | O | Họ và tên bệnh nhân |
| 4 | `phone` | string | O | Số điện thoại (dùng làm tài khoản đăng nhập cho bệnh nhân) |
| 5 | `password` | string | O | Mật khẩu khởi tạo |
| 6 | `gender` | string | X | Giới tính: male, female, other |
| 7 | `year_of_birth` | int | X | Năm sinh |
| 8 | `career` | string | X | Nghề nghiệp |
| 9 | `ethnic` | string | X | Dân tộc |
| 10 | `hamlet_address` | string | X | Địa chỉ thôn/xóm |
| 11 | `commune_address` | string | X | Địa chỉ xã/phường |
| 12 | `city_address` | string | X | Địa chỉ tỉnh/thành phố |
| 13 | `work_place` | string | X | Nơi làm việc |
| 14 | `health_insurance_number` | string | X | Số thẻ BHYT |
| 15 | `health_insurance_validate` | string | X | Ngày hết hạn thẻ BHYT |
| 16 | `next_of_kin_name` | string | X | Tên người nhà liên hệ |
| 17 | `next_of_kin_phone` | string | X | Số điện thoại người nhà |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo bệnh nhân thành công) |
| 3 | `data` | object | O | Toàn bộ thông tin bệnh nhân vừa được tạo (Tương tự format Profile) |
|  | ↳ `user_id` | int | O | ID của bệnh nhân trong CSDL |
|  | ↳ `full_name` | string | O | Họ và tên |
|  | ↳ `phone` | string | O | Số điện thoại |
|  | ↳ `role_id` | int | O | ID Phân quyền (Mặc định Role Bệnh nhân) |
|  | ↳ `gender` | string | X | Giới tính |
|  | ↳ `year_of_birth` | int | X | Năm sinh |
|  | ↳ `career` | string | X | Nghề nghiệp |
|  | ↳ `ethnic` | string | X | Dân tộc |
|  | ↳ `hamlet_address` | string | X | Địa chỉ thôn/xóm |
|  | ↳ `commune_address` | string | X | Địa chỉ xã/phường |
|  | ↳ `city_address` | string | X | Địa chỉ tỉnh/thành phố |
|  | ↳ `work_place` | string | X | Nơi làm việc |
|  | ↳ `health_insurance_number` | string | X | Số thẻ BHYT |
|  | ↳ `health_insurance_validate` | string | X | Ngày hết hạn thẻ BHYT |
|  | ↳ `next_of_kin_name` | string | X | Tên người nhà liên hệ |
|  | ↳ `next_of_kin_phone` | string | X | Số điện thoại người nhà |
|  | ↳ `created_at` | string | O | Thời gian tạo tài khoản |

### create_patient  (docpat02) (output) (Bản cập nhật 11/10/2026)

- Tab Sheet: [`POST /api/doctor/patients/create`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=298841007)
- Đường dẫn ghi trong slide: `POST /api/v1/doctor/patients/`
- Ảnh slide 9: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả docpat02

- API cho phép Bác sĩ/Lễ tân chủ động tạo tài khoản cho bệnh nhân mới đến khám trực tiếp tại viện.
- Request dạng POST (/api/v1/doctor/patients/).
- Backend chú ý: Lưu dữ liệu vào bảng users (với role_id là patient) và bảng con patients. Trạng thái is_active mặc định = 1.
- _(slide 10)_

#### Các test case cho docpat02

- Bác sĩ tạo bệnh nhân với thông tin đầy đủ.
- Kết quả mong đợi: Mã 1001 | Created successfully.
- Số điện thoại bệnh nhân đã có sẵn trong hệ thống.
- Kết quả mong đợi: Mã lỗi 3006 | User phone already exists.
- _(slide 11)_

### get_medicalrecords_classifyquestions (medrec01)

- Tab Sheet: [`GET /api/medical_records/classify-questions`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=839267768)
- Đường dẫn ghi trong slide: `GET /api/v1/medical_records/classify-questions`
- Ảnh slide 13: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Lấy danh sách các câu hỏi sàng lọc (từ bảng questions và question_options) để quyết định Template phù hợp.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng các câu hỏi phân loại |
|  | ↳ `question_id` | string | O | Khóa chính câu hỏi (varchar 50) |
|  | ↳ `question_text` | string | O | Nội dung câu hỏi |
|  | ↳ `type_question` | string | O | Kiểu câu hỏi (radio, checkbox...) |
|  | ↳ `options` | array | O | Mảng các lựa chọn của câu hỏi |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `id` | int | O | Khóa chính của lựa chọn (question_options.id) |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_text` | string | O | Nội dung hiển thị của lựa chọn |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_value` | string | O | Giá trị lưu trữ tương ứng |

#### Mô tả medrec01

- API lấy danh sách các câu hỏi sơ bộ (có từng khám chưa, có mắc bệnh mãn tính không...) để hệ thống quyết định dùng Mẫu phiếu khám (Template) nào.
- Request dạng GET (/api/v1/medical_records/classify-questions).
- Kết quả đầu ra: Trả về mảng các câu hỏi phân loại.
- _(slide 14)_

#### Các test case cho medrec01

- Gọi API thành công.
- Kết quả mong đợi: Mã 1000 | OK. Trả về danh sách câu hỏi phân loại.
- _(slide 15)_

### set_medicalrecords_classify  (medrec02)

- Tab Sheet: [`POST /api/medical_records/classify`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1499318100)
- Đường dẫn ghi trong slide: `POST /api/v1/medical_records/classify`
- Ảnh slide 16: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Gửi kết quả sàng lọc lên hệ thống để nhận về ID Mẫu phiếu khám (Template) tương ứng.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `answers` | array | O | Mảng chứa các câu trả lời phân loại |
|  | ↳ `question_id` | string | O | Khóa chính câu hỏi (varchar 50) |
|  | ↳ `option_value` | string | O | Giá trị lựa chọn người dùng đã chọn |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Kết quả phân loại |
|  | ↳ `template_id` | string | O | Mã mẫu phiếu khám (varchar 225) |
|  | ↳ `template_name` | string | O | Tên của mẫu phiếu |

#### Mô tả medrec02

- API tiếp nhận câu trả lời phân loại và mapping với logic nội bộ để trả về template_id chính xác nhất cho bệnh án chuẩn bị khởi tạo.
- Request dạng POST (/api/v1/medical_records/classify).
- Kết quả đầu ra: Trả về template_id (Ví dụ: TMPL_URT_CHRONIC) và cấu trúc của template đó.
- _(slide 17)_

#### Các test case cho medrec02

- Trả lời đầy đủ các câu hỏi phân loại.
- Kết quả mong đợi: Mã 1000 | OK kèm thông tin template_id.
- Truyền thiếu lựa chọn phân loại.
- Kết quả mong đợi: Mã lỗi 4006 | Classification options incomplete.
- _(slide 18)_

### set_medicalrecords_create (medrec03) (input)

- Tab Sheet: [`POST /api/v1/medical_records`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1254044733)
- Đường dẫn ghi trong slide: `POST /api/v1/medical_records/`
- Ảnh slide 19: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Khởi tạo một phiên khám mới (Insert vào bảng medical_records). Nếu có dữ liệu trả lời sẵn, insert thêm vào bảng answers.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `patient_id` | int | X | ID bệnh nhân (Bắt buộc nếu là Bác sĩ tạo, Bỏ qua nếu bệnh nhân tự tạo) |
| 4 | `template_id` | string | O | Mã mẫu phiếu khám (varchar 225) |
| 5 | `answers` | array | X | Mảng các câu trả lời ban đầu (Nạp vào bảng answers) |
|  | ↳ `question_id` | string | O | Mã câu hỏi (varchar 50) |
|  | ↳ `question_option_id` | int | X | ID lựa chọn (Nếu có) |
|  | ↳ `answer_text` | string | X | Nội dung trả lời dạng văn bản tự do |
|  | ↳ `answer_value` | object | X | Dữ liệu dạng JSON (Giá trị trả lời phức tạp) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo hồ sơ bệnh án thành công) |
| 3 | `data` | object | O | Thông tin chi tiết bệnh án vừa tạo (Khớp DB medical_records) |
|  | ↳ `medical_record_id` | int | O | ID của hồ sơ bệnh án (PK) |
|  | ↳ `patient_id` | int | O | ID của bệnh nhân |
|  | ↳ `assigned_doctor_id` | int | X | Bác sĩ được phân công (Có thể null lúc tạo) |
|  | ↳ `created_by` | int | O | ID người tạo hồ sơ (Nhân viên/Bác sĩ/Bệnh nhân) |
|  | ↳ `template_id` | string | O | Mã mẫu phiếu |
|  | ↳ `status` | string | O | Trạng thái (enum: draft, pending, in_progress, completed, cancelled) |
|  | ↳ `instructions` | string | X | Chỉ dẫn của bác sĩ (Null lúc mới tạo) |
|  | ↳ `created_at` | string | O | Thời gian tạo |

### set_medicalrecords_create (medrec03) (output)

- Tab Sheet: [`POST /api/v1/medical_records`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1254044733)
- Đường dẫn ghi trong slide: `POST /api/v1/medical_records/`
- Ảnh slide 20: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả medrec03

- API Khởi tạo một hồ sơ bệnh án mới.
- Request dạng POST (/api/v1/medical_records/).
- Backend chú ý: Khởi tạo record trong bảng medical_records. Set patient_id = ID người dùng, template_id = template được chọn. Trạng thái status khởi tạo là pending (đang chờ bác sĩ nhận). Nếu người tạo là bác sĩ thì created_by = ID bác sĩ.
- _(slide 21)_

#### Các test case cho medrec03

- Tạo bệnh án với template hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully. Trả về medical_record_id.
- Truyền một template_id không tồn tại.
- Kết quả mong đợi: Mã lỗi 4101 | Template not found.
- _(slide 22)_

### get_medicalrecords_all (medrec04)

- Tab Sheet: [`GET /api/medical_records/all`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1050343001)
- Đường dẫn ghi trong slide: `GET /api/v1/medical_records/all`
- Ảnh slide 24: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Lấy danh sách bệnh án (Dùng cho Admin/Bác sĩ). Trả về cấu trúc bảng medical_records.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `status` | string | X | (Query) Lọc theo trạng thái (pending, in_progress, completed...) |
| 3 | `patient_id` | int | X | (Query) Lọc theo bệnh nhân |
| 4 | `page` | int | X | (Query) Phân trang |
| 5 | `limit` | int | X | (Query) Giới hạn số lượng bản ghi |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng danh sách các hồ sơ bệnh án |
|  | ↳ `medical_record_id` | int | O | ID bệnh án (PK) |
|  | ↳ `patient_id` | int | O | ID bệnh nhân |
|  | ↳ `assigned_doctor_id` | int | X | ID Bác sĩ phụ trách |
|  | ↳ `template_id` | string | O | Mã mẫu phiếu |
|  | ↳ `status` | string | O | Trạng thái hiện tại |
|  | ↳ `created_at` | string | O | Thời gian tạo |

#### Mô tả medrec04

- API dành cho Bác sĩ/Lễ tân lấy danh sách toàn bộ hồ sơ bệnh án trong viện để điều phối.
- Request dạng GET (/api/v1/medical_records/all).
- Backend chú ý: Cần hỗ trợ query param status (pending, in_progress, completed) để UI lọc danh sách.
- _(slide 25)_

#### Các test case cho medrec04

- Gọi API với quyền Bác sĩ và filter status = pending.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng các bệnh án đang chờ tiếp nhận.
- _(slide 26)_

### get_medicalrecords_id (medrec05)

- Tab Sheet: [`GET /api/medical_records/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=544052006)
- Đường dẫn ghi trong slide: `GET /api/v1/medical_records/:id`
- Ảnh slide 27: ⚠ Ảnh trên slide trùng ảnh của get_medicalrecords_all (medrec04). Đặc tả dưới đây lấy đúng tab GET chi tiết mà slide trỏ tới.

Mô tả trong Sheet: Lấy toàn bộ thông tin chung của một hồ sơ bệnh án cụ thể theo bảng medical_records.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | int | O | (Path) ID của bệnh án (medical_record_id) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chi tiết hồ sơ bệnh án |
|  | ↳ `medical_record_id` | int | O | ID bệnh án |
|  | ↳ `patient_id` | int | O | ID bệnh nhân |
|  | ↳ `assigned_doctor_id` | int | X | ID bác sĩ phụ trách |
|  | ↳ `created_by` | int | O | ID người tạo hồ sơ |
|  | ↳ `template_id` | string | O | Mã mẫu phiếu sử dụng (varchar 225) |
|  | ↳ `status` | string | O | Trạng thái xử lý |
|  | ↳ `instructions` | string | X | Chỉ dẫn/kết luận của bác sĩ |
|  | ↳ `completed_at` | string | X | Thời gian hoàn tất (datetime) |
|  | ↳ `created_at` | string | O | Thời điểm tạo |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật cuối |

#### Mô tả medrec05

- API xem chi tiết tổng quan của 1 bệnh án cụ thể.
- Request dạng GET (/api/v1/medical_records/:id).
- Backend chú ý: Lấy thông tin từ bảng medical_records, kèm thông tin patient_id, assigned_doctor_id và created_by.
- _(slide 28)_

#### Các test case cho medrec05

- Truyền ID bệnh án tồn tại.
- Kết quả mong đợi: Mã 1000 | OK.
- Truyền ID bệnh án không có trong hệ thống.
- Kết quả mong đợi: Mã lỗi 4001 | Medical record not found.
- _(slide 29)_

### get_medicalrecords_summary (medrec06)

- Tab Sheet: [`GET /api/medical_records/:id/summary`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=312161648)
- Đường dẫn ghi trong slide: `GET /api/v1/medical_records/:id/summary`
- Ảnh slide 30: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Dùng cho UI cần hiển thị nhanh dạng thẻ tóm tắt (Giảm tải payload trả về).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | int | O | (Path) ID của bệnh án |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Dữ liệu rút gọn của bệnh án |
|  | ↳ `medical_record_id` | int | O | ID bệnh án |
|  | ↳ `status` | string | O | Trạng thái xử lý |
|  | ↳ `patient_name` | string | O | Tên bệnh nhân (JOIN từ users) |
|  | ↳ `created_at` | string | O | Ngày khám |

#### Mô tả medrec06

- API cung cấp một bản tóm tắt nhanh (Summary) của bệnh án, dùng để hiển thị trên UI dạng thẻ (Card) hoặc header.
- Request dạng GET (/api/v1/medical_records/:id/summary)
- _(slide 31)_

#### Các test case cho medrec06

- Gọi API xem tóm tắt.
- Kết quả mong đợi: Mã 1000 | OK. Trả về thông tin tóm gọn (Status, ngày tạo, tên bệnh nhân).
- _(slide 32)_

### get_history_medicalrecords (medrec13)

- Tab Sheet: [`GET /api/medical_records/patients/:id/history`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1722132503)
- Đường dẫn ghi trong slide: `GET /api/v1/medical_records/patients/:id/history`
- Ảnh slide 33: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Xem lại danh sách các phiên khám (bệnh án) cũ của bệnh nhân (medical_records where patient_id = id).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | int | O | (Path) ID của bệnh nhân (patient_id) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng danh sách các bệnh án thuộc về bệnh nhân |
|  | ↳ `medical_record_id` | int | O | ID bệnh án |
|  | ↳ `status` | string | O | Trạng thái bệnh án |
|  | ↳ `instructions` | string | X | Kết luận cũ của bác sĩ (Nếu có) |
|  | ↳ `created_at` | string | O | Ngày khám |

#### Mô tả medrec13

- API truy xuất toàn bộ lịch sử khám bệnh (các bệnh án cũ) của một bệnh nhân cụ thể.
- Request dạng GET (/api/v1/medical_records/patients/:id/history).
- Backend chú ý: Query bảng medical_records where patient_id = :id, sort theo created_at DESC.
- _(slide 34)_

#### Các test case cho medrec13

- Bác sĩ hoặc chính bệnh nhân đó gọi API.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng lịch sử.
- Bệnh nhân A cố tình truyền ID của Bệnh nhân B.
- Kết quả mong đợi: Mã lỗi 3106 | Cannot access another user's data (RBAC chặn).
- _(slide 35)_

### set_accept_medicalrecords (medrec07)

- Tab Sheet: [`POST /api/medical_records/:id/accept`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1452024462)
- Đường dẫn ghi trong slide: `POST /api/v1/medical_records/:id/accept`
- Ảnh slide 37: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: } Bác sĩ nhận đơn khám. Cập nhật assigned_doctor_id vào bảng medical_records.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Bác sĩ |
| 2 | `id` | int | O | (Path) ID của bệnh án cần tiếp nhận |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Tiếp nhận bệnh án thành công) |
| 3 | `data` | object | O | Thông tin bệnh án sau khi cập nhật |
|  | ↳ `medical_record_id` | int | O | ID bệnh án |
|  | ↳ `assigned_doctor_id` | int | O | ID Bác sĩ (Lấy từ token) |
|  | ↳ `status` | string | O | Trạng thái chuyển thành in_progress |

#### Mô tả medrec07

- API để Bác sĩ "nhận ca" khám.
- Request dạng POST (/api/v1/medical_records/:id/accept).
- Backend chú ý: Cập nhật cột assigned_doctor_id = ID của bác sĩ gọi API. Đổi status từ pending sang in_progress.
- _(slide 38)_

#### Các test case cho medrec07

- Bác sĩ tiếp nhận bệnh án đang ở trạng thái pending.
- Kết quả mong đợi: Mã 1000 | OK.
- Bệnh án đã được bác sĩ khác nhận (status = in_progress).
- Kết quả mong đợi: Mã lỗi 4005 | Already accepted by another doctor.
- Bệnh án không ở trạng thái pending.
- Kết quả mong đợi: Mã lỗi 4004 | Medical record not in pending status.
- _(slide 39)_

### credit_medicalrecords (medrec11)

- Tab Sheet: [`PUT /api/medical_records/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1748265966)
- Đường dẫn ghi trong slide: `PUT /api/v1/medical_records/:id`
- Ảnh slide 40: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bác sĩ đưa ra kết luận (instructions), cập nhật trạng thái (status), và gán completed_at.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Bác sĩ |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | int | O | (Path) ID của bệnh án |
| 4 | `status` | string | O | Trạng thái (VD: completed, cancelled) |
| 5 | `instructions` | string | X | Chỉ dẫn y khoa, ghi chú kết luận của bác sĩ |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Cập nhật bệnh án thành công) |
| 3 | `data` | object | O | Toàn bộ object bệnh án sau cập nhật |
|  | ↳ `medical_record_id` | int | O | ID bệnh án |
|  | ↳ `patient_id` | int | O | ID bệnh nhân |
|  | ↳ `assigned_doctor_id` | int | O | ID bác sĩ phụ trách |
|  | ↳ `created_by` | int | O | ID người tạo |
|  | ↳ `template_id` | string | O | Mã mẫu phiếu |
|  | ↳ `status` | string | O | Trạng thái đã cập nhật |
|  | ↳ `instructions` | string | X | Chỉ dẫn của bác sĩ |
|  | ↳ `completed_at` | string | X | Thời điểm hoàn tất (Tự động gán bằng datetime nếu completed) |
|  | ↳ `updated_at` | string | O | Thời gian DB ghi nhận |

#### Mô tả medrec11

- API thực hiện việc "Chốt bệnh án".
- Request dạng PUT (/api/v1/medical_records/:id).
- Backend chú ý: API này cập nhật text instructions (chỉ dẫn của bác sĩ) vào bảng medical_records. Đồng thời chuyển trạng thái status thành completed và ghi nhận timestamp vào cột completed_at.
- _(slide 41)_

#### Các test case cho medrec11

- Bác sĩ phụ trách gọi API chốt hồ sơ.
- Kết quả mong đợi: Mã 1000 | OK. Hồ sơ khóa thành công.
- Một bác sĩ khác (không phải assigned_doctor_id) gọi API.
- Kết quả mong đợi: Mã lỗi 3105 | Doctor not assigned to this record.
- _(slide 42)_

### get_medicalrecords_answers (medrec08)

- Tab Sheet: [`GET /api/medical_records/:id/answers`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1276019672)
- Đường dẫn ghi trong slide: `GET /api/v1/medical_records/:id/answers`
- Ảnh slide 44: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Lấy danh sách toàn bộ các câu trả lời (Truy xuất từ bảng answers map với medical_record_id).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | int | O | (Path) ID của bệnh án |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng các câu trả lời thuộc bệnh án |
|  | ↳ `id` | int | O | ID bản ghi trả lời (PK của bảng answers) |
|  | ↳ `medical_record_id` | int | O | ID hồ sơ bệnh án (FK) |
|  | ↳ `question_id` | string | O | Khóa ngoại câu hỏi (varchar 50) |
|  | ↳ `question_option_id` | int | X | ID lựa chọn (Nếu là trắc nghiệm) |
|  | ↳ `answer_text` | string | X | Nội dung trả lời dạng văn bản |
|  | ↳ `answer_value` | object | X | Giá trị trả lời có cấu trúc (JSON) |
|  | ↳ `answered_by` | int | O | ID người thực hiện trả lời |
|  | ↳ `created_at` | string | O | Thời gian trả lời |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật trả lời |

#### Mô tả medrec08

- API truy xuất toàn bộ câu trả lời chi tiết trong biểu mẫu khám của bệnh án.
- Request dạng GET (/api/v1/medical_records/:id/answers).
- Backend chú ý: JOIN bảng answers dựa trên medical_record_id. Trả về danh sách mapping question_id và answer_value / answer_text.
- _(slide 45)_

#### Các test case cho medrec08

- Gọi API với bệnh án hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng câu trả lời.
- _(slide 46)_

### update_medicalrecords_answers     (medrec10)

- Tab Sheet: [`PUT /api/medical_records/:id/answers`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=147827662)
- Đường dẫn ghi trong slide: `PUT /api/v1/medical_records/:id/answers`
- Ảnh slide 47: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Ghi đè (Upsert) dữ liệu vào bảng answers. Đảm bảo UNIQUE(medical_record_id, question_id).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | int | O | (Path) ID của bệnh án |
| 4 | `answers` | array | O | Mảng chứa các object câu trả lời (Ghi vào bảng answers) |
|  | ↳ `question_id` | string | O | Khóa ngoại câu hỏi (varchar 50) |
|  | ↳ `question_option_id` | int | X | ID lựa chọn (Nếu có) |
|  | ↳ `answer_text` | string | X | Nội dung văn bản tự do |
|  | ↳ `answer_value` | object | X | Giá trị kiểu JSON (Nhiều lựa chọn, số liệu) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Cập nhật câu trả lời thành công) |
| 3 | `data` | object | O | Thông tin kết quả |
|  | ↳ `count` | int | O | Số lượng câu trả lời đã được Upsert thành công |

#### Mô tả medrec10

- API cho phép Bệnh nhân (trước khi khám) hoặc Bác sĩ (đang khám) cập nhật lại câu trả lời trong phiếu.
- Request dạng PUT (/api/v1/medical_records/:id/answers).
- Backend chú ý: Xử lý theo luật UNIQUE(medical_record_id, question_id). Nếu sửa thì update bản ghi hiện tại trong bảng answers.
- _(slide 48)_

#### Các test case cho medrec10

- Cập nhật câu trả lời khi bệnh án đang in_progress.
- Kết quả mong đợi: Mã 1000 | OK.
- Cố tình cập nhật khi bệnh án đã đóng (status = completed).
- Kết quả mong đợi: Mã lỗi 4003 | Medical record already completed.
- _(slide 49)_

### delete_medicalrecords (medrec14)

- Tab Sheet: [`DELETE /api/medical_records/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1888610589)
- Đường dẫn ghi trong slide: `DELETE /api/v1/medical_records/:id/`
- Ảnh slide 50: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Xóa bệnh án khỏi bảng medical_records. Do thiết lập ON DELETE, dữ liệu answers sẽ bị khóa RESTRICT hoặc CASCADE tùy DB config.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | int | O | (Path) ID của bệnh án (medical_record_id) cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa bệnh án thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả medrec14

- API thực hiện xóa toàn bộ hồ sơ bệnh án (Dành riêng cho Admin).
- Request dạng DELETE (/api/v1/medical_records/:id/).
- Backend chú ý: Khi xóa record trong medical_records, các bản ghi con trong bảng answers phải bị xóa tự động (do ràng buộc ON DELETE CASCADE). Nhưng tệp đính kèm trong media_attachments thì vẫn giữ lại, chỉ SET NULL.
- _(slide 51)_

#### Các test case cho medrec14

- Admin thực hiện xóa.
- Kết quả mong đợi: Mã 1000 | OK. Bệnh án và câu trả lời bị dọn sạch.
- Bác sĩ hoặc Lễ tân cố gắng xóa.
- Kết quả mong đợi: Mã lỗi 3102 | Admin role required.
- _(slide 52)_

## API có trong Sheet nhưng không có slide

### POST /api/medical_records/:id/answers

- Tab Sheet: [`POST /api/medical_records/:id/answers`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1429025238)

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Thêm câu trả lời bổ sung vào bệnh án

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | Header truyền Bearer Token xác thực (Bearer <token>) |
| 2 | `id` | string | O | Path param: ID hồ sơ bệnh án |
| 3 | `answers` | array | O | Mảng danh sách các câu trả lời bổ sung |
|  | ↳ `question_id` | string | O | ID câu hỏi |
|  | ↳ `answer_text` | string | X | Nội dung câu trả lời |
|  | ↳ `option_id` | string | X | ID phương án lựa chọn |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi hệ thống (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (OK) |
| 3 | `count` | string | O | Số lượng câu trả lời đã lưu thành công |

### PATCH /api/medical_records/:id/status

- Tab Sheet: [`PATCH /api/medical_records/:id/status`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1207316828)

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho Thay đổi trạng thái bệnh án

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | Header truyền Bearer Token xác thực (Bearer <token>) |
| 2 | `id` | string | O | Path param: ID hồ sơ bệnh án |
| 3 | `status` | string | O | Trạng thái bệnh án cần cập nhật (cancelled) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi hệ thống (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (OK) |
| 3 | `data` | string | O | Thông tin bệnh án sau khi đổi trạng thái |
|  | ↳ `id` | string | O | ID hồ sơ bệnh án |
|  | ↳ `status` | string | O | Trạng thái mới của bệnh án |
