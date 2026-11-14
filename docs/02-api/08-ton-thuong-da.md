# Phần 8: Quản lý Theo dõi Tổn thương da (Lesion Tracking)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE9_DrMayDay.pptx`; [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. Cột NN: `O` = bắt buộc, `X` = không bắt buộc.

### create_lesion_episode (lesion02) (input)

- Tab Sheet: [`POST /api/lesion-episodes/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1698376832)
- Đường dẫn ghi trong slide: `POST /api/v1/lesion-episodes`
- Ảnh slide 5: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API tạo đợt tổn thương mề đay mới:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực của Bệnh nhân |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `medical_record_id` | string | O | ID hồ sơ bệnh án chứa đợt tổn thương |
| 4 | `name` | string | O | Tên đợt tổn thương (VD: "Dạng 1 - Đùi trái") |
| 5 | `occurred_at` | string | X | Thời điểm xuất hiện (VD: "2026-04-24 10:30:00") |
| 6 | `context_tags` | string | X | Các thẻ bối cảnh truyền dạng chuỗi JSON (VD: "[\"sau ăn\"]") |
| 7 | `context_other` | string | X | Bối cảnh khác (nhập tự do) |
| 8 | `medication_name` | string | X | Tên thuốc đã dùng trước đó |
| 9 | `medication_taken_ago` | string | X | Khoảng thời gian đã dùng thuốc (VD: "2") |
| 10 | `medication_unit` | string | X | Đơn vị thời gian (VD: "hour", "day") |
| 11 | `description` | string | X | Mô tả chi tiết đợt tổn thương |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo đợt tổn thương thành công) |
| 3 | `data` | object | O | Chi tiết đợt tổn thương vừa tạo |
|  | ↳ `episode_id` | string | O | ID của đợt tổn thương |
|  | ↳ `medical_record_id` | string | O | ID hồ sơ bệnh án |
|  | ↳ `patient_id` | string | O | ID Bệnh nhân |
|  | ↳ `name` | string | O | Tên đợt tổn thương |
|  | ↳ `occurred_at` | string | X | Thời điểm xuất hiện |
|  | ↳ `context_tags` | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ `context_other` | string | X | Bối cảnh khác |
|  | ↳ `medication_name` | string | X | Tên thuốc |
|  | ↳ `medication_taken_ago` | string | X | Thời gian dùng thuốc trước đó |
|  | ↳ `medication_unit` | string | X | Đơn vị thời gian |
|  | ↳ `description` | string | X | Mô tả chi tiết |
|  | ↳ `created_at` | string | O | Thời điểm tạo bản ghi |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật bản ghi |

### create_lesion_episode (lesion02) (output)

- Tab Sheet: [`POST /api/lesion-episodes/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1698376832)
- Đường dẫn ghi trong slide: `POST /api/v1/lesion-episodes`
- Ảnh slide 6: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả lesion02

- API thực hiện việc khởi tạo một "Đợt bùng phát tổn thương" mới gắn với một hồ sơ bệnh án.
- Request dạng POST (/api/v1/lesion-episodes).
- Backend chú ý: Lưu dữ liệu vào bảng lesion_episodes. Cần tự động lấy ID của bệnh nhân đang đăng nhập gán vào cột patient_id.
- _(slide 7)_

#### Các test case cho lesion02

- Người dùng truyền thông tin đợt tổn thương hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully. Trả về thông tin đợt tổn thương vừa tạo kèm episode_id dạng string.
- Tên đợt tổn thương (name) bị bỏ trống.
- Kết quả mong đợi: Mã lỗi 7004 | Lesion name cannot be empty.
- _(slide 8)_

### get_my_lesion_episodes (lesion01)

- Tab Sheet: [`GET /api/lesion-episodes/my`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1440092550)
- Đường dẫn ghi trong slide: `GET /api/v1/lesion-episodes/my`
- Ảnh slide 9: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Bệnh nhân lấy danh sách đợt tổn thương của mình:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `medical_record_id` | string | X | (Query) Truyền ID bệnh án để lọc |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng chứa danh sách các đợt tổn thương |
|  | ↳ `episode_id` | string | O | ID của đợt tổn thương |
|  | ↳ `medical_record_id` | string | O | ID bệnh án liên quan |
|  | ↳ `patient_id` | string | O | ID Bệnh nhân |
|  | ↳ `name` | string | O | Tên đợt tổn thương |
|  | ↳ `occurred_at` | string | X | Thời điểm xuất hiện |
|  | ↳ `description` | string | X | Mô tả chi tiết đợt tổn thương |
|  | ↳ `created_at` | string | O | Thời điểm tạo |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật |

