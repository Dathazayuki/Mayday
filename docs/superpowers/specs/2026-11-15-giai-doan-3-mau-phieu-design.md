# Thiết kế giai đoạn 3: Mẫu phiếu khám động (Form Builder)

- **Ngày:** 2026-11-15
- **Trạng thái:** đã được duyệt theo uỷ quyền chung của người dùng ("cứ làm đầy đủ các task của dự án… cứ mạnh dạn triển khai tôi luôn đồng ý").
- **Nguồn:**
  - [02-api/10-mau-phieu-kham-dong.md](../../02-api/10-mau-phieu-kham-dong.md) (tmpl01–05, sec01–03, ques01–03; SLIDE11)
  - [03-co-so-du-lieu.md](../../03-co-so-du-lieu.md) mục 3 (nhóm B)
  - [01-tong-quan-yeu-cau.md](../../01-tong-quan-yeu-cau.md) (slide 26: logic rẽ nhánh)
  - [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md) (MT-22, MT-38)
- **Nền:** spec giai đoạn 1 và 2 (CSDL dev viết dạng `db pull`, repository, kiểu dữ liệu theo từng tab Sheet, RBAC động).

## 1. Phạm vi

**Trong phạm vi:**
- 11 API: templates ×5, sections ×3, questions ×3.
- Quyền thiết kế mẫu phiếu `manage_templates`.
- Trang thiết kế mẫu phiếu trên Web.
- Bộ tiện ích dùng chung để duyệt cây câu hỏi (`packages/shared`), giai đoạn 4 dùng lại khi hiển thị phiếu trên Web và Mobile.

**Ngoài phạm vi:**
- Trả lời phiếu (`answers`) và kiểm tra "mẫu đang được bệnh án dùng" (4105). Giai đoạn 4 mới tạo bảng `medical_records`; khi đó `DELETE /templates/:id` thêm kiểm tra 4105.
- Hiển thị phiếu cho bệnh nhân điền.

## 2. CSDL dev bổ sung (track changes coi như đã chấp nhận)

| Bảng | Cột |
|---|---|
| `templates` | `code_template` varchar(255) PK, `name` varchar(255), `description` text?, `version` varchar(50) mặc định `1.0`, `is_active` tinyint(1) mặc định 1, timestamps |
| `template_sections` | `section_id` int PK, `template_id` varchar(255) FK→templates (CASCADE), `title` varchar(255), `order` int, `is_required` tinyint(1) mặc định 0, `filled_by` enum(`patient`,`doctor`,`patdoc`)?, timestamps |
| `questions` | `question_id` varchar(50) PK, `section_id` int FK→template_sections (CASCADE), `question_text` text, `type_question` enum(`text`,`number`,`date`,`radio`,`checkbox`,`image_upload`,`group_questions`,`mix_text_image`), `placeholder` varchar(255)?, `order` int, `is_required` tinyint(1) mặc định 0, `parent_question_id` varchar(50)? (chỉ mục, **không** FK), `show_if_answer` json?, `condition_rules` json?, `help_text` text?, `allow_image` tinyint(1) mặc định 0, timestamps |
| `question_options` | `id` int PK, `question_id` varchar(50) FK→questions (CASCADE), `option_text` varchar(255), `option_value` varchar(50), `order` int, `has_text_input` tinyint(1) mặc định 0, `trigger_image_upload` tinyint(1) mặc định 0, `image_upload_label` varchar(255)?, timestamps |

Lệch trong tài liệu CSDL (**MT-67**):
- PK của `templates` đã đổi sang `code_template` varchar, nhưng `template_sections.template_id` vẫn ghi kiểu int.
- `question_id` đã đổi sang varchar(50), nhưng `parent_question_id` vẫn ghi kiểu int.

CSDL dev dùng kiểu varchar cho cả hai cột để FK và chỉ mục khớp nhau.

## 3. Hợp đồng API

### 3.1. Quy ước
- **Kiểu dữ liệu theo tab Sheet:** mọi trường trả về đều là **string**, gồm `section_id`, `order`, `is_required`/`is_active`/`allow_image`/`trigger_image_upload` (`"0"`/`"1"`) và `id` của lựa chọn.
- **Input dạng cờ:** nhận `"0"`/`"1"`; giá trị khác → 2003.
- **Input `order`:** nhận chuỗi số nguyên không âm hoặc số nguyên; sai → 2003.
- **Quyền:**
  - API ghi (POST/PUT/DELETE) yêu cầu quyền `manage_templates`, theo slide: "Admin hoặc Bác sĩ được phân quyền thiết kế form";
  - admin luôn được phép;
  - vai trò khác chỉ được phép khi đã được cấp quyền qua `role_permissions`, nếu không → 3101;
  - API đọc (GET) dành cho mọi người đã đăng nhập.
