# Phần 10: Bộ tạo mẫu phiếu khám động (Dynamic Form Builder)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE11_DrMayDay.pptx`; [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. Cột NN: `O` = bắt buộc, `X` = không bắt buộc.

### set_template (tmpl01)

- Tab Sheet: [`POST /api/templates/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1970883342)
- Đường dẫn ghi trong slide: `POST /api/v1/templates`
- Ảnh slide 5: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Khởi tạo một mẫu phiếu khám bệnh gốc (vd: Phiếu khám mề đay).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `code_template` | string | O | Khóa chính mã định danh mẫu (VD: "TMPL_URT") |
| 4 | `name` | string | O | Tên mẫu phiếu |
| 5 | `description` | string | X | Mô tả mẫu phiếu |
| 6 | `version` | string | X | Phiên bản mẫu (VD: "1.0") |
| 7 | `is_active` | string | X | Trạng thái sử dụng ("1" hoặc "0") |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo mẫu phiếu khám thành công) |
| 3 | `data` | object | O | Chi tiết mẫu phiếu vừa tạo |
|  | ↳ `code_template` | string | O | Mã định danh mẫu |
|  | ↳ `name` | string | O | Tên mẫu phiếu |
|  | ↳ `description` | string | X | Mô tả |
|  | ↳ `version` | string | O | Phiên bản |
|  | ↳ `is_active` | string | O | Trạng thái |
|  | ↳ `created_at` | string | O | Thời gian tạo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

#### Mô tả tmpl01

- API thực hiện việc khởi tạo một mẫu phiếu khám bệnh mới (Ví dụ: Mẫu khám mề đay, Mẫu tái khám). Đây là gốc của cây biểu mẫu động.
- Request dạng POST (/api/v1/templates).
- Backend chú ý: Lưu dữ liệu vào bảng templates. Mã định danh code_template (Ví dụ: "TMPL_URT") là duy nhất. API này yêu cầu quyền Admin hoặc Bác sĩ được phân quyền thiết kế form.
- _(slide 6)_

#### Các test case cho tmpl01

- Admin tạo mẫu phiếu với thông tin hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully. Trả về thông tin bản ghi vừa tạo.
- Tạo mẫu với code_template đã tồn tại.
- Kết quả mong đợi: Mã lỗi 4102 | Template code already exists.
- _(slide 7)_

### get_list_templates (tmpl02)

- Tab Sheet: [`GET /api/templates/all`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=349571080)
- Đường dẫn ghi trong slide: `GET /api/v1/templates/all`
- Ảnh slide 8: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Truy xuất danh sách các mẫu phiếu khám đang có trên hệ thống, hỗ trợ phân trang.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `page` | string | X | (Query) Số trang hiện tại |
| 3 | `limit` | string | X | (Query) Số bản ghi trên 1 trang |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng chứa danh sách các mẫu phiếu |
| 4 | ↳ `code_template` | string | O | Mã định danh mẫu |
| 5 | ↳ `name` | string | O | Tên mẫu phiếu |
| 6 | ↳ `description` | string | X | Mô tả |
| 7 | ↳ `version` | string | O | Phiên bản |
| 8 | ↳ `is_active` | string | O | Trạng thái hoạt động |
| 9 | ↳ `created_at` | string | O | Thời gian tạo |

#### Mô tả tmpl02

- API truy xuất danh sách toàn bộ các mẫu phiếu khám đang có trong hệ thống.
- Request dạng GET (/api/v1/templates/all).
- Backend chú ý: Lấy từ bảng templates, có thể bổ sung filter theo is_active để chỉ lấy các mẫu đang được sử dụng.
- _(slide 9)_

#### Các test case cho tmpl02

- Gọi API lấy danh sách.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng dữ liệu kèm metadata phân trang.
- _(slide 10)_

### get_template_detail (tmpl03)

- Tab Sheet: [`GET /api/templates/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=144829180)
- Đường dẫn ghi trong slide: `GET /api/v1/templates/:id`
- Ảnh slide 11: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Lấy toàn bộ cấu trúc động của một mẫu phiếu khám (Bao gồm các section, questions và options).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | string | O | (Path) Mã định danh mẫu phiếu (code_template) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chi tiết mẫu phiếu và toàn bộ cây biểu mẫu |
|  | ↳ `code_template` | string | O | Mã định danh mẫu |
|  | ↳ `name` | string | O | Tên mẫu phiếu |
|  | ↳ `sections` | array | O | Mảng các phần (sections) trong mẫu |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `section_id` | string | O | ID của phần |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `title` | string | O | Tiêu đề phần |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `questions` | array | O | Mảng các câu hỏi thuộc phần này |
|  | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↳ `question_id` | string | O | ID câu hỏi |
|  | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↳ `question_text` | string | O | Nội dung câu hỏi |
|  | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↳ `type_question` | string | O | Kiểu câu hỏi |
|  | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↳ `options` | array | X | Mảng các lựa chọn (Nếu có) |
|  | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↳ `id` | string | O | ID lựa chọn |
|  | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↳ `option_text` | string | O | Tên lựa chọn hiển thị |
|  | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↳ `option_value` | string | O | Giá trị lựa chọn |