#### Mô tả lesion01

- API dùng cho Bệnh nhân lấy danh sách toàn bộ các đợt tổn thương do chính mình tạo ra.
- Request dạng GET (/api/v1/lesion-episodes/my).
- Backend chú ý: Truy vấn bảng lesion_episodes lọc theo patient_id lấy từ Token. Nếu bệnh án không tồn tại hoặc đã đóng, cần kiểm tra logic nghiệp vụ để trả về lỗi 4002 nếu cần.
- _(slide 10)_

#### Các test case cho lesion01

- Bệnh nhân có dữ liệu đợt tổn thương gọi API.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng danh sách đợt tổn thương của user đó.
- Người dùng chưa có bệnh án active.
- Kết quả mong đợi: Mã lỗi 4002 | Active medical record required.
- _(slide 11)_

### get_lesion_episode (lesion06)

- Tab Sheet: [`GET /api/lesion-episodes/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=227880350)
- Đường dẫn ghi trong slide: `GET /api/v1/lesion-episodes/:id`
- Ảnh slide 12: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Xem chi tiết đợt tổn thương:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | string | O | (Path) ID của đợt tổn thương (episode_id) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chi tiết đợt tổn thương |
|  | ↳ `episode_id` | string | O | ID của đợt tổn thương |
|  | ↳ `medical_record_id` | string | O | ID hồ sơ bệnh án |
|  | ↳ `patient_id` | string | O | ID Bệnh nhân |
|  | ↳ `name` | string | O | Tên đợt tổn thương |
|  | ↳ `occurred_at` | string | X | Thời điểm xuất hiện |
|  | ↳ `context_tags` | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ `context_other` | string | X | Bối cảnh khác |
|  | ↳ `medication_name` | string | X | Tên thuốc |
|  | ↳ `medication_taken_ago` | string | X | Thời gian dùng thuốc trước đó |
|  | ↳ `medication_unit` | string | X | Đơn vị thời gian |
|  | ↳ `description` | string | X | Mô tả chi tiết |
|  | ↳ `created_at` | string | O | Thời điểm tạo bản ghi |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật bản ghi |

#### Mô tả lesion06

- API truy xuất chi tiết một Đợt tổn thương cụ thể bằng ID.
- Request dạng GET (/api/v1/lesion-episodes/:id).
- Backend chú ý: Lấy 1 bản ghi duy nhất từ bảng lesion_episodes.
- _(slide 13)_

#### Các test case cho lesion06

- Truyền một episode_id tồn tại trong hệ thống.
- Kết quả mong đợi: Mã 1000 | OK. Trả về object chi tiết.
- Truyền một episode_id không tồn tại.
- Kết quả mong đợi: Mã lỗi 7001 | Lesion episode not found.
- _(slide 14)_

### edit_lesion_episode (lesion03) (input)

- Tab Sheet: [`PATCH /api/lesion-episodes/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=792934479)
- Đường dẫn ghi trong slide: `PATCH /api/v1/lesion-episodes/:id`
- Ảnh slide 15: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Cập nhật thông tin đợt tổn thương:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | string | O | (Path) ID của đợt tổn thương |
| 4 | `name` | string | X | Cập nhật tên đợt tổn thương |
| 5 | `occurred_at` | string | X | Cập nhật thời điểm xuất hiện |
| 6 | `context_tags` | string | X | Cập nhật thẻ bối cảnh (Chuỗi JSON) |
| 7 | `context_other` | string | X | Cập nhật bối cảnh khác |
| 8 | `description` | string | X | Cập nhật mô tả |
| 9 | `medication_name` | string | X | Cập nhật tên thuốc |
| 10 | `medication_taken_ago` | string | X | Cập nhật thời gian dùng thuốc |
| 11 | `medication_unit` | string | X | Cập nhật đơn vị thời gian |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Cập nhật thành công) |
| 3 | `data` | object | O | Chi tiết đợt tổn thương sau khi cập nhật |
|  | ↳ `episode_id` | string | O | ID của đợt tổn thương |
|  | ↳ `medical_record_id` | string | O | ID hồ sơ bệnh án |
|  | ↳ `patient_id` | string | O | ID Bệnh nhân |
|  | ↳ `name` | string | O | Tên đợt tổn thương |
|  | ↳ `occurred_at` | string | X | Thời điểm xuất hiện |
|  | ↳ `context_tags` | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ `context_other` | string | X | Bối cảnh khác |
|  | ↳ `medication_name` | string | X | Tên thuốc |
|  | ↳ `medication_taken_ago` | string | X | Thời gian dùng thuốc trước đó |
|  | ↳ `medication_unit` | string | X | Đơn vị thời gian |
|  | ↳ `description` | string | X | Mô tả chi tiết |
|  | ↳ `created_at` | string | O | Thời điểm tạo bản ghi |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật bản ghi |

