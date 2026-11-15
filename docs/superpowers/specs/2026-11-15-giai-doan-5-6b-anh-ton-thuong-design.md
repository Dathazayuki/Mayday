# Thiết kế giai đoạn 5 và 6b: Kho ảnh, ảnh câu trả lời và theo dõi tổn thương da

- **Ngày:** 2026-11-15
- **Trạng thái:** đã được duyệt theo uỷ quyền chung của người dùng ("cứ làm đầy đủ các task của dự án… cứ mạnh dạn triển khai tôi luôn đồng ý").
- **Nguồn:**
  - [02-api/07-kho-anh-tep-dinh-kem.md](../../02-api/07-kho-anh-tep-dinh-kem.md) (img01, img03, img05, ansimg01, ansimg03, ansimg04, cùng 3 API chỉ có trong Sheet: `upload-multiple`, `view/:id`, `answer-images/bulk`; SLIDE8)
  - [02-api/08-ton-thuong-da.md](../../02-api/08-ton-thuong-da.md) (lesion01–04, lesion06, loc01, loc03–05, lphoto01–04, cùng `GET lesion-episodes/record/:medical_record_id` chỉ có trong Sheet; SLIDE9)
  - [03-co-so-du-lieu.md](../../03-co-so-du-lieu.md) mục 16–20 (`media_attachments`, `answer_images`, `lesion_episodes`, `lesion_locations`, `lesion_photos`) và bảng FK ở mục 9
  - [02-api/00-quy-uoc-va-ma-phan-hoi.md](../../02-api/00-quy-uoc-va-ma-phan-hoi.md) (6001–6007, 7001–7007)
  - [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md) (MT-06, MT-18, MT-23, MT-24, MT-36, MT-39, MT-40, MT-41, MT-56)
- **Nền:** spec giai đoạn 0–4. Giai đoạn 0 đã có MinIO trong docker-compose (cổng máy 9100, biến `MINIO_*`). Giai đoạn 4 đã có bệnh án, câu trả lời, luật ghi câu trả lời và hai quyền `view_medical_records`, `examine_medical_records`.

## 1. Phạm vi

**Trong phạm vi:**
- 23 API:
  - 9 API kho ảnh và ảnh câu trả lời (Phần 7): tải một ảnh, tải nhiều ảnh, danh sách theo người dùng, xem ảnh, xoá ảnh; gắn một ảnh, gắn nhiều ảnh, xem, gỡ ảnh khỏi câu trả lời.
  - 14 API tổn thương da (Phần 8): đợt tổn thương (6 API, gồm tra theo bệnh án), vị trí (4), ảnh theo mốc kèm điểm triệu chứng (4).
- Lưu tệp trên MinIO, xem ảnh qua API (mục 3).
- Ảnh trong câu trả lời phiếu khám mà giai đoạn 4 để lại: câu `image_upload`, `mix_text_image`, câu có `allow_image` = `"1"`, lựa chọn có `trigger_image_upload` = `"1"`.
- Điều chỉnh API cũ cho khớp các khoá ngoại mới (mục 4.7).
- Web: bác sĩ xem đợt tổn thương, vị trí, ảnh theo mốc và ảnh câu trả lời trong trang chi tiết bệnh án.
- Mobile: bệnh nhân ghi đợt, vị trí và ảnh tổn thương (máy ảnh hoặc thư viện), đính kèm ảnh vào phiếu khám, quản lý kho ảnh của mình.

**Ngoài phạm vi:**
- AI `POST /api/ai/predict/image` (MT-24). API chỉ lưu `annotated_url` khi client gửi lên.
- Video và âm thanh (MT-82).
- Bác sĩ tải ảnh lên từ Web: tài liệu không mô tả màn hình này. API vẫn cho nhân viên tải ảnh theo mục 5.
- Dọn các tệp mồ côi trên MinIO.

## 2. CSDL dev bổ sung

| Bảng | Cột |
|---|---|
| `media_attachments` | `id` int PK; `user_id` int FK→users; `ma_ho_so` int? FK→medical_records; `question_id` varchar(50)? FK→questions (**MT-81**); `file_path` varchar(255); `file_url` varchar(255); `file_name` varchar(255); `file_type` varchar(100); `media_type` enum(image, video, audio); `category` varchar(100)?; `description` varchar(255)?; timestamps |
| `answer_images` | `id` int PK; `answer_id` int FK→answers; `attachment_id` int FK→media_attachments; `option_value` varchar(255)?; timestamps; UNIQUE(`answer_id`, `attachment_id`) |
| `lesion_episodes` | `episode_id` int PK; `ma_ho_so` int FK→medical_records (**MT-80**); `ma_benh_nhan` int FK→users; `name` varchar(255); `occurred_at` datetime?; `context_tags` json?; `context_other` text?; `medication_name` varchar(255)?; `medication_taken_ago` int?; `medication_unit` enum(hour, minute, day, month, year)?; `description` text?; timestamps |
| `lesion_locations` | `id` int PK; `episode_id` int FK→lesion_episodes; `body_part` varchar(100); `occurred_at` datetime?; `context_tags` json?; `context_other` text?; `medication_name` varchar(255)?; `medication_taken_ago` int?; `medication_unit` enum(hour, minute, day, month, year)?; timestamps |
| `lesion_photos` | `photo_id` int PK; `episode_id` int FK→lesion_episodes; `location_id` int? FK→lesion_locations; `attachment_id` int FK→media_attachments; `taken_at` datetime?; `milestone` enum(start, peak, normal); `itch_score`, `pain_score`, `burn_score` tinyint?; `hives_count`, `local_auas` int?; `annotated_url` varchar(500)?; timestamps |