#### Mô tả tmpl03

- API quan trọng nhất của phân hệ, dùng để tải toàn bộ cấu trúc cây của một mẫu phiếu khám (Bao gồm Template -> Sections -> Questions -> Options) để client render UI.
- Request dạng GET (/api/v1/templates/:id).
- Backend chú ý: Thực hiện truy vấn lồng (Nested JSON) từ 4 bảng tương ứng. Các trường logic như show_if_answer phải được parse ra đúng cấu trúc.
- _(slide 12)_

#### Các test case cho tmpl03

- Truyền ID mẫu phiếu hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trả về object JSON với cấu trúc đa tầng.
- Truyền ID mẫu phiếu không tồn tại.
- Kết quả mong đợi: Mã lỗi 4101 | Template not found.
- _(slide 13)_

### edit_template (tmpl04)

- Tab Sheet: [`PUT /api/templates/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1039309919)
- Đường dẫn ghi trong slide: `PUT /api/v1/templates/:id`
- Ảnh slide 14: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Chỉnh sửa thông tin chung của mẫu phiếu khám (Không bao gồm cấu trúc bên trong).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | string | O | (Path) Mã định danh mẫu phiếu (code_template) |
| 4 | `name` | string | X | Cập nhật tên mẫu phiếu |
| 5 | `description` | string | X | Cập nhật mô tả |
| 6 | `version` | string | X | Cập nhật phiên bản |
| 7 | `is_active` | string | X | Cập nhật trạng thái sử dụng |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Cập nhật mẫu thành công) |
| 3 | `data` | object | O | Chi tiết mẫu phiếu sau cập nhật |
| 4 | ↳ `code_template` | string | O | Mã định danh mẫu |
| 5 | ↳ `name` | string | O | Tên mẫu phiếu |
| 6 | ↳ `version` | string | O | Phiên bản |
| 7 | ↳ `is_active` | string | O | Trạng thái |

#### Mô tả tmpl04

- API cho phép cập nhật các thông tin chung của mẫu phiếu khám (Tên, mô tả, phiên bản hoặc bật/tắt kích hoạt).
- Request dạng PUT (/api/v1/templates/:id).
- _(slide 15)_

#### Các test case cho tmpl04

- Admin cập nhật trạng thái is_active thành "0" (Ngừng dùng).
- Kết quả mong đợi: Mã 1000 | OK. Mẫu phiếu sẽ không còn hiển thị cho bác sĩ tạo bệnh án mới.
- _(slide 16)_

### delete_template (tmpl05)

- Tab Sheet: [`DELETE /api/templates/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1863562231)
- Đường dẫn ghi trong slide: `DELETE /api/v1/templates/:id`
- Ảnh slide 17: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Admin xóa mẫu bệnh án

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | string | O | (Path) Mã định danh mẫu (code_template) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa mẫu thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả tmpl05

- API xóa bỏ hoàn toàn một mẫu phiếu khám.
- Request dạng DELETE (/api/v1/templates/:id).
- Backend chú ý: Thiết kế DB quy định nếu xóa template, toàn bộ dữ liệu ở bảng con (template_sections, questions, question_options) sẽ bị xóa sạch theo cơ chế ON DELETE CASCADE. Tuy nhiên, nếu template này đã được dùng để tạo hồ sơ bệnh án (medical_records), lệnh xóa sẽ bị chặn để bảo vệ dữ liệu y tế.
- _(slide 18)_