### edit_lesion_episode (lesion03) (output)

- Tab Sheet: [`PATCH /api/lesion-episodes/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=792934479)
- Đường dẫn ghi trong slide: `PATCH /api/v1/lesion-episodes/:id`
- Ảnh slide 16: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả lesion03

- API cho phép cập nhật thông tin của một Đợt tổn thương đã tạo.
- Request dạng PATCH (/api/v1/lesion-episodes/:id).
- Backend chú ý: Cập nhật bản ghi trong bảng lesion_episodes dựa vào episode_id. Không được phép sửa khi bệnh án đã chuyển trạng thái completed.
- _(slide 17)_

#### Các test case cho lesion03

- Cập nhật thông tin thành công.
- Kết quả mong đợi: Mã 1000 | OK. Trả về thông tin đợt tổn thương mới.
- Cập nhật khi bệnh án đã đóng.
- Kết quả mong đợi: Mã lỗi 4003 | Medical record already completed.
- _(slide 18)_

### delete_lesion_episode (lesion04)

- Tab Sheet: [`DELETE /api/lesion-episodes/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1806694438)
- Đường dẫn ghi trong slide: `DELETE /api/v1/lesion-episodes/:id`
- Ảnh slide 19: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API xóa thông tin đợt tổn thương:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | string | O | (Path) ID của đợt tổn thương cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả lesion04

- API xóa bỏ hoàn toàn một Đợt tổn thương.
- Request dạng DELETE (/api/v1/lesion-episodes/:id).
- Backend chú ý: Việc xóa bản ghi cha lesion_episodes sẽ kích hoạt xóa dây chuyền xuống bảng con lesion_locations và lesion_photos do cài đặt CASCADE (hoặc bị chặn bởi RESTRICT) tại DB.
- _(slide 20)_

#### Các test case cho lesion04

- Thực hiện xóa một đợt tổn thương hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Đợt tổn thương bị xóa khỏi hệ thống.
- _(slide 21)_

### create_lesion_location (loc01) (input)

- Tab Sheet: [`POST /api/lesion-locations/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=379040218)
- Đường dẫn ghi trong slide: `POST /api/v1/lesion-locations`
- Ảnh slide 23: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API tạo vị trí tổn thương theo đợt:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `episode_id` | string | O | ID của đợt tổn thương chứa vị trí này |
| 4 | `body_part` | string | O | Vị trí cơ thể (VD: "Cánh tay phải") |
| 5 | `occurred_at` | string | X | Thời điểm xuất hiện tại vị trí này |
| 6 | `context_tags` | string | X | Thẻ bối cảnh (Chuỗi JSON) |
| 7 | `context_other` | string | X | Bối cảnh khác |
| 8 | `medication_name` | string | X | Tên thuốc liên quan |
| 9 | `medication_taken_ago` | string | X | Khoảng thời gian đã dùng thuốc |
| 10 | `medication_unit` | string | X | Đơn vị thời gian |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo vị trí thành công) |
| 3 | `data` | object | O | Chi tiết vị trí tổn thương vừa tạo |
|  | ↳ `lesion_location_id` | string | O | ID của vị trí tổn thương |
|  | ↳ `episode_id` | string | O | ID đợt tổn thương |
|  | ↳ `body_part` | string | O | Vị trí cơ thể |
|  | ↳ `occurred_at` | string | X | Thời điểm xuất hiện |
|  | ↳ `context_tags` | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ `context_other` | string | X | Bối cảnh khác |
|  | ↳ `medication_name` | string | X | Tên thuốc |
|  | ↳ `medication_taken_ago` | string | X | Thời gian dùng thuốc |
|  | ↳ `medication_unit` | string | X | Đơn vị thời gian |
|  | ↳ `created_at` | string | O | Thời điểm tạo bản ghi |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật bản ghi |

### create_lesion_location (loc01) (output)

- Tab Sheet: [`POST /api/lesion-locations/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=379040218)
- Đường dẫn ghi trong slide: `POST /api/v1/lesion-locations`
- Ảnh slide 24: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả loc01