- **Viết đúng dạng `prisma db pull` sinh ra**, như các giai đoạn trước:
  - enum theo từng bảng (`media_attachments_media_type`, `lesion_episodes_medication_unit`, `lesion_locations_medication_unit`, `lesion_photos_milestone`);
  - `@@index` cho mỗi cột FK;
  - `onUpdate: Restrict`, trừ `lesion_photos.location_id` là `Cascade` (mục 20 ghi "ON UPDATE CASCADE").
- **Track change coi như đã chấp nhận:**
  - tên bảng `media_attachments` (thay `image_attachments`);
  - `question_id` kiểu varchar(50);
  - khoá chính `episode_id`, `photo_id`;
  - `occurred_at`, `taken_at` kiểu datetime;
  - `medication_unit` có thêm `year`.
- **Cột bắt buộc theo Sheet:** cột mà output Sheet ghi "O" thì NOT NULL; cột "X" thì cho phép NULL. `media_type` không có giá trị mặc định ở CSDL; API tự gán `image` khi client không gửi.
- **UNIQUE của `answer_images`:** tài liệu không ghi. CSDL dev đặt ràng buộc này để bắt được lỗi 6006 cả khi hai request gửi đồng thời.
- **Ánh xạ:**
  - `medical_record_id` ↔ `ma_ho_so` (cả `media_attachments` và `lesion_episodes`);
  - `patient_id` ↔ `ma_benh_nhan`;
  - `attachment_id` ↔ `media_attachments.id`;
  - `lesion_location_id` (loc*) và `location_id` (lphoto*) ↔ `lesion_locations.id`;
  - `episode_id` ↔ `lesion_episodes.episode_id`; riêng `GET lesion-episodes/record` trả tên `id` (MT-88);
  - `context_tags`: API nhận và trả chuỗi JSON, CSDL lưu json;
  - `medication_taken_ago` và các điểm số: API dùng chuỗi số, CSDL lưu số nguyên.
- **ON DELETE** (bảng FK mục 9):

  | Khoá ngoại | ON DELETE | Hệ quả |
  |---|---|---|
  | `media_attachments.user_id` → users | RESTRICT | Người dùng còn ảnh thì không xoá được (mục 4.7) |
  | `media_attachments.ma_ho_so` → medical_records | RESTRICT | Xoá bệnh án: service đặt `ma_ho_so` = NULL trước (mục 4.7, MT-18) |
  | `media_attachments.question_id` → questions | SET NULL | Xoá câu hỏi thì ảnh mất liên kết câu hỏi |
  | `answer_images.answer_id` → answers | CASCADE | Xoá câu trả lời thì liên kết ảnh mất theo |
  | `answer_images.attachment_id` → media_attachments | CASCADE | Xoá ảnh thì liên kết ảnh mất theo (khớp slide img05) |
  | `lesion_episodes.ma_ho_so` → medical_records | RESTRICT | Bệnh án còn đợt tổn thương thì không xoá được |
  | `lesion_episodes.ma_benh_nhan` → users | RESTRICT | |
  | `lesion_locations.episode_id` → lesion_episodes | RESTRICT | Service xoá vị trí trước khi xoá đợt (MT-18) |
  | `lesion_photos.episode_id` → lesion_episodes | RESTRICT | Service xoá ảnh trước khi xoá đợt (MT-18) |
  | `lesion_photos.location_id` → lesion_locations | CASCADE | Xoá vị trí thì ảnh của vị trí mất theo |
  | `lesion_photos.attachment_id` → media_attachments | RESTRICT | Ảnh còn được dùng cho ảnh tổn thương thì không xoá được (2003, 409) |

## 3. Lưu trữ MinIO

