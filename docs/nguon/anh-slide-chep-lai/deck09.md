> Bản chép lại nội dung ảnh bảng API trong slide (tai-lieu-goc/), do AI đọc ảnh ngày 2026-11-14 và đối chiếu với Sheet API.
> Dùng để tra cứu nhanh; khi cần chính xác tuyệt đối hãy mở ảnh gốc trong slide.

# Transcript deck09 (Lesion episodes / locations / photos)

Ghi chú chung:
- Không ảnh nào hiển thị HTTP method / path. Tất cả là screenshot Google Sheet (bảng NO | Tên parameter | Type | NN | Mô tả).
- Một số tên tham số bị cắt do độ rộng cột (ghi lại nguyên trạng, kèm tên đầy đủ suy ra trong ngoặc vuông).
- Ký hiệu "↳" = dòng con lồng trong `data`.

---

## deck09/s05_1.png — create_lesion_episode (lesion02) (input)
Method/path: (không hiển thị) — tab sheet tương ứng: `POST apilesion-episodes`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API tạo đợt tổn thương mề đay mới:"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực của Bệnh nhân |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | medical_record_id | string | O | ID hồ sơ bệnh án chứa đợt tổn thương |
| 4 | name | string | O | Tên đợt tổn thương (VD: "Dạng 1 - Đùi trái") |
| 5 | occurred_at | string | X | Thời điểm xuất hiện (VD: "2026-04-24 10:30:00") |
| 6 | context_tags | string | X | Các thẻ bối cảnh truyền dạng chuỗi JSON (VD: "[\"sau ăn\"]") |
| 7 | context_other | string | X | Bối cảnh khác (nhập tự do) |
| 8 | medication_name | string | X | Tên thuốc đã dùng trước đó |
| 9 | medication_taken_ag [medication_taken_ago] | string | X | Khoảng thời gian đã dùng thuốc (VD: "2") |
| 10 | medication_unit | string | X | Đơn vị thời gian (VD: "hour", "day") |
| 11 | description | string | X | Mô tả chi tiết đợt tổn thương |

---

## deck09/s06_1.png — create_lesion_episode (lesion02) (output)
Method/path: (không hiển thị) — tab: `POST apilesion-episodes`

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1001: Thành công) |
| 2 | message | string | O | Thông báo (Tạo đợt tổn thương thành công) |
| 3 | data | object | O | Chi tiết đợt tổn thương vừa tạo |
|  | ↳ episode_id | string | O | ID của đợt tổn thương |
|  | ↳ medical_record_id | string | O | ID hồ sơ bệnh án |
|  | ↳ patient_id | string | O | ID Bệnh nhân |
|  | ↳ name | string | O | Tên đợt tổn thương |
|  | ↳ occurred_at | string | X | Thời điểm xuất hiện |
|  | ↳ context_tags | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ context_other | string | X | Bối cảnh khác |
|  | ↳ medication_name | string | X | Tên thuốc |
|  | ↳ medication_taken_a [medication_taken_ago] | string | X | Thời gian dùng thuốc trước đó |
|  | ↳ medication_unit | string | X | Đơn vị thời gian |
|  | ↳ description | string | X | Mô tả chi tiết |
|  | ↳ created_at | string | O | Thời điểm tạo bản ghi |
|  | ↳ updated_at | string | O | Thời điểm cập nhật bản ghi |

---

## deck09/s09_1.png — get_my_lesion_episodes (lesion01)
Method/path: (không hiển thị) — tab: `GET apilesion-episodesmy`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API Bệnh nhân lấy danh sách đợt tổn thương của mình:"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | medical_record_ [medical_record_id] | string | X | (Query) Truyền ID bệnh án để lọc |

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo kết quả |
| 3 | data | array | O | Mảng chứa danh sách các đợt tổn thương |
|  | ↳ episode_id | string | O | ID của đợt tổn thương |
|  | ↳ medical_recor [medical_record_id] | string | O | ID bệnh án liên quan |
|  | ↳ patient_id | string | O | ID Bệnh nhân |
|  | ↳ name | string | O | Tên đợt tổn thương |
|  | ↳ occurred_at | string | X | Thời điểm xuất hiện |
|  | ↳ description | string | X | Mô tả chi tiết đợt tổn thương |
|  | ↳ created_at | string | O | Thời điểm tạo |
|  | ↳ updated_at | string | O | Thời điểm cập nhật |

---