- API ghi nhận một vị trí cụ thể (VD: Cánh tay phải, Đùi trái) xuất hiện mảng mề đay, trực thuộc một đợt tổn thương.
- Request dạng POST (/api/v1/lesion-locations).
- Backend chú ý: Dữ liệu insert vào bảng lesion_locations.
- _(slide 25)_

#### Các test case cho loc01

- Gửi thông tin vị trí đầy đủ.
- Kết quả mong đợi: Mã 1001 | Created successfully.
- Bỏ trống tên vị trí cơ thể (body_part).
- Kết quả mong đợi: Mã lỗi 7005 | Body part cannot be empty.
- _(slide 26)_

### get_lesion_locations_by_episode (loc03)

- Tab Sheet: [`GET /api/lesion-locations/episode/:episode_id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=551441164)
- Đường dẫn ghi trong slide: `GET /api/v1/lesion-locations/episode/:episode_id`
- Ảnh slide 27: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API lấy danh sách vị trí tổn thương kèm ảnh:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `episode_id` | string | O | (Path) ID của đợt tổn thương |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng chứa danh sách các vị trí tổn thương |
|  | ↳ `lesion_location_id` | string | O | ID vị trí tổn thương |
|  | ↳ `episode_id` | string | O | ID đợt tổn thương |
|  | ↳ `body_part` | string | O | Vị trí cơ thể |
|  | ↳ `occurred_at` | string | X | Thời gian xuất hiện |
|  | ↳ `context_tags` | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ `context_other` | string | X | Bối cảnh khác |
|  | ↳ `medication_name` | string | X | Tên thuốc |
|  | ↳ `medication_taken_ago` | string | X | Thời gian dùng thuốc |
|  | ↳ `medication_unit` | string | X | Đơn vị thời gian |
|  | ↳ `created_at` | string | O | Thời điểm tạo bản ghi |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật bản ghi |

#### Mô tả loc03

- API truy xuất danh sách các vị trí tổn thương thuộc một đợt tổn thương cụ thể.
- Request dạng GET (/api/v1/lesion-locations/episode/:episode_id).
- Backend chú ý: Query bảng lesion_locations lọc theo episode_id.
- _(slide 28)_

#### Các test case cho lesion01

- Truyền ID đợt tổn thương có chứa các vị trí.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng danh sách vị trí.
- ⚠ Tiêu đề slide ghi "lesion01" nhưng nội dung là test case của loc03.
- _(slide 29)_

### edit_lesion_location (loc04) (input)

- Tab Sheet: [`PATCH /api/lesion-locations/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=384461718)
- Đường dẫn ghi trong slide: `PATCH /api/v1/lesion-locations/:id`
- Ảnh slide 30: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API cập nhật danh sách vị trí tổn thương kèm ảnh:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | string | O | (Path) ID của vị trí tổn thương |
| 4 | `body_part` | string | X | Cập nhật tên vị trí cơ thể |
| 5 | `occurred_at` | string | X | Cập nhật thời điểm |
| 6 | `context_tags` | string | X | Cập nhật thẻ bối cảnh |
| 7 | `context_other` | string | X | Cập nhật bối cảnh khác |
| 8 | `medication_name` | string | X | Cập nhật tên thuốc |
| 9 | `medication_taken_ago` | string | X | Cập nhật thời gian dùng thuốc |
| 10 | `medication_unit` | string | X | Cập nhật đơn vị thời gian |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Cập nhật thành công) |
| 3 | `data` | object | O | Chi tiết vị trí tổn thương sau khi cập nhật |
|  | ↳ `lesion_location_id` | string | O | ID của vị trí tổn thương |
|  | ↳ `episode_id` | string | O | ID đợt tổn thương |
|  | ↳ `body_part` | string | O | Vị trí cơ thể |
|  | ↳ `occurred_at` | string | X | Thời gian xuất hiện |
|  | ↳ `context_tags` | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ `context_other` | string | X | Bối cảnh khác |
|  | ↳ `medication_name` | string | X | Tên thuốc |
|  | ↳ `medication_taken_ago` | string | X | Thời gian dùng thuốc |
|  | ↳ `medication_unit` | string | X | Đơn vị thời gian |
|  | ↳ `created_at` | string | O | Thời điểm tạo bản ghi |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật bản ghi |