#### Các test case cho tmpl05

- Xóa mẫu phiếu chưa từng được sử dụng.
- Kết quả mong đợi: Mã 1000 | OK. Template và các section con bị dọn sạch.
- Xóa mẫu phiếu đang được liên kết với một bệnh án.
- Kết quả mong đợi: Mã lỗi 4105 | Template in use cannot be deleted.
- _(slide 19)_

### set_template_section (sec01)

- Tab Sheet: [`POST /api/templates/:template_id/sections`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=936518891)
- Đường dẫn ghi trong slide: `POST /api/v1/templates/:template_id/sections`
- Ảnh slide 21: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Thêm một phần nội dung (section) mới vào trong một mẫu phiếu khám.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `template_id` | string | O | (Path) Mã định danh mẫu phiếu cha |
| 4 | `title` | string | O | Tiêu đề phần (VD: "Thông tin chung") |
| 5 | `order` | string | O | Thứ tự hiển thị phần |
| 6 | `is_required` | string | X | Có bắt buộc hoàn thành không ("0" hoặc "1") |
| 7 | `filled_by` | string | X | Đối tượng điền ("patient", "doctor", "patdoc") |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo section thành công) |
| 3 | `data` | object | O | Chi tiết section vừa tạo |
| 4 | ↳ `section_id` | string | O | ID của phần (PK) |
| 5 | ↳ `template_id` | string | O | Mã mẫu phiếu chứa phần này |
| 6 | ↳ `title` | string | O | Tiêu đề phần |
| 7 | ↳ `order` | string | O | Thứ tự hiển thị |
| 8 | ↳ `is_required` | string | O | Trạng thái bắt buộc |
| 9 | ↳ `filled_by` | string | O | Đối tượng điền |

#### Mô tả sec01

- API tạo mới một Phần (Section) nằm bên trong mẫu phiếu (Ví dụ: Phần "Tiền sử bệnh", Phần "Triệu chứng").
- Request dạng POST (/api/v1/templates/:template_id/sections).
- Backend chú ý: Lưu vào bảng template_sections. Cột filled_by quy định section này do patient, doctor hay cả hai điền.
- _(slide 22)_

#### Các test case cho sec01

- Tạo section thành công.
- Kết quả mong đợi: Mã 1001 | Created successfully. Trả về thông tin section.
- _(slide 23)_

### edit_template_section (sec02)

- Tab Sheet: [`PUT /api/templates/sections/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=177614167)
- Đường dẫn ghi trong slide: `PUT /api/v1/templates/sections/:id`
- Ảnh slide 24: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Sửa đổi thông tin cấu hình của một phần (section).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | string | O | (Path) ID của section cần sửa |
| 4 | `title` | string | X | Cập nhật tiêu đề |
| 5 | `order` | string | X | Cập nhật thứ tự hiển thị |
| 6 | `is_required` | string | X | Cập nhật trạng thái bắt buộc |
| 7 | `filled_by` | string | X | Cập nhật đối tượng điền |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Cập nhật section thành công) |
| 3 | `data` | object | O | Chi tiết section sau cập nhật (Giống output sec01) |
| 4 | ↳ `section_id` | string | O | ID của phần |
| 5 | ↳ `template_id` | string | O | Mã mẫu phiếu chứa phần |
| 6 | ↳ `title` | string | O | Tiêu đề phần |
| 7 | ↳ `order` | string | O | Thứ tự hiển thị |
| 8 | ↳ `is_required` | string | O | Trạng thái bắt buộc |
| 9 | ↳ `filled_by` | string | O | Đối tượng điền |

#### Mô tả sec02

- API cập nhật thông tin của một Section, thường dùng để đổi tên phần hoặc thay đổi thứ tự (order) hiển thị trên UI.
- Request dạng PUT (/api/v1/templates/sections/:id).
- _(slide 25)_

#### Các test case cho sec02

- Gửi request update hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK.
- Gửi ID section không tồn tại.
- Kết quả mong đợi: Mã lỗi 4103 | Section not found.
- _(slide 26)_

### delete_template_section (sec03)

- Tab Sheet: [`DELETE /api/templates/sections/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=307801600)
- Đường dẫn ghi trong slide: `DELETE /api/v1/templates/sections/:id`
- Ảnh slide 27: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Admin xóa phân mục

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | string | O | (Path) ID của section cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa section thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả sec03