## deck09/s12_1.png — get_lesion_episode (lesion06)
Method/path: (không hiển thị) — tab: `GET apilesion-episodesid`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API Xem chi tiết đợt tổn thương:"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | id | string | O | (Path) ID của đợt tổn thương (episode_id) |

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo kết quả |
| 3 | data | object | O | Chi tiết đợt tổn thương |
|  | ↳ episode_id | string | O | ID của đợt tổn thương |
|  | ↳ medical_record_id | string | O | ID hồ sơ bệnh án |
|  | ↳ patient_id | string | O | ID Bệnh nhân |
|  | ↳ name | string | O | Tên đợt tổn thương |
|  | ↳ occurred_at | string | X | Thời điểm xuất hiện |
|  | ↳ context_tags | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ context_other | string | X | Bối cảnh khác |
|  | ↳ medication_name | string | X | Tên thuốc |
|  | ↳ medication_taken_a [medication_taken_ago] | string | X | Thời gian dùng thuốc trước đó |
|  | ↳ medication_unit | string | X | Đơn vị thời gian |
|  | ↳ description | string | X | Mô tả chi tiết |
|  | ↳ created_at | string | O | Thời điểm tạo bản ghi |
|  | ↳ updated_at | string | O | Thời điểm cập nhật bản ghi |

---

## deck09/s15_1.png — edit_lesion_episode (lesion03) (input)
Method/path: (không hiển thị) — tab: `PATCH apilesion-episodesid`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API Cập nhật thông tin đợt tổn thương:"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | id | string | O | (Path) ID của đợt tổn thương |
| 4 | name | string | X | Cập nhật tên đợt tổn thương |
| 5 | occurred_at | string | X | Cập nhật thời điểm xuất hiện |
| 6 | context_tags | string | X | Cập nhật thẻ bối cảnh (Chuỗi JSON) |
| 7 | context_other | string | X | Cập nhật bối cảnh khác |
| 8 | description | string | X | Cập nhật mô tả |
| 9 | medication_nam [medication_name] | string | X | Cập nhật tên thuốc |
| 10 | medication_take [medication_taken_ago] | string | X | Cập nhật thời gian dùng thuốc |
| 11 | medication_unit | string | X | Cập nhật đơn vị thời gian |

---

## deck09/s16_1.png — edit_lesion_episode (lesion03) (output)
Method/path: (không hiển thị) — tab: `PATCH apilesion-episodesid`

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Cập nhật thành công) |
| 3 | data | object | O | Chi tiết đợt tổn thương sau khi cập nhật |
|  | ↳ episode_id | string | O | ID của đợt tổn thương |
|  | ↳ medical_recor [medical_record_id] | string | O | ID hồ sơ bệnh án |
|  | ↳ patient_id | string | O | ID Bệnh nhân |
|  | ↳ name | string | O | Tên đợt tổn thương |
|  | ↳ occurred_at | string | X | Thời điểm xuất hiện |
|  | ↳ context_tags | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ context_other | string | X | Bối cảnh khác |
|  | ↳ medication_na [medication_name] | string | X | Tên thuốc |
|  | ↳ medication_ta [medication_taken_ago] | string | X | Thời gian dùng thuốc trước đó |
|  | ↳ medication_ur [medication_unit] | string | X | Đơn vị thời gian |
|  | ↳ description | string | X | Mô tả chi tiết |
|  | ↳ created_at | string | O | Thời điểm tạo bản ghi |
|  | ↳ updated_at | string | O | Thời điểm cập nhật bản ghi |

---

## deck09/s19_1.png — delete_lesion_episode (lesion04)
Method/path: (không hiển thị) — tab: `DELETE apilesion-episodesid`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API xóa thông tin đợt tổn thương:"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | id | string | O | (Path) ID của đợt tổn thương cần xóa |

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Xóa thành công) |
| 3 | data | object | X | Object rỗng {} |

---

## deck09/s23_1.png — create_lesion_location (loc01) (input)
Method/path: (không hiển thị) — tab: `POST apilesion-locations`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API tạo vị trí tổn thương theo đợt:"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | episode_id | string | O | ID của đợt tổn thương chứa vị trí này |
| 4 | body_part | string | O | Vị trí cơ thể (VD: "Cánh tay phải") |
| 5 | occurred_at | string | X | Thời điểm xuất hiện tại vị trí này |
| 6 | context_tags | string | X | Thẻ bối cảnh (Chuỗi JSON) |
| 7 | context_other | string | X | Bối cảnh khác |
| 8 | medication_nam [medication_name] | string | X | Tên thuốc liên quan |
| 9 | medication_take [medication_taken_ago] | string | X | Khoảng thời gian đã dùng thuốc |
| 10 | medication_unit | string | X | Đơn vị thời gian |