### edit_lesion_location (loc04) (output)

- Tab Sheet: [`PATCH /api/lesion-locations/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=384461718)
- Đường dẫn ghi trong slide: `PATCH /api/v1/lesion-locations/:id`
- Ảnh slide 31: Ảnh slide output trùng ảnh slide input (ảnh input đã gồm cả bảng Output).

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả loc04

- API cập nhật thông tin chi tiết của một vị trí tổn thương đã lưu.
- Request dạng PATCH (/api/v1/lesion-locations/:id).
- Backend chú ý: Update bản ghi trong bảng lesion_locations.
- _(slide 32)_

#### Các test case cho loc04

- Gửi yêu cầu cập nhật hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trả về object vị trí đã cập nhật.
- _(slide 33)_

### delete_lesion_location (loc05)

- Tab Sheet: [`DELETE /api/lesion-locations/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=2123167729)
- Đường dẫn ghi trong slide: `DELETE /api/v1/lesion-locations/:id`
- Ảnh slide 34: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API lấy xóa vị trí tổn thương:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | string | O | (Path) ID của vị trí cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả loc05

- API xóa một vị trí tổn thương khỏi đợt bùng phát.
- Request dạng DELETE (/api/v1/lesion-locations/:id).
- _(slide 35)_

#### Các test case cho loc05

- Gửi yêu cầu xóa.
- Kết quả mong đợi: Mã 1000 | OK.
- _(slide 36)_

### set_lesion_photos (lphoto01) (input)

- Tab Sheet: [`POST /api/lesion-photos/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=2112749323)
- Đường dẫn ghi trong slide: `POST /api/v1/lesion-photos`
- Ảnh slide 38: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Tải ảnh tổn thương kèm chấm điểm triệu chứng

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `episode_id` | string | O | ID đợt tổn thương chứa ảnh |
| 4 | `location_id` | string | X | ID vị trí tổn thương cụ thể |
| 5 | `attachment_id` | string | O | ID tệp ảnh gốc lấy từ media_attachments |
| 6 | `taken_at` | string | X | Thời điểm chụp ảnh |
| 7 | `milestone` | string | O | Mốc tiến triển (VD: "start", "peak", "normal") |
| 8 | `itch_score` | string | X | Điểm mức độ ngứa (VD: "5") |
| 9 | `pain_score` | string | X | Điểm mức độ đau (VD: "3") |
| 10 | `burn_score` | string | X | Điểm mức độ rát |
| 11 | `hives_count` | string | X | Số lượng nốt sẩn đếm được |
| 12 | `local_auas` | string | X | Chỉ số AUAS cục bộ |
| 13 | `annotated_url` | string | X | URL ảnh đã được AI chú thích (nếu có) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Lưu ảnh thành công) |
| 3 | `data` | object | O | Chi tiết bản ghi ảnh tổn thương vừa tạo |
|  | ↳ `photo_id` | string | O | ID bản ghi ảnh tổn thương |
|  | ↳ `episode_id` | string | O | ID đợt tổn thương |
|  | ↳ `location_id` | string | X | ID vị trí tổn thương |
|  | ↳ `attachment_id` | string | O | ID tệp gốc |
|  | ↳ `taken_at` | string | X | Thời điểm chụp |
|  | ↳ `milestone` | string | O | Mốc tiến triển |
|  | ↳ `itch_score` | string | X | Điểm ngứa |
|  | ↳ `pain_score` | string | X | Điểm đau |
|  | ↳ `burn_score` | string | X | Điểm rát |
|  | ↳ `hives_count` | string | X | Số lượng sẩn |
|  | ↳ `local_auas` | string | X | Chỉ số AUAS |
|  | ↳ `annotated_url` | string | X | URL ảnh chú thích |
|  | ↳ `created_at` | string | O | Thời điểm tạo bản ghi |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật bản ghi |

### set_lesion_photos (lphoto01) (output)

- Tab Sheet: [`POST /api/lesion-photos/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=2112749323)
- Đường dẫn ghi trong slide: `POST /api/v1/lesion-photos`
- Ảnh slide 39: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả loc01