- **Cơ chế `@RequirePermission(name)`** (mở rộng RBAC giai đoạn 2):
  - decorator khai báo quyền ngay trong code;
  - `PermissionsGuard` gộp quyền khai báo trong code với quyền gắn qua `permissions_endpoints`;
  - lệnh đồng bộ endpoint ghi lại các quyền khai báo trong code vào `permissions` và `permissions_endpoints`, để CSDL phản ánh đúng code và admin xem được.
  
  Quyền khai báo trong code luôn được áp dụng, kể cả khi CSDL chưa đồng bộ, để tránh lỗ hổng.
- **Mã lỗi:**
  - 4101: không tìm thấy mẫu;
  - 4102: trùng `code_template`;
  - 4103: không tìm thấy section;
  - 4104: không tìm thấy câu hỏi;
  - 2003 (409): trùng `question_id`, vì PK toàn hệ thống và bảng mã không có mã riêng.

### 3.2. Templates

| API | Input | `data` |
|---|---|---|
| `POST /templates` (1001) | `code_template` bắt buộc (≤ 255, chỉ `A-Z 0-9 _`, VD `TMPL_URT`; sai → 2003), `name` bắt buộc, `description?`, `version?` (mặc định `"1.0"`), `is_active?` (`"1"` mặc định) | `{code_template, name, description\|null, version, is_active, created_at, updated_at}` |
| `GET /templates/all` | `page?`, `limit?` (như phân trang giai đoạn 2), `is_active?` (`"0"`/`"1"`) | Mảng `[{code_template, name, description\|null, version, is_active, created_at}]` và `total` ngoài `data`, giống `GET /admin/users` (test case slide: "kèm metadata phân trang") |
| `GET /templates/:id` | `id` = `code_template` | Xem mục 3.5 |
| `PUT /templates/:id` | `name?`, `description?`, `version?`, `is_active?` (ít nhất 1 → 2001) | `{code_template, name, description\|null, version, is_active, created_at, updated_at}`, có thêm `description` theo MT-37 |
| `DELETE /templates/:id` | | `{}`; section, câu hỏi và lựa chọn bị CASCADE. Kiểm tra 4105 thêm ở giai đoạn 4 |

### 3.3. Sections

| API | Input | `data` |
|---|---|---|
| `POST /templates/:template_id/sections` (1001) | `title` bắt buộc, `order` bắt buộc, `is_required?` (`"0"` mặc định), `filled_by?` ∈ {patient, doctor, patdoc} | `{section_id, template_id, title, order, is_required, filled_by\|null}`. Mẫu không tồn tại → 4101 |
| `PUT /templates/sections/:id` | `title?`, `order?`, `is_required?`, `filled_by?` (ít nhất 1) | như POST; không tồn tại → 4103 |
| `DELETE /templates/sections/:id` | | `{}`; câu hỏi và lựa chọn bị CASCADE; không tồn tại → 4103 |

### 3.4. Questions

**`POST /templates/sections/:section_id/questions` (1001).**

Input:
- `question_id`: bắt buộc, ≤ 50 ký tự, chỉ `A-Z 0-9 _`, sai → 2003; trùng → 2003 (409);
- `question_text`: bắt buộc;
- `type_question`: bắt buộc, thuộc enum, sai → 2003;
- `order`: bắt buộc;
- `placeholder?`, `is_required?`, `help_text?`, `allow_image?`;
- `parent_question_id?`: phải tồn tại và thuộc **cùng mẫu phiếu**, sai → 2003; không được là chính nó;
- `show_if_answer?`: chuỗi JSON, mục 3.6;
- `options?`: mảng `{option_text, option_value, order, trigger_image_upload?}`.

Ràng buộc với `options`:
- `radio`/`checkbox` bắt buộc có ít nhất 1 lựa chọn (→ 2001);
- kiểu khác mà gửi `options` → 2003;
- `option_value` trùng nhau trong cùng câu hỏi → 2003.

Section không tồn tại → 4103. Tạo câu hỏi và lựa chọn trong một transaction.

`data` là "dạng câu hỏi đầy đủ" ở mục 3.5, kèm `section_id`.

**`PUT /templates/questions/:id`.**

Input:
- các trường của Sheet: `question_text?`, `placeholder?`, `order?`, `show_if_answer?`, `options?`;
- thêm `type_question?`, `is_required?`, `parent_question_id?`, `help_text?`, `allow_image?`, theo MT-38 và mô tả slide: "cập nhật… loại câu hỏi hoặc thay đổi logic rẽ nhánh".

Ràng buộc:
- cần ít nhất 1 trường (2001);
- `options` là danh sách **đầy đủ** sau khi sửa (upsert): phần tử có `id` thì sửa, phần tử không có `id` thì tạo mới, lựa chọn cũ không có trong danh sách thì xoá;
- `id` không thuộc câu hỏi này → 2003;
- quy tắc giữa kiểu câu hỏi và lựa chọn như POST, áp dụng cho trạng thái sau khi sửa.

Không tồn tại → 4104. `data`: dạng câu hỏi đầy đủ.