---

## deck09/s24_1.png — create_lesion_location (loc01) (output)
Method/path: (không hiển thị) — tab: `POST apilesion-locations`

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1001: Thành công) |
| 2 | message | string | O | Thông báo (Tạo vị trí thành công) |
| 3 | data | object | O | Chi tiết vị trí tổn thương vừa tạo |
|  | ↳ lesion_location [lesion_location_id] | string | O | ID của vị trí tổn thương |
|  | ↳ episode_id | string | O | ID đợt tổn thương |
|  | ↳ body_part | string | O | Vị trí cơ thể |
|  | ↳ occurred_at | string | X | Thời điểm xuất hiện |
|  | ↳ context_tags | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ context_other | string | X | Bối cảnh khác |
|  | ↳ medication_na [medication_name] | string | X | Tên thuốc |
|  | ↳ medication_ta [medication_taken_ago] | string | X | Thời gian dùng thuốc |
|  | ↳ medication_un [medication_unit] | string | X | Đơn vị thời gian |
|  | ↳ created_at | string | O | Thời điểm tạo bản ghi |
|  | ↳ updated_at | string | O | Thời điểm cập nhật bản ghi |

---

## deck09/s27_1.png — get_lesion_locations_by_episode (loc03)
Method/path: (không hiển thị) — tab: `GET apilesion-locationsepisodee`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API lấy danh sách vị trí tổn thương kèm ảnh:"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | episode_id | string | O | (Path) ID của đợt tổn thương |

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo kết quả |
| 3 | data | array | O | Mảng chứa danh sách các vị trí tổn thương |
|  | ↳ lesion_location [lesion_location_id] | string | O | ID vị trí tổn thương |
|  | ↳ episode_id | string | O | ID đợt tổn thương |
|  | ↳ body_part | string | O | Vị trí cơ thể |
|  | ↳ occurred_at | string | X | Thời gian xuất hiện |
|  | ↳ context_tags | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ context_other | string | X | Bối cảnh khác |
|  | ↳ medication_na [medication_name] | string | X | Tên thuốc |
|  | ↳ medication_ta [medication_taken_ago] | string | X | Thời gian dùng thuốc |
|  | ↳ medication_ur [medication_unit] | string | X | Đơn vị thời gian |
|  | ↳ created_at | string | O | Thời điểm tạo bản ghi |
|  | ↳ updated_at | string | O | Thời điểm cập nhật bản ghi |

(Không có trường ảnh nào trong output dù tiêu đề ghi "kèm ảnh".)

---

## deck09/s30_1.png — edit_lesion_location (loc04) (input) — ảnh chứa cả Input và Output
Method/path: (không hiển thị) — tab: `PATCH apilesion-locationsid`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API cập nhật danh sách vị trí tổn thương kèm ảnh:"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | id | string | O | (Path) ID của vị trí tổn thương |
| 4 | body_part | string | X | Cập nhật tên vị trí cơ thể |
| 5 | occurred_at | string | X | Cập nhật thời điểm |
| 6 | context_tags | string | X | Cập nhật thẻ bối cảnh |
| 7 | context_other | string | X | Cập nhật bối cảnh khác |
| 8 | medication_nam [medication_name] | string | X | Cập nhật tên thuốc |
| 9 | medication_take [medication_taken_ago] | string | X | Cập nhật thời gian dùng thuốc |
| 10 | medication_unit | string | X | Cập nhật đơn vị thời gian |

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Cập nhật thành công) |
| 3 | data | object | O | Chi tiết vị trí tổn thương sau khi cập nhật |
|  | ↳ lesion_location [lesion_location_id] | string | O | ID của vị trí tổn thương |
|  | ↳ episode_id | string | O | ID đợt tổn thương |
|  | ↳ body_part | string | O | Vị trí cơ thể |
|  | ↳ occurred_at | string | X | Thời gian xuất hiện |
|  | ↳ context_tags | string | X | Chuỗi JSON chứa mảng bối cảnh |
|  | ↳ context_other | string | X | Bối cảnh khác |
|  | ↳ medication_na [medication_name] | string | X | Tên thuốc |
|  | ↳ medication_ta [medication_taken_ago] | string | X | Thời gian dùng thuốc |
|  | ↳ medication_ur [medication_unit] | string | X | Đơn vị thời gian |
|  | ↳ created_at | string | O | Thời điểm tạo bản ghi |
|  | ↳ updated_at | string | O | Thời điểm cập nhật bản ghi |

---