- API xóa một Section khỏi mẫu phiếu khám.
- Request dạng DELETE (/api/v1/templates/sections/:id).
- Backend chú ý: Tương tự như template, việc xóa section sẽ CASCADE xóa sạch các câu hỏi (questions) bên trong nó.
- _(slide 28)_

#### Các test case cho sec03

- Xóa section thành công.
- Kết quả mong đợi: Mã 1000 | OK.
- _(slide 29)_

### set_template_question (ques01) (input)

- Tab Sheet: [`POST /api/templates/sections/:section_id/questions`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1351667720)
- Đường dẫn ghi trong slide: `POST /api/v1/templates/sections/:section_id/questions`
- Ảnh slide 31: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Thêm mới một câu hỏi (và danh sách lựa chọn nếu là trắc nghiệm) vào trong một section.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `section_id` | string | O | (Path) ID của phần chứa câu hỏi |
| 4 | `question_id` | string | O | (Body) Mã định danh câu hỏi (VD: "Q_ITCH") |
| 5 | `question_text` | string | O | Nội dung câu hỏi |
| 6 | `type_question` | string | O | Kiểu: "text", "number", "radio", "checkbox"... |
| 7 | `placeholder` | string | X | Gợi ý nhập liệu |
| 8 | `order` | string | O | Thứ tự hiển thị câu hỏi |
| 9 | `is_required` | string | X | Câu hỏi có bắt buộc không ("0" hoặc "1") |
| 10 | `parent_question_id` | string | X | Mã câu hỏi cha (Nếu là câu hỏi phụ thuộc) |
| 11 | `show_if_answer` | string | X | Điều kiện hiển thị (Chuỗi JSON) |
| 12 | `help_text` | string | X | Văn bản giải thích thêm |
| 13 | `allow_image` | string | X | Cho phép đính kèm ảnh ("0" hoặc "1") |
| 14 | `options` | array | X | Mảng các lựa chọn (Nếu type là radio/checkbox) |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_text` | string | O | Nội dung lựa chọn hiển thị |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_value` | string | O | Giá trị lưu trữ (VD: "YES", "NO") |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `order` | string | O | Thứ tự hiển thị lựa chọn |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `trigger_image_upload` | string | X | Bắt buộc tải ảnh khi chọn ("0" hoặc "1") |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo câu hỏi thành công) |
| 3 | `data` | object | O | Chi tiết câu hỏi và các lựa chọn vừa tạo |
|  | ↳ `question_id` | string | O | ID câu hỏi |
|  | ↳ `section_id` | string | O | ID section chứa nó |
|  | ↳ `question_text` | string | O | Nội dung câu hỏi |
|  | ↳ `type_question` | string | O | Kiểu câu hỏi |
|  | ↳ `options` | array | X | Mảng các lựa chọn (Đã được cấp DB ID) |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `id` | string | O | ID của bản ghi lựa chọn |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_text` | string | O | Tên hiển thị |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_value` | string | O | Giá trị lưu trữ |

### set_template_question (ques01) (output)

- Tab Sheet: [`POST /api/templates/sections/:section_id/questions`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1351667720)
- Đường dẫn ghi trong slide: `POST /api/v1/templates/sections/:section_id/questions`
- Ảnh slide 32: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả ques01

- API phức tạp nhất trong bộ form, dùng để định nghĩa một câu hỏi. Hỗ trợ phân nhánh logic thông qua trường parent_question_id (chỉ hiển thị nếu câu hỏi cha có đáp án khớp với show_if_answer).
- Request dạng POST (/api/v1/templates/sections/:section_id/questions).
- Backend chú ý: Lưu vào bảng questions. Nếu câu hỏi loại Trắc nghiệm (Radio/Checkbox), client sẽ gửi kèm mảng options để BE lưu tiếp vào bảng question_options.
- _(slide 33)_