**`DELETE /templates/questions/:id`.**
- Câu hỏi còn câu hỏi con (`parent_question_id` trỏ tới) → 2003 (409). Slide để ngỏ "xóa theo hoặc báo lỗi"; chọn báo lỗi để không mất dữ liệu ngầm (**MT-68**).
- Lựa chọn của câu hỏi bị CASCADE.
- Không tồn tại → 4104.
- Kết quả: `{}`.

### 3.5. Chi tiết mẫu (`GET /templates/:id`), trả đủ trường theo MT-22

```
{
  code_template, name, description|null, version, is_active, created_at, updated_at,
  sections: [                       // theo order tăng dần, rồi section_id
    { section_id, title, order, is_required, filled_by|null,
      questions: [                  // phẳng, theo order tăng dần; cây cha–con dựng bằng parent_question_id
        { question_id, section_id, question_text, type_question, placeholder|null, order, is_required,
          parent_question_id|null, show_if_answer (JSON đã parse)|null, help_text|null, allow_image,
          options: [ { id, option_text, option_value, order, trigger_image_upload } ] } ] } ]
}
```

Không tồn tại → 4101.

### 3.6. `show_if_answer` (**MT-69**)

Tài liệu chỉ nói "chuỗi JSON… chỉ hiển thị nếu câu hỏi cha có đáp án khớp", không quy định cấu trúc.

Đề xuất cấu trúc: **mảng các `option_value` của câu hỏi cha**, ví dụ `["YES"]`. Câu hỏi con hiện khi câu trả lời của câu hỏi cha (radio: giá trị đã chọn; checkbox: có ít nhất 1 giá trị) nằm trong mảng.

Kiểm tra phía server:
- chuỗi không parse được JSON, hoặc không phải mảng chuỗi khác rỗng → 2003;
- có `show_if_answer` mà không có `parent_question_id` → 2003;
- giá trị không thuộc các `option_value` của câu hỏi cha → 2003.

`condition_rules` chưa có API nào dùng nên để trống.

`packages/shared` có hàm thuần `isQuestionVisible(question, answersByQuestionId)` và `buildQuestionTree(questions)`, giai đoạn 4 dùng chung cho Web và Mobile.

## 4. Web
- **`/admin/templates`:**
  - bảng mẫu phiếu có phân trang (`getPage`) và lọc trạng thái;
  - tạo/sửa bằng Modal dùng chung, xoá bằng Popconfirm;
  - bấm vào một dòng → `/admin/templates/:code`.
- **`/admin/templates/:code`** (trình thiết kế):
  - danh sách section theo thứ tự (Collapse); mỗi section có nút sửa, xoá và "Thêm câu hỏi";
  - câu hỏi hiển thị dạng cây theo `parent_question_id`;
  - Drawer tạo/sửa câu hỏi (một component cho cả tạo và sửa):
    - ô chọn kiểu câu hỏi;
    - bảng lựa chọn sửa được, chỉ hiện với radio/checkbox;
    - chọn câu hỏi cha (lọc các câu trong cùng mẫu có lựa chọn) cùng các giá trị kích hoạt; client tự tạo chuỗi `show_if_answer`;
  - nút "Xem trước" hiển thị phiếu ở chế độ chỉ đọc, dùng `buildQuestionTree`/`isQuestionVisible`.
- **Menu:** "Mẫu phiếu" hiện với admin và với vai trò có quyền `manage_templates`. Giai đoạn này chỉ dựa vào admin (`useIsAdmin`), mở rộng sau.

## 5. Kiểm thử và hoàn thành
- **Unit test:** service (repository được mock), validator `show_if_answer`, upsert lựa chọn, `RequirePermission` trong guard, `buildQuestionTree`/`isQuestionVisible`.
- **Test tích hợp `test:db`:**
  - đủ 11 API với mỗi nhánh lỗi trong mục 3;
  - CASCADE khi xoá mẫu/section;
  - xoá câu hỏi còn câu hỏi con → 2003;
  - bác sĩ không có quyền → 3101; được cấp `manage_templates` qua `POST /role_permissions` → gọi được.
- **Seed:** thêm mẫu `TMPL_DEV_SAMPLE` (dữ liệu dev) có 2 section và vài câu hỏi rẽ nhánh, để giai đoạn 4 dùng.
- **Hoàn thành khi** lint, typecheck, test, test:e2e, test:db và build đều xanh. Cập nhật docs/05 (MT-67..MT-69) và docs/07.

## 6. Các mục MT mới

| Mã | Vấn đề | Cách làm tạm | Trạng thái |
|---|---|---|---|
| MT-67 | `template_sections.template_id` ghi kiểu int, `parent_question_id` ghi kiểu int, trong khi PK đã đổi sang varchar | CSDL dev dùng varchar | Chờ chốt (đối chiếu schema thật) |
| MT-68 | Xoá câu hỏi cha: "xóa theo hoặc báo lỗi" | Báo lỗi 2003 (409) | Đề xuất |
| MT-69 | Cấu trúc JSON của `show_if_answer` không được quy định | Mảng `option_value` của câu hỏi cha | Đề xuất |