## deck09/s31_1.png — edit_lesion_location (loc04) (output)
DUP-OF deck09/s30_1.png — slide Output dùng lại đúng ảnh của slide Input (ảnh này đã chứa cả bảng Input lẫn Output, xem s30 ở trên).

---

## deck09/s34_1.png — delete_lesion_location (loc05)
Method/path: (không hiển thị) — tab: `DELETE apilesion-locationsid`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API lấy xóa vị trí tổn thương:"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | id | string | O | (Path) ID của vị trí cần xóa |

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Xóa thành công) |
| 3 | data | object | X | Object rỗng {} |

---

## deck09/s38_1.png — set_lesion_photos (lphoto01) (input)
Method/path: (không hiển thị) — tab: `POST apilesion-photos`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API Tải ảnh tổn thương kèm chấm điểm triệu chứng"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | episode_id | string | O | ID đợt tổn thương chứa ảnh |
| 4 | location_id | string | X | ID vị trí tổn thương cụ thể |
| 5 | attachment_id | string | O | ID tệp ảnh gốc lấy từ media_attachments |
| 6 | taken_at | string | X | Thời điểm chụp ảnh |
| 7 | milestone | string | O | Mốc tiến triển (VD: "start", "peak", "normal") |
| 8 | itch_score | string | X | Điểm mức độ ngứa (VD: "5") |
| 9 | pain_score | string | X | Điểm mức độ đau (VD: "3") |
| 10 | burn_score | string | X | Điểm mức độ rát |
| 11 | hives_count | string | X | Số lượng nốt sẩn đếm được |
| 12 | local_auas | string | X | Chỉ số AUAS cục bộ |
| 13 | annotated_url | string | X | URL ảnh đã được AI chú thích (nếu có) |

---

## deck09/s39_1.png — set_lesion_photos (lphoto01) (output)
Method/path: (không hiển thị) — tab: `POST apilesion-photos`

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1001: Thành công) |
| 2 | message | string | O | Thông báo (Lưu ảnh thành công) |
| 3 | data | object | O | Chi tiết bản ghi ảnh tổn thương vừa tạo |
|  | ↳ photo_id | string | O | ID bản ghi ảnh tổn thương |
|  | ↳ episode_id | string | O | ID đợt tổn thương |
|  | ↳ location_id | string | X | ID vị trí tổn thương |
|  | ↳ attachment_id | string | O | ID tệp gốc |
|  | ↳ taken_at | string | X | Thời điểm chụp |
|  | ↳ milestone | string | O | Mốc tiến triển |
|  | ↳ itch_score | string | X | Điểm ngứa |
|  | ↳ pain_score | string | X | Điểm đau |
|  | ↳ burn_score | string | X | Điểm rát |
|  | ↳ hives_count | string | X | Số lượng sẩn |
|  | ↳ local_auas | string | X | Chỉ số AUAS |
|  | ↳ annotated_url | string | X | URL ảnh chú thích |
|  | ↳ created_at | string | O | Thời điểm tạo bản ghi |
|  | ↳ updated_at | string | O | Thời điểm cập nhật bản ghi |

---

## deck09/s42_1.png — get_lesion_photos_by_location (lphoto02)
Method/path: (không hiển thị) — tab: `GET apilesion-photoslocationloc`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API Lấy danh sách ảnh tổn thương theo vị trí"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | location_id | string | O | (Path) ID của vị trí tổn thương |

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo kết quả |
| 3 | data | array | O | Mảng chứa danh sách các bản ghi ảnh tổn thương |
|  | ↳ photo_id | string | O | ID bản ghi ảnh tổn thương |
|  | ↳ episode_id | string | O | ID đợt tổn thương |
|  | ↳ location_id | string | X | ID vị trí tổn thương |
|  | ↳ attachment_id | string | O | ID tệp gốc |
|  | ↳ taken_at | string | X | Thời điểm chụp |
|  | ↳ milestone | string | O | Mốc tiến triển |
|  | ↳ itch_score | string | X | Điểm ngứa |
|  | ↳ pain_score | string | X | Điểm đau |
|  | ↳ burn_score | string | X | Điểm rát |
|  | ↳ hives_count | string | X | Số lượng sẩn |
|  | ↳ local_auas | string | X | Chỉ số AUAS |
|  | ↳ annotated_url | string | X | URL ảnh chú thích |
|  | ↳ created_at | string | O | Thời điểm tạo |
|  | ↳ updated_at | string | O | Thời điểm cập nhật |
|  | ↳ attachment | object | O | Object chứa thông tin file ảnh thật (Join từ media_attachments) |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ attachment_id | string | O | ID file ảnh gốc |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ file_url | string | O | URL hiển thị ảnh |