- **Kết nối:**
  - Dùng thư viện `minio` (SDK JavaScript chính thức). Cấu hình lấy từ `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, cộng biến mới `MINIO_USE_SSL` (không bắt buộc, mặc định `false`).
  - Bucket để private, không đặt policy công khai. Lúc khởi động, nếu bucket chưa có thì API tự tạo.
  - Thiếu biến `MINIO_*` thì app vẫn khởi động (giống cách kết nối CSDL "lười" của giai đoạn 0) và ghi cảnh báo; mọi API cần lưu trữ trả 6007.
  - Code chỉ gọi MinIO qua interface `ObjectStorage` (`putObject`, `getObject`, `removeObject`). Test dùng bản cài đặt trong bộ nhớ.
- **Khoá object:** `media/<user_id>/<uuid v4>.<đuôi>`, với `<đuôi>` ∈ {jpg, png, webp} theo định dạng nhận được. Tên tệp gốc không bao giờ nằm trong khoá. `file_path` lưu khoá này (MT-84).
- **Kiểm tra định dạng:**
  - Đọc chữ ký đầu tệp, bỏ qua MIME mà client khai báo:
    - JPEG: `FF D8 FF`;
    - PNG: `89 50 4E 47 0D 0A 1A 0A`;
    - WEBP: `RIFF` + 4 byte bất kỳ + `WEBP`.
  - Không khớp → 6002 (MT-82).
  - `file_type` và `Content-Type` của object là MIME xác định được từ chữ ký.
- **Kích thước:**
  - multer dùng `memoryStorage`, giới hạn `fileSize` = 5MB cho mỗi tệp (MT-83). Vượt giới hạn → HTTP 413 → 6003, theo ánh xạ của giai đoạn 0.
  - Số tệp quá giới hạn → 6004.
  - Tệp 0 byte → 6001.
- **Tên tệp gốc:** multer đọc tên tệp theo UTF-8 (`defParamCharset: 'utf8'`) để tên tiếng Việt không bị lỗi font. Chỉ lấy phần tên (bỏ đường dẫn), cắt còn 255 ký tự. Tên rỗng thì dùng `anh.<đuôi>`.
- **Tải lên:**
  1. Kiểm tra hết các tệp trước.
  2. `putObject` từng tệp.
  3. Ghi CSDL trong một transaction: tạo bản ghi, rồi cập nhật `file_url` = `/api/v1/image-attachments/view/<id>`.
  - Lỗi MinIO → 6007, không ghi gì vào CSDL.
  - Lỗi CSDL → xoá các object vừa tải (best-effort), rồi trả lỗi CSDL như thường.
- **Xem ảnh:**
  - `getObject` trả về luồng dữ liệu, controller trả `StreamableFile`; `ResponseInterceptor` để nguyên `StreamableFile`, không bọc envelope.
  - Object không có (`NoSuchKey`) → 6005; lỗi MinIO khác → 6007.
- **Xoá ảnh (img05):**
  - Trong một transaction: xoá bản ghi, rồi gọi `removeObject` trước khi commit.
  - Lỗi MinIO thì rollback, trả 6007; bản ghi và tệp vẫn còn nguyên.
  - Object đã mất từ trước được coi là xoá thành công.
- **Những thao tác không bao giờ xoá tệp:** gỡ ảnh khỏi câu trả lời, xoá ảnh tổn thương, xoá vị trí, xoá đợt. Theo ghi chú backend của ansimg04, ảnh "có thể đang dùng cho nghiệp vụ khác". Người dùng tự xoá tệp ở kho ảnh của mình.

## 4. Hợp đồng API

### 4.1. Quy ước chung

- **Kiểu dữ liệu theo từng tab Sheet (MT-06):**
  - mọi trường trả về là string, trừ `attachment_id` trong `data` của `answer-images/bulk` (tab ghi integer);
  - `total` của `upload-multiple` và `bulk` là string, nằm ngoài `data`, dùng cơ chế `Paginated` của giai đoạn 2 (kiểu `total` nới thành `number | string`).
- **Giá trị và thời gian:**
  - giá trị chưa có trả `null`;
  - `created_at`/`updated_at` dạng ISO 8601 (spec giai đoạn 2, mục 3.1);
  - `occurred_at`/`taken_at` nhận và trả dạng `YYYY-MM-DD HH:mm:ss`, giờ Việt Nam không kèm múi giờ; lưu nguyên giờ đồng hồ; sai dạng hoặc ngày không có thật → 2006 (MT-91).
- **ID:**
  - ID trong path và body là chuỗi số nguyên dương, đúng kiểu string của tab;
  - chuỗi không phải số nguyên dương, hoặc không có bản ghi, đều trả mã "không tìm thấy" của đối tượng đó (6005, 7001, 7002, 7003, 4001, 3007, 4104);
  - JSON gửi số thay vì chuỗi → 2002 (ValidationPipe).
- **Mã thành công:**
  - API tạo mới trả 1001: img01, `upload-multiple`, ansimg01, `bulk`, lesion02, loc01, lphoto01 (khớp tab và test case);
  - còn lại trả 1000;
  - API xoá trả `data: {}`.
- **Mã lỗi không có mã riêng:**
  - thiếu tham số bắt buộc → 2001;
  - giá trị sai → 2003;
  - không có câu trả lời hoặc không có liên kết ảnh → 2003 (404);
  - bị khoá ngoại RESTRICT chặn → 2003 (409).
- **PATCH:**
  - phải có ít nhất 1 trường, ngược lại 2001;
  - trường tuỳ chọn gửi `null` để xoá giá trị, trừ `name`, `body_part`, `milestone`.
- **Thứ tự kiểm tra** (cố định để test viết được):
  1. kiểu dữ liệu (pipe);
  2. vai trò (3104);
  3. giá trị trường (7004–7007, 2003, 2006);
  4. sự tồn tại (4001, 6005, 7001–7003);
  5. quyền truy cập (3106; 3101 khi nhân viên thiếu quyền);
  6. trạng thái bệnh án (4003, 4009);
  7. luật ghi riêng của bệnh nhân ở giai đoạn 4 (`draft`/`pending`, section → 3101);
  8. trùng lặp (6006).
  
  Lỗi của multer (6003, 6004) xảy ra trước pipe, sau guard JWT. Thiếu tệp (6001) do service kiểm tra ở bước 3.
- **Trường bối cảnh và thuốc** của đợt và vị trí (kiểm tra bằng hàm dùng chung ở mục 4.8):
  - `context_tags` phải là chuỗi JSON của một mảng chuỗi không rỗng, ngược lại 2003;
  - `medication_taken_ago` phải là số nguyên ≥ 0, ngược lại 2003;
  - `medication_unit` ∉ {minute, hour, day, month, year} → 2003;
  - chuỗi dài quá cột (`name` 255, `body_part` 100, `medication_name` 255, `annotated_url` 500, `category` 100, `description` của ảnh 255, `option_value` 255) → 2003.

### 4.2. Kho ảnh

| API | Quy tắc |
|---|---|
| `POST /image-attachments/upload` (1001) | multipart, tệp nằm ở trường `file`. Thiếu tệp hoặc tệp 0 byte → 6001 (test case slide). Định dạng theo mục 3; ngoài JPEG/PNG/WEBP → 6002. `media_type` không gửi thì là `image`; ngoài enum → 2003; khác `image` → 6002 (MT-82). Quá 5MB → 6003 (test case slide, MT-83). `medical_record_id`?: không có → 4001; quyền theo mục 5. `question_id`?: không có → 4104; nếu gửi kèm `medical_record_id` thì câu hỏi phải thuộc mẫu của bệnh án, ngược lại 4008. `user_id` = người gọi (ghi chú Sheet). Lỗi MinIO → 6007. `data` = `MediaAttachmentData`: đủ các trường của tab, `file_path` và `file_url` theo MT-84 |
| `POST /image-attachments/upload-multiple` (1001) | multipart, tệp nằm ở trường `images`, kèm `user_id` (thiếu → 2001; khác người gọi → 3106, MT-86). Không có tệp → 6001; quá 10 tệp → 6004; mỗi tệp kiểm tra như img01 (6002, 6003). Thành công tất cả hoặc không có gì (mục 3). `media_type` = `image`; không có `medical_record_id`/`question_id` vì tab không có. `data` = `[{id, file_url}]` theo thứ tự gửi; `total` (string) = số tệp, nằm ngoài `data` |
| `GET /image-attachments/user/:user_id` | Người dùng không có → 3007. Quyền theo mục 5. `data` = `[{id, medical_record_id, question_id, file_url, file_type, created_at}]`, sắp xếp `created_at` giảm dần. Không phân trang (tab không có) |
| `GET /image-attachments/view/:id` | Bắt buộc Bearer token (MT-85); quyền theo mục 5. Không có bản ghi, hoặc object đã mất → 6005; lỗi MinIO khác → 6007. Thành công trả luồng nhị phân với các header `Content-Type` = `file_type`, `Content-Disposition: inline; filename*=UTF-8''<tên gốc>`, `Cache-Control: private, max-age=300`, `X-Content-Type-Options: nosniff`. Khi lỗi vẫn trả JSON `{code, message}` |
| `DELETE /image-attachments/:id` | Không có → 6005 (test case slide). Chỉ người tải lên (mục 5). Xoá theo mục 3: `answer_images` tự CASCADE; ảnh còn được `lesion_photos` tham chiếu → 2003 (409), theo bảng FK (RESTRICT; slide ghi "CASCADE hoặc RESTRICT tùy config", MT-18) |

### 4.3. Ảnh câu trả lời

| API | Quy tắc |
|---|---|
| `POST /answer-images` (1001) | `answer_id`, `attachment_id` bắt buộc (2001); `option_value`? lưu nguyên giá trị, không bắt buộc phải là `option_value` của câu hỏi (Sheet ví dụ `"front_view"`). Câu trả lời không có → 2003 (404); ảnh không có → 6005. Ảnh phải do người gọi tải lên (bệnh nhân → 3106, nhân viên → 3101). Ảnh đã gắn `ma_ho_so` khác bệnh án của câu trả lời → 2003. Quyền và trạng thái theo luật ghi câu trả lời của giai đoạn 4 (mục 5). Bệnh án `completed` → 4003 (test case slide), `cancelled` → 4009. Cặp (`answer_id`, `attachment_id`) đã có → 6006 (test case slide), bắt cả lỗi UNIQUE khi gửi đồng thời. `data` = `{id, answer_id, attachment_id, option_value, created_at}` |
| `POST /answer-images/bulk` (1001) | `answer_id` bắt buộc. `attachments` không được rỗng (rỗng → 2001); `attachment_id` trùng nhau trong request → 2003. Mỗi ảnh kiểm tra như ansimg01. Mọi liên kết tạo trong một transaction: một ảnh lỗi thì không tạo liên kết nào. `option_value` = null vì tab không có. `data` = `[{id, answer_id, attachment_id}]`, trong đó `attachment_id` là **integer** đúng như tab (MT-06); `total` (string) nằm ngoài `data`. Tiêu đề tab "Xem kết quả xét nghiệm" là lỗi chép (MT-39) |
| `GET /answer-images/:answer_id` | Câu trả lời không có → 2003 (404). Quyền xem như bệnh án (mục 5). `data` = `[{id, option_value, attachment: {attachment_id, file_url, file_name}}]`: `attachment` được lồng (MT-36), sắp xếp `id` tăng dần. Chưa có ảnh → `[]` |
| `DELETE /answer-images/:id` | Liên kết không có → 2003 (404). Quyền và trạng thái như ansimg01. **Chỉ xoá bản ghi `answer_images`**, không động đến `media_attachments` và MinIO (ghi chú backend của slide) |

### 4.4. Đợt tổn thương

| API | Quy tắc |
|---|---|
| `POST /lesion-episodes` (1001) | Chỉ bệnh nhân (3104). `name` thiếu, rỗng hoặc chỉ có khoảng trắng → 7004 (test case slide). `medical_record_id` bắt buộc (2001); không có → 4001; của người khác → 3106; bệnh án `completed` → 4003, `cancelled` → 4009 (MT-92). `patient_id` = người gọi (ghi chú backend). Trường bối cảnh và thuốc theo 4.1. `data` = `LesionEpisodeData` (đủ các trường của tab, `episode_id` dạng string theo test case) |
| `GET /lesion-episodes/my` | Chỉ bệnh nhân (3104). **Không gửi** `medical_record_id`: bệnh nhân không có bệnh án nào đang hoạt động (trạng thái khác `completed`/`cancelled`) → 4002 (test case slide, MT-87). **Có gửi:** bệnh án không có hoặc đã đóng → 4002 (ghi chú backend: "không tồn tại hoặc đã đóng"); của người khác → 3106. `data` = 8 trường của tab (không có bối cảnh/thuốc), sắp xếp `created_at` giảm dần |
| `GET /lesion-episodes/:id` | Không có → 7001 (test case slide). Quyền xem (mục 5). `data` = `LesionEpisodeData` |
| `PATCH /lesion-episodes/:id` | Không có → 7001. Bệnh nhân sở hữu (MT-92). Bệnh án `completed` → 4003 (test case slide), `cancelled` → 4009. Có `name` mà rỗng → 7004. Các trường còn lại kiểm tra như POST. Không đổi được `medical_record_id` (tab không có). Trả object đầy đủ |
| `DELETE /lesion-episodes/:id` | Không có → 7001. Bệnh nhân sở hữu; bệnh án đã đóng → 4003/4009 (MT-92). Trong một transaction: xoá `lesion_photos` của đợt, rồi `lesion_locations`, rồi đợt. Như cách giai đoạn 4 xử lý MT-18, cách này chạy đúng cả khi FK là RESTRICT (bảng FK) lẫn CASCADE (slide). Không xoá tệp trong kho ảnh |
| `GET /lesion-episodes/record/:medical_record_id` | Bệnh án không có → 4001. Quyền xem (mục 5); "Bearer Token của Admin" là lỗi chép (MT-23). `data` là mảng `[{id, medical_record_id, name, occurred_at, context_tags, description}]`, giữ tên `id` của tab, mã 1000 (MT-88). Sắp xếp `created_at` giảm dần |

### 4.5. Vị trí tổn thương

| API | Quy tắc |
|---|---|
| `POST /lesion-locations` (1001) | Chỉ bệnh nhân (3104). `body_part` thiếu, rỗng hoặc chỉ có khoảng trắng → 7005 (test case slide). `episode_id` bắt buộc (2001); không có → 7001. Đợt của người khác → 3106. Bệnh án đã đóng → 4003/4009 (MT-92). Trường bối cảnh và thuốc theo 4.1. `data` = `LesionLocationData` |
| `GET /lesion-locations/episode/:episode_id` | Đợt không có → 7001. Quyền xem. Sắp xếp `created_at` tăng dần. Mô tả tab ghi "kèm ảnh" nhưng output không có ảnh (MT-89); client lấy ảnh bằng lphoto02. Slide ghi nhầm "lesion01" ở tiêu đề test case (MT-41) |
| `PATCH /lesion-locations/:id` | Không có → 7002. Bệnh nhân sở hữu; bệnh án đã đóng → 4003/4009. Có `body_part` mà rỗng → 7005. Trả object đầy đủ. Ảnh slide output trùng ảnh input (MT-40); theo tab Sheet |
| `DELETE /lesion-locations/:id` | Không có → 7002. Bệnh nhân sở hữu; bệnh án đã đóng → 4003/4009. Ảnh của vị trí mất theo nhờ FK CASCADE |

### 4.6. Ảnh tổn thương

| API | Quy tắc |
|---|---|
| `POST /lesion-photos` (1001) | Chỉ bệnh nhân (3104). Bắt buộc `episode_id`, `attachment_id`, `milestone` (2001). `milestone` ∉ {start, peak, normal} → 7006 (test case slide). `itch_score`/`pain_score`/`burn_score`: không phải số nguyên → 2003, ngoài 0–10 → 7007 (test case slide). `hives_count`/`local_auas` phải là số nguyên ≥ 0 (2003). `taken_at` sai → 2006. Đợt không có → 7001. `location_id`? không có → 7002, thuộc đợt khác → 2003. Ảnh không có → 6005, không do người gọi tải lên → 3106, đã gắn `ma_ho_so` khác bệnh án của đợt → 2003. Đợt của người khác → 3106; bệnh án đã đóng → 4003/4009. `data` = `LesionPhotoData`. Slide ghi nhầm "loc01" ở tiêu đề (MT-41) |
| `GET /lesion-photos/location/:location_id` | Vị trí không có → 7002. Quyền xem. Mỗi phần tử có thêm `attachment: {attachment_id, file_url}` (join `media_attachments`). Sắp xếp `taken_at` tăng dần (bản ghi chưa có `taken_at` xếp sau), rồi `created_at`. Slide chép nhầm mô tả của loc03 (MT-41); làm theo Sheet |
| `PATCH /lesion-photos/:id/milestone` | Không có → 7003. Bệnh nhân sở hữu; bệnh án đã đóng → 4003/4009. Nhận `milestone`, các điểm, `hives_count`, `local_auas`, `annotated_url` như tab (không có `taken_at`, `location_id`, `attachment_id`). Kiểm tra 7006/7007/2003 như POST. Trả object đầy đủ |
| `DELETE /lesion-photos/:id` | Không có → 7003. Bệnh nhân sở hữu; bệnh án đã đóng → 4003/4009. Chỉ xoá bản ghi `lesion_photos` (ghi chú backend); tệp vẫn ở kho ảnh. Tiêu đề tab "Cập nhật mốc" và tiêu đề slide "loc05" là lỗi chép (MT-39, MT-41) |

### 4.7. Thay đổi API cũ

- **`DELETE /medical_records/:id` (giai đoạn 4).** Trong cùng transaction:
  - đặt `media_attachments.ma_ho_so` = NULL (slide: ảnh SET NULL; bảng FK: RESTRICT; MT-18);
  - xoá `answers` như trước; `answer_images` mất theo nhờ CASCADE;
  - bệnh án còn đợt tổn thương → 2003 (409), vì FK là RESTRICT và slide không nói gì.
- **`POST /medical_records` và `PUT /medical_records/:id/answers` (giai đoạn 4):**
  - upsert phải cập nhật tại chỗ, giữ nguyên `answers.id`; xoá rồi tạo lại sẽ làm mất `answer_images` do CASCADE;
  - nhận phần tử chỉ có `question_id` (MT-93).
- **`DELETE /admin/users/:id` (giai đoạn 2):** người dùng còn ảnh trong kho hoặc còn đợt tổn thương → 2003 (409), theo quy ước RESTRICT của giai đoạn 2.

### 4.8. Dùng chung (`packages/shared`)

- **Hợp đồng** `contracts/media.ts`, `contracts/lesions.ts`: kiểu request/response, enum, hằng số giới hạn (`MEDIA_MAX_FILE_BYTES`, `MEDIA_MAX_BATCH_FILES`, `SYMPTOM_SCORE_MIN/MAX`), đường dẫn (`MEDIA_PATHS`, `LESION_PATHS`), nhãn tiếng Việt (mốc, đơn vị thời gian, điểm triệu chứng).
- **Hàm thuần:**
  - `media.ts`: `normalizeImageMime`, `checkImageFile`, `checkImageBatch`, `imageExtension`, `mediaFileUrl`, `resolveMediaUrl`;
  - `answer-images.ts`: `questionAcceptsImages`, `imageTriggerOptionValues`, `validateImageQuestions`, `imageAnswerPlaceholders`;
  - `lesions.ts`: `isLesionMilestone`, `checkSymptomScore`, `isNonNegativeIntString`, `parseContextTags`, `stringifyContextTags`, `isValidLesionDateTime`, `formatLesionDateTime`, `isRecordActiveForLesions`, `groupPhotosByMilestone`, `describeMedication`, `LESION_CONTEXT_TAG_SUGGESTIONS`.
- API cũng kiểm tra input bằng chính các hàm này, nên luật ở client và server là một.
- `ApiResponse.total` nới thành `number | string`; `getPage` chuyển sang số.

## 5. Phân quyền

Admin luôn được qua các kiểm tra dành cho nhân viên. Các API **chỉ dành cho bệnh nhân** trả 3104 cho mọi vai trò khác, kể cả admin, vì cần chính bệnh nhân làm `patient_id`/chủ sở hữu (giống `POST /uas7-scores` ở giai đoạn 6a). Quyền của nhân viên kiểm tra bằng cùng cơ chế với giai đoạn 4.

| Thao tác | Bệnh nhân | Nhân viên |
|---|---|---|
| Tải ảnh lên (img01, `upload-multiple`) | Được. `medical_record_id` phải là bệnh án của mình (3106) | Được. Khi gửi `medical_record_id` thì cần `examine_medical_records` (3101) |
| Danh sách ảnh theo người dùng (img03) | Chỉ `user_id` của mình (3106) | Của mình; của người khác thì cần `view_medical_records` (3101) |
| Xem ảnh (`view/:id`) | Ảnh mình tải lên, hoặc ảnh có `ma_ho_so` là bệnh án của mình (3106) | Ảnh mình tải lên; mọi ảnh khi có `view_medical_records` (3101) |
| Xoá ảnh (img05) | Ảnh mình tải lên (3106) | Ảnh mình tải lên (3101). Theo test case slide: "ảnh thuộc sở hữu của user" |
| Gắn/gỡ ảnh câu trả lời (ansimg01, `bulk`, ansimg04) | Theo luật ghi câu trả lời của giai đoạn 4: bệnh án của mình (3106), trạng thái `draft`/`pending`, section có `filled_by` ∈ {patient, patdoc} (3101) | `examine_medical_records` (3101) |
| Xem ảnh câu trả lời (ansimg03) | Bệnh án của mình (3106) | `view_medical_records` (3101) |
| Tạo đợt, danh sách `/my` (lesion02, lesion01) | Được | 3104 |
| Sửa/xoá đợt; tạo/sửa/xoá vị trí và ảnh tổn thương | Đợt của mình (3106), bệnh án chưa đóng (MT-92) | 3104 (MT-92) |
| Xem đợt, vị trí, ảnh tổn thương (lesion06, loc03, lphoto02, `record/:id`) | Của mình (3106) | `view_medical_records` (3101) |

## 6. Web (bác sĩ, trong trang chi tiết bệnh án)

- **Mục "Tổn thương da"** (`LesionPanel`):
  - danh sách đợt lấy từ `GET /lesion-episodes/record/:medical_record_id`: tên, thời điểm xuất hiện, thẻ bối cảnh (`Tag`), mô tả;
  - mở một đợt thì tải chi tiết (`GET /lesion-episodes/:id`: bối cảnh khác, thuốc qua `describeMedication`) và danh sách vị trí;
  - mỗi vị trí hiển thị ảnh của vị trí đó, chia 3 cột theo mốc "Khởi phát", "Đỉnh điểm", "Hồi phục". Mỗi ảnh có thời điểm chụp, điểm "Ngứa x/10 · Đau x/10 · Rát x/10" (chưa chấm thì hiện "–"), số nốt sẩn, AUAS cục bộ, và liên kết `annotated_url` nếu là URL http(s);
  - chưa có đợt nào: "Bệnh nhân chưa ghi nhận đợt tổn thương nào";
  - chỉ xem.
- **Ảnh câu trả lời trong `DynamicForm`:** với câu hỏi mà `questionAcceptsImages` trả true và đã có câu trả lời, hiển thị ảnh lấy từ `GET /answer-images/:answer_id`. Ảnh có `option_value` thì kèm nhãn `option_text` của lựa chọn tương ứng. Chỉ xem.
- **Hiển thị ảnh** (`AuthorizedImage`):
  - thẻ `<img>` không gửi được header, nên component dùng `fetch` kèm token tới `resolveMediaUrl(VITE_API_BASE_URL, file_url)`, tạo object URL, thu hồi khi unmount;
  - lỗi thì hiện ô "Không tải được ảnh";
  - xem ảnh lớn bằng `Image` (preview) của antd.
- **Lỗi API** hiển thị bằng `describeError`.

## 7. Mobile (bệnh nhân)

- **Thư viện:**
  - `expo-image-picker` (cài bằng `npx expo install`), khai báo lời xin quyền máy ảnh và thư viện ảnh bằng tiếng Việt trong `app.json`;
  - hiển thị ảnh bằng `expo-image` với `source.headers.Authorization`;
  - trước khi tải lên, kiểm tra bằng `checkImageFile` để báo lỗi ngay (định dạng, 5MB);
  - ảnh HEIC của iOS phải được chuyển sang JPEG khi chọn.
- **Tab "Tổn thương da":**
  - danh sách đợt từ `GET /lesion-episodes/my`;
  - gặp 4002: hiển thị "Bạn cần có bệnh án đang hoạt động để theo dõi tổn thương da" cùng nút "Tạo bệnh án";
  - nút "Ghi nhận đợt tổn thương";
  - kéo để làm mới.
- **Màn tạo/sửa đợt:**
  - chọn bệnh án trong số bệnh án đang hoạt động (`isRecordActiveForLesions`); chỉ có một thì tự chọn;
  - tên (bắt buộc);
  - ngày và giờ xuất hiện (ô chữ, mặc định là bây giờ, kiểm tra bằng `isValidLesionDateTime`);
  - thẻ bối cảnh: chip gợi ý lấy từ `LESION_CONTEXT_TAG_SUGGESTIONS` cộng ô thêm thẻ tự do (MT-94);
  - bối cảnh khác; tên thuốc; "dùng cách đây" gồm số và đơn vị; mô tả.
- **Màn chi tiết đợt:**
  - thông tin đợt, nút "Sửa" và "Xoá" (có xác nhận);
  - danh sách vị trí, mỗi vị trí có ảnh nhóm theo mốc (`groupPhotosByMilestone`) kèm điểm;
  - các nút "Thêm vị trí", "Sửa vị trí", "Xoá vị trí" (xác nhận: "Xoá vị trí sẽ xoá cả ảnh của vị trí này") và "Thêm ảnh";
  - bệnh án đã đóng thì chỉ xem.
- **Màn thêm/sửa ảnh tổn thương:**
  - bắt buộc gắn với một vị trí (MT-89);
  - nút "Chụp ảnh" và "Chọn từ thư viện", xem trước ảnh;
  - mốc: 3 nút lớn;
  - điểm ngứa, đau, rát: nút − / + từ 0 đến 10, có trạng thái "Chưa chấm";
  - số nốt sẩn và AUAS cục bộ: ô số;
  - thời điểm chụp: mặc định là bây giờ.
  - Gửi: `upload` (kèm `medical_record_id` của đợt), rồi `POST /lesion-photos`. Nếu bước sau lỗi thì giữ `attachment_id` để thử lại mà không phải tải lại ảnh.
  - Sửa: `PATCH /:id/milestone`. Xoá: có xác nhận.
- **Kho ảnh của tôi** (mở từ màn Hồ sơ):
  - lưới ảnh từ `GET /image-attachments/user/:user_id`, chạm để xem lớn;
  - xoá có xác nhận; gặp 2003 (409) thì báo "Ảnh đang được dùng cho ảnh tổn thương da. Hãy xoá ảnh tổn thương trước."
- **Ảnh trong phiếu khám:**
  - câu hỏi có `questionAcceptsImages` hiện ô "Thêm ảnh" (tối đa 10 ảnh mỗi lần); lựa chọn có `trigger_image_upload` đang được chọn hiện ô ảnh riêng cho `option_value` đó (`imageTriggerOptionValues`); câu `image_upload` bắt buộc phải có ít nhất 1 ảnh (`validateImageQuestions`).
  - Khi tạo bệnh án:
    1. Gửi `answers` kèm `imageAnswerPlaceholders` (MT-93).
    2. Lấy lại `GET /medical_records/:id/answers` để biết `answer_id`.
    3. Ảnh cấp câu hỏi: `upload-multiple` rồi `bulk`. Ảnh cấp lựa chọn: `upload` (kèm `medical_record_id`, `question_id`) rồi `POST /answer-images` với `option_value`.
    4. Một bước ảnh lỗi thì vẫn mở chi tiết bệnh án, kèm thông báo "Bệnh án đã được tạo nhưng một số ảnh chưa tải lên được. Vui lòng thêm lại ảnh."
- **Chi tiết bệnh án:**
  - ảnh câu trả lời; được thêm và gỡ khi `isPatientEditableStatus` (câu chưa có câu trả lời thì `PUT answers` với `{question_id}` trước);
  - mục "Tổn thương da" chỉ đọc qua `GET /lesion-episodes/record/:id`, chạm vào một đợt thì mở màn chi tiết đợt. Nhờ vậy bệnh nhân vẫn xem được đợt của bệnh án đã đóng (MT-87).
- **Quy ước chung:** chữ ≥ 18, nút ≥ 56px, có trạng thái loading, lỗi và thử lại; quyền máy ảnh/thư viện bị từ chối thì báo lỗi kèm nút "Mở cài đặt".

## 8. Kiểm thử

- **Unit test shared:** mọi hàm ở mục 4.8, với giá trị cụ thể nêu trong kế hoạch.
- **Unit test API** (repository và `ObjectStorage` được mock):
  - từng nhánh mã ở mục 4: 6001–6007, 7001–7007, 4001–4003, 4008, 4009, 4104, 3007, 3101, 3104, 3106, 2001, 2003 (400/404/409), 2006;
  - quyền theo mục 5;
  - nhận dạng chữ ký ảnh, khoá object, ánh xạ lỗi multer, MinIO lỗi giữa chừng (dọn object, rollback).
- **E2E (multer thật):** quá 5MB → 6003 (413); 11 tệp → 6004; thiếu tệp → 6001; tệp chữ đổi đuôi `.jpg` → 6002.
- **Test tích hợp `test:db`** (MySQL thật, `ObjectStorage` trong bộ nhớ):
  - bệnh nhân tải ảnh, gắn vào câu trả lời, bác sĩ xem được; gắn lại → 6006; chốt bệnh án rồi gắn → 4003;
  - xoá ảnh đang dùng cho ảnh tổn thương → 409; xoá ảnh chỉ gắn câu trả lời thì liên kết mất theo;
  - tạo đợt → vị trí → ảnh với điểm 11 → 7007; mốc sai → 7006;
  - xoá vị trí thì ảnh của vị trí mất; xoá đợt thì vị trí và ảnh mất, tệp vẫn còn;
  - bệnh nhân B xem đợt của A → 3106; bác sĩ có `view_medical_records` xem `record/:id`;
  - `/my` khi mọi bệnh án đã đóng → 4002;
  - xoá bệnh án còn đợt → 409; PUT answers giữ `answers.id` và ảnh.
- **MinIO thật:** `putObject`/`getObject`/`removeObject` trên bucket `<MINIO_BUCKET>-test`; tự bỏ qua khi thiếu `MINIO_*`.
- **Web:** Vitest + Testing Library, mock `fetch`.
- **Mobile:** typecheck, lint, `expo export`, `npx expo-doctor`; logic nằm ở shared và đã có test.
- **Hoàn thành khi:** lint, typecheck, test, test:e2e, test:db và build đều xanh; chạy thử bằng curl một vòng tải → xem → gắn → gỡ → xoá ảnh; cập nhật docs/05 (MT-80..MT-94) và docs/07.

## 9. MT mới

| Mã | Vấn đề | Cách làm tạm | Trạng thái |
|---|---|---|---|
| MT-80 | Cột FK hồ sơ của `lesion_episodes` trong tài liệu CSDL ghi `ma_ho_` (thiếu chữ, có sẵn như vậy trong bản docx gốc) | CSDL dev dùng `ma_ho_so` như các bảng khác | Chờ chốt (đối chiếu schema thật) |
| MT-81 | `media_attachments.question_id`: track change xoá chữ "(FK)" ở bảng cột, nhưng mục quan hệ và bảng FK vẫn ghi FK, SET NULL | CSDL dev giữ FK, SET NULL | Chờ chốt |
| MT-82 | Mã 6002 chỉ nhận jpg/png/webp, trong khi Sheet và CSDL có `media_type` image/video/audio; tab `view/:id` chỉ ghi image/png, image/jpeg | Chỉ nhận JPEG/PNG/WEBP (kiểm tra chữ ký tệp); `media_type` khác `image` → 6002 | Chờ chốt |
| MT-83 | Mã 6003 ghi "5MB/10MB", test case img01 lấy ví dụ "> 5MB"; không rõ khi nào áp dụng 10MB | 5MB mỗi tệp, cho cả `upload` và `upload-multiple` | Chờ chốt |
| MT-84 | Dạng của `file_url` ("URL có thể truy cập trực tiếp") và `file_path` ("đường dẫn lưu trữ nội bộ") không được quy định | `file_path` = khoá object; `file_url` = đường dẫn tương đối `/api/v1/image-attachments/view/:id`, client ghép với địa chỉ API. Không dùng URL MinIO hay presigned, vì thiết bị không truy cập được MinIO và URL presigned hết hạn mà vẫn nằm trong CSDL | Đề xuất |
| MT-85 | Tab `GET image-attachments/view/:id` không có header Authorization | Bắt buộc Bearer token và kiểm tra quyền (mục 5), vì ảnh y tế nhạy cảm và id tăng dần dễ đoán | Chờ chốt |
| MT-86 | `upload-multiple` bắt buộc `user_id` trong body (img01 lấy từ token); `total` mô tả "đã upload thành công" gợi ý có thể thành công một phần | `user_id` phải trùng người gọi (khác → 3106); thành công tất cả hoặc không có gì, `total` = số tệp | Đề xuất |
| MT-87 | "Bệnh án active" của lesion01 (4002) chưa được định nghĩa. Hệ quả: khi mọi bệnh án đã đóng, bệnh nhân không xem được đợt cũ qua `/my` | Active = trạng thái khác `completed`/`cancelled`. Khác MT-74, vì bệnh nhân cần ghi tổn thương được cả trước khi bác sĩ tiếp nhận. Đợt của bệnh án đã đóng xem qua `record/:id` | Chờ chốt |
| MT-88 | Tab `GET lesion-episodes/record/:medical_record_id`: `data` kiểu string; trường `id` (không phải `episode_id`); mô tả `name`, `context_tags`, `description` bị chép nhầm; mã "1001 hoặc 1000", message "Created successfully" | `data` là mảng; giữ tên `id` của tab; mã 1000 | Đề xuất |
| MT-89 | Ảnh tổn thương không gắn vị trí (`location_id` để trống) không có API nào liệt kê được, vì chỉ có API lấy theo vị trí; loc03 ghi "kèm ảnh" nhưng output không có ảnh | API vẫn nhận `location_id` trống theo Sheet; app luôn bắt chọn vị trí; client gọi lphoto02 cho từng vị trí | Chờ chốt |
| MT-90 | "1 đợt có 3 mốc khởi phát/đỉnh điểm/hồi phục" (track change ở mục 20) chưa rõ là ràng buộc hay chỉ là mô tả | Không giới hạn số ảnh mỗi mốc; giao diện nhóm ảnh theo mốc | Chờ chốt |
| MT-91 | Định dạng `occurred_at`/`taken_at`: Sheet chỉ có ví dụ "2026-04-24 10:30:00", CSDL ví dụ "10/05/2026 01:09 PM" | Nhận và trả `YYYY-MM-DD HH:mm:ss`, giờ Việt Nam không kèm múi giờ; sai → 2006 | Đề xuất |
| MT-92 | Ai được sửa/xoá dữ liệu tổn thương và khi nào bị khoá: tài liệu chỉ nói bệnh nhân tạo đợt; lesion03 chỉ chặn sửa đợt khi bệnh án `completed` | Chỉ bệnh nhân sở hữu được tạo/sửa/xoá đợt, vị trí, ảnh (nhân viên → 3104, chỉ xem). Mọi thao tác ghi bị chặn khi bệnh án `completed` (4003) hoặc `cancelled` (4009) | Đề xuất |
| MT-93 | Câu `image_upload` cần một bản ghi `answers` để có `answer_id` gắn ảnh, nhưng tài liệu không nói bản ghi này được tạo thế nào | Client gửi câu trả lời rỗng `{question_id}`; ảnh gắn qua answer-images | Đề xuất |
| MT-94 | Danh sách thẻ bối cảnh (`context_tags`) không được liệt kê | Nhập tự do; gợi ý lấy từ ví dụ của tài liệu ("Sau ăn", "Sau ăn hải sản", "Sau vận động") | Chờ chốt (bác sĩ) |