- API cực kỳ quan trọng dùng để lưu trữ ảnh chụp tổn thương theo từng mốc tiến triển, kèm theo điểm số lâm sàng.
- Request dạng POST (/api/v1/lesion-photos).
- Backend chú ý: Lưu dữ liệu vào bảng lesion_photos. Ảnh phải được tải lên kho media_attachments trước để lấy attachment_id.
- ⚠ Tiêu đề slide ghi "loc01" nhưng nội dung mô tả lphoto01 (POST /api/v1/lesion-photos).
- _(slide 40)_

#### Các test case cho loc01

- Tạo bản ghi ảnh với các điểm số trong giới hạn (0-10) và milestone hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully.
- Điểm triệu chứng (itch/pain/burn) nằm ngoài thang điểm 0-10.
- Kết quả mong đợi: Mã lỗi 7007 | Symptom score out of range.
- Truyền sai định dạng milestone (Không phải start/peak/normal).
- Kết quả mong đợi: Mã lỗi 7006 | Invalid milestone value.
- ⚠ Tiêu đề slide ghi "loc01" nhưng nội dung là test case của lphoto01.
- _(slide 41)_

### get_lesion_photos_by_location (lphoto02)

- Tab Sheet: [`GET /api/lesion-photos/location/:location_id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=692505516)
- Đường dẫn ghi trong slide: `(slide chép nhầm mô tả của loc03: GET /api/v1/lesion-locations/episode/:episode_id)`
- Ảnh slide 42: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Lấy danh sách ảnh tổn thương theo vị trí

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `location_id` | string | O | (Path) ID của vị trí tổn thương |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng chứa danh sách các bản ghi ảnh tổn thương |
|  | ↳ `photo_id` | string | O | ID bản ghi ảnh tổn thương |
|  | ↳ `episode_id` | string | O | ID đợt tổn thương |
|  | ↳ `location_id` | string | X | ID vị trí tổn thương |
|  | ↳ `attachment_id` | string | O | ID tệp gốc |
|  | ↳ `taken_at` | string | X | Thời điểm chụp |
|  | ↳ `milestone` | string | O | Mốc tiến triển |
|  | ↳ `itch_score` | string | X | Điểm ngứa |
|  | ↳ `pain_score` | string | X | Điểm đau |
|  | ↳ `burn_score` | string | X | Điểm rát |
|  | ↳ `hives_count` | string | X | Số lượng sẩn |
|  | ↳ `local_auas` | string | X | Chỉ số AUAS |
|  | ↳ `annotated_url` | string | X | URL ảnh chú thích |
|  | ↳ `created_at` | string | O | Thời điểm tạo |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật |
|  | ↳ `attachment` | object | O | Object chứa thông tin file ảnh thật (Join từ media_attachments) |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `attachment_id` | string | O | ID file ảnh gốc |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `file_url` | string | O | URL hiển thị ảnh |

#### Mô tả lphoto02

- API truy xuất danh sách các vị trí tổn thương thuộc một đợt tổn thương cụ thể.
- Request dạng GET (/api/v1/lesion-locations/episode/:episode_id).
- Backend chú ý: Query bảng lesion_locations lọc theo episode_id.
- ⚠ Nội dung slide chép nhầm từ mô tả loc03; theo Sheet, lphoto02 là GET /api/lesion-photos/location/:location_id.
- _(slide 43)_

#### Các test case cho lphoto02

- Truyền ID vị trí hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trả về danh sách ảnh.
- _(slide 44)_

### edit_lesion_photo_milestone (lphoto03) (input)

- Tab Sheet: [`PATCH /api/lesion-photos/:id/milestone`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1813402795)
- Đường dẫn ghi trong slide: `PATCH /api/v1/lesion-photos/:id/milestone`
- Ảnh slide 45: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Cập nhật mốc giai đoạn ảnh tổn thương

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | string | O | (Path) ID của bản ghi ảnh tổn thương (photo_id) |
| 4 | `milestone` | string | X | Cập nhật mốc tiến triển |
| 5 | `itch_score` | string | X | Cập nhật điểm ngứa |
| 6 | `pain_score` | string | X | Cập nhật điểm đau |
| 7 | `burn_score` | string | X | Cập nhật điểm rát |
| 8 | `hives_count` | string | X | Cập nhật số lượng sẩn |
| 9 | `local_auas` | string | X | Cập nhật chỉ số AUAS |
| 10 | `annotated_url` | string | X | Cập nhật URL ảnh chú thích |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Cập nhật thành công) |
| 3 | `data` | object | O | Chi tiết bản ghi ảnh sau cập nhật |
|  | ↳ `photo_id` | string | O | ID bản ghi ảnh tổn thương |
|  | ↳ `episode_id` | string | O | ID đợt tổn thương |
|  | ↳ `location_id` | string | X | ID vị trí tổn thương |
|  | ↳ `attachment_id` | string | O | ID tệp gốc |
|  | ↳ `taken_at` | string | X | Thời điểm chụp |
|  | ↳ `milestone` | string | O | Mốc tiến triển |
|  | ↳ `itch_score` | string | X | Điểm ngứa |
|  | ↳ `pain_score` | string | X | Điểm đau |
|  | ↳ `burn_score` | string | X | Điểm rát |
|  | ↳ `hives_count` | string | X | Số lượng sẩn |
|  | ↳ `local_auas` | string | X | Chỉ số AUAS |
|  | ↳ `annotated_url` | string | X | URL ảnh chú thích |
|  | ↳ `created_at` | string | O | Thời điểm tạo bản ghi |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật bản ghi |

### edit_lesion_photo_milestone (lphoto03) (output)

- Tab Sheet: [`PATCH /api/lesion-photos/:id/milestone`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1813402795)
- Đường dẫn ghi trong slide: `PATCH /api/v1/lesion-photos/:id/milestone`
- Ảnh slide 46: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả lphoto03

- API chuyên biệt dùng để cập nhật lại nhãn/mốc thời gian tiến triển của một bức ảnh (ví dụ đổi từ start thành peak).
- Request dạng PATCH (/api/v1/lesion-photos/:id/milestone).
- _(slide 47)_

#### Các test case cho lphoto03

- Cập nhật milestone thành công.
- Kết quả mong đợi: Mã 1000 | OK. Trả về thông tin ảnh đã update.
- _(slide 48)_

### delete_lesion_photo (lphoto04)

- Tab Sheet: [`DELETE /api/lesion-photos/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=822409679)
- Đường dẫn ghi trong slide: `DELETE /api/v1/lesion-photos/:id`
- Ảnh slide 49: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Cập nhật mốc giai đoạn ảnh tổn thương

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | string | O | (Path) ID bản ghi ảnh tổn thương cần xóa (photo_id) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa ảnh tổn thương thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả lphoto04