(attachment_id và file_url lồng cấp 2 bên trong `attachment`.)

---

## deck09/s45_1.png — edit_lesion_photo_milestone (lphoto03) (input)
Method/path: (không hiển thị) — tab: `PATCH apilesion-photosidmilesto`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API Cập nhật mốc giai đoạn ảnh tổn thương"

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | id | string | O | (Path) ID của bản ghi ảnh tổn thương (photo_id) |
| 4 | milestone | string | X | Cập nhật mốc tiến triển |
| 5 | itch_score | string | X | Cập nhật điểm ngứa |
| 6 | pain_score | string | X | Cập nhật điểm đau |
| 7 | burn_score | string | X | Cập nhật điểm rát |
| 8 | hives_count | string | X | Cập nhật số lượng sẩn |
| 9 | local_auas | string | X | Cập nhật chỉ số AUAS |
| 10 | annotated_url | string | X | Cập nhật URL ảnh chú thích |

---

## deck09/s46_1.png — edit_lesion_photo_milestone (lphoto03) (output)
Method/path: (không hiển thị) — tab: `PATCH apilesion-photosidmilesto`

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Cập nhật thành công) |
| 3 | data | object | O | Chi tiết bản ghi ảnh sau cập nhật |
|  | ↳ photo_id | string | O | ID bản ghi ảnh tổn thương |
|  | ↳ episode_id | string | O | ID đợt tổn thương |
|  | ↳ location_id | string | X | ID vị trí tổn thương |
|  | ↳ attachment_id | string | O | ID tệp gốc |
|  | ↳ taken_at | string | X | Thời điểm chụp |
|  | ↳ milestone | string | O | Mốc tiến triển |
|  | ↳ itch_score | string | X | Điểm ngứa |
|  | ↳ pain_score | string | X | Điểm đau |
|  | ↳ burn_score | string | X | Điểm rát |
|  | ↳ hives_count | string | X | Số lượng sẩn |
|  | ↳ local_auas | string | X | Chỉ số AUAS |
|  | ↳ annotated_url | string | X | URL ảnh chú thích |
|  | ↳ created_at | string | O | Thời điểm tạo bản ghi |
|  | ↳ updated_at | string | O | Thời điểm cập nhật bản ghi |

---

## deck09/s49_1.png — delete_lesion_photo (lphoto04)
Method/path: (không hiển thị) — tab: `DELETE apilesion-photosid`

Tiêu đề: "Bảng đặc tả Input và Output chi tiết cho API Cập nhật mốc giai đoạn ảnh tổn thương"  (sic — tiêu đề copy nhầm từ API PATCH milestone, giống hệt sheet)

**Input**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | id | string | O | (Path) ID bản ghi ảnh tổn thương cần xóa (photo_id) |

**Output**

| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Xóa ảnh tổn thương thành công) |
| 3 | data | object | X | Object rỗng {} |

---

# So sánh với sheet

Tất cả 18 ảnh (17 ảnh duy nhất + 1 DUP) khớp 1:1 với tab sheet tương ứng: cùng tham số, thứ tự, type, cờ NN, cấp lồng và mô tả. Chỉ khác về hiển thị: tên tham số bị cắt do độ rộng cột (không phải khác biệt nội dung).

Không ảnh nào thể hiện method/path, nên method/path chỉ suy ra từ tên tab sheet.

Lỗi có trong cả sheet lẫn ảnh (ảnh chép nguyên lỗi của sheet):
- s49 DELETE photo: tiêu đề "API Cập nhật mốc giai đoạn ảnh tổn thương" (copy-paste nhầm từ PATCH milestone).
- s34 DELETE location: "API lấy xóa vị trí tổn thương" (thừa chữ "lấy").
- s30 PATCH location: "API cập nhật danh sách vị trí tổn thương kèm ảnh", nhưng thực tế chỉ cập nhật 1 vị trí và không có ảnh.
- s27 GET locations theo episode: tiêu đề "kèm ảnh" nhưng output không có trường ảnh nào.
- Mã code: các API create trả 1001 (s06, s24, s39), các API còn lại trả 1000.

Thiếu trong deck09 so với sheet: tab `GET apilesion-episodesrecordmed` (Admin lấy đợt tổn thương theo medical_record_id; mã có thể là lesion05) không có slide/ảnh nào. Mã loc02 cũng không xuất hiện (bỏ trống số thứ tự).