#### Các test case cho sec01

- Thêm câu hỏi với type "text" và thứ tự hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully.
- ⚠ Tiêu đề slide ghi "sec01" nhưng nội dung là test case của ques01.
- _(slide 34)_

### edit_template_question (ques02) (input)

- Tab Sheet: [`PUT /api/templates/questions/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=984006780)
- Đường dẫn ghi trong slide: `PUT /api/v1/templates/questions/:id`
- Ảnh slide 35: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Chỉnh sửa cấu hình, nội dung hoặc các danh sách lựa chọn của một câu hỏi đã tồn tại.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | string | O | (Path) Mã định danh của câu hỏi (question_id) |
| 4 | `question_text` | string | X | Cập nhật nội dung câu hỏi |
| 5 | `placeholder` | string | X | Cập nhật gợi ý |
| 6 | `order` | string | X | Cập nhật thứ tự |
| 7 | `show_if_answer` | string | X | Cập nhật điều kiện hiển thị |
| 8 | `options` | array | X | Mảng các lựa chọn (Upsert - thêm/sửa/xóa options) |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `id` | string | X | ID lựa chọn (Nếu sửa), bỏ trống nếu tạo mới |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_text` | string | X | Nội dung lựa chọn hiển thị |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_value` | string | X | Giá trị lưu trữ |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Cập nhật câu hỏi thành công) |
| 3 | `data` | object | O | Chi tiết câu hỏi sau cập nhật |
|  | ↳ `question_id` | string | O | ID câu hỏi |
|  | ↳ `section_id` | string | O | ID section chứa nó |
|  | ↳ `question_text` | string | O | Nội dung câu hỏi |
|  | ↳ `type_question` | string | O | Kiểu câu hỏi |
|  | ↳ `options` | array | X | Mảng các lựa chọn |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `id` | string | O | ID của bản ghi lựa chọn |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_text` | string | O | Tên hiển thị |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `option_value` | string | O | Giá trị lưu trữ |

### edit_template_question (ques02) (output)

- Tab Sheet: [`PUT /api/templates/questions/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=984006780)
- Đường dẫn ghi trong slide: `PUT /api/v1/templates/questions/:id`
- Ảnh slide 36: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả ques02

- API cập nhật nội dung văn bản của câu hỏi, loại câu hỏi hoặc thay đổi logic rẽ nhánh.
- Request dạng PUT (/api/v1/templates/questions/:id).
- Backend chú ý: Cập nhật trực tiếp trên bảng questions dựa vào id.
- _(slide 37)_

#### Các test case cho ques02

- Chỉnh sửa câu hỏi thành công.
- Kết quả mong đợi: Mã 1000 | OK.
- Câu hỏi truyền lên sai ID.
- Kết quả mong đợi: Mã lỗi 4104 | Question not found.
- _(slide 38)_

### delete_template_question (ques03)

- Tab Sheet: [`DELETE /api/templates/questions/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=796922015)
- Đường dẫn ghi trong slide: `DELETE /api/v1/templates/questions/:id`
- Ảnh slide 39: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Admin xóa câu hỏi

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | string | O | (Path) Mã định danh câu hỏi cần xóa (question_id) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa câu hỏi thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả ques02

- API xóa một câu hỏi khỏi Form.
- Request dạng DELETE (/api/v1/templates/questions/:id).
- Backend chú ý: Cần lưu ý nếu xóa một câu hỏi đang đóng vai trò là "câu hỏi cha" (parent_question_id), các câu hỏi con phụ thuộc vào nó sẽ cần được xử lý (xóa theo hoặc báo lỗi) dựa trên logic nghiệp vụ của BE.
- ⚠ Tiêu đề slide ghi "ques02" nhưng nội dung mô tả ques03 (DELETE câu hỏi).
- _(slide 40)_

#### Các test case cho ques02

- Xóa câu hỏi độc lập thành công.
- Kết quả mong đợi: Mã 1000 | OK.
- ⚠ Tiêu đề slide ghi "ques02" nhưng nội dung là test case của ques03.
- _(slide 41)_