- API xóa một bản ghi ảnh khỏi quá trình theo dõi tổn thương.
- Request dạng DELETE (/api/v1/lesion-photos/:id).
- Backend chú ý: Xóa bản ghi trong lesion_photos.
- _(slide 50)_

#### Các test case cho loc05

- Xóa bản ghi ảnh thành công.
- Kết quả mong đợi: Mã 1000 | OK.
- ⚠ Tiêu đề slide ghi "loc05" nhưng nội dung là test case của lphoto04.
- _(slide 51)_

## API có trong Sheet nhưng không có slide

### GET /api/lesion-episodes/record/:medical_record_id

- Tab Sheet: [`GET /api/lesion-episodes/record/:medical_record_id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1269227558)

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Bệnh nhân lấy danh sách đợt tổn thương của mình:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | Header truyền Bearer Token của Admin |
| 2 | `medical_record_id` | string | O | ID hồ sơ bệnh án cần tra cứu danh sách tổn thương |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi hệ thống (1001 hoặc 1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `data` | string | O | Danh sách đợt tổn thương |
|  | ↳ `id` | string | O | ID đợt tổn thương |
|  | ↳ `medical_record_id` | string | O | ID bệnh án liên kết |
|  | ↳ `name` | string | O | Tên vị trí cơ thể (VD: Cánh tay phải, Lưng, Bụng) |
|  | ↳ `occurred_at` | string | X | Thời điểm xuất hiện tổn thương tại vị trí này |
|  | ↳ `context_tags` | string | X | Thời gian tạo bản ghi |
|  | ↳ `description` | string | X | ID vị trí tổn thương |
