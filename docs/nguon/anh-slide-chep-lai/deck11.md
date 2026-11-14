> Bản chép lại nội dung ảnh bảng API trong slide (tai-lieu-goc/), do AI đọc ảnh ngày 2026-11-14 và đối chiếu với Sheet API.
> Dùng để tra cứu nhanh; khi cần chính xác tuyệt đối hãy mở ảnh gốc trong slide.

# Transcript deck11 (Template / Section / Question APIs)

Ghi chú chung: không ảnh nào hiển thị HTTP method hoặc path. Mọi ảnh là screenshot trực tiếp từ Google Sheet (cùng layout NO | Tên parameter | Type | NN | Mô tả). Dấu "↳" = tham số lồng (con của dòng phía trên); số dấu thụt = cấp lồng.
deck11/s02_1.png là DUP-OF deck01/s32_1.png (Danh sách API), bỏ qua.

---

## deck11/s05_1.png — set_template (tmpl01)
Method/path: không hiển thị (tab sheet: "POST apitemplates")

Câu mô tả: "Khởi tạo một mẫu phiếu khám bệnh gốc (vd: Phiếu khám mề đay)."

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | code_template | string | O | Khóa chính mã định danh mẫu (VD: "TMPL_URT") |
| 4 | name | string | O | Tên mẫu phiếu |
| 5 | description | string | X | Mô tả mẫu phiếu |
| 6 | version | string | X | Phiên bản mẫu (VD: "1.0") |
| 7 | is_active | string | X | Trạng thái sử dụng ("1" hoặc "0") |

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1001: Thành công) |
| 2 | message | string | O | Thông báo (Tạo mẫu phiếu khám thành công) |
| 3 | data | object | O | Chi tiết mẫu phiếu vừa tạo |
| | ↳ code_template | string | O | Mã định danh mẫu |
| | ↳ name | string | O | Tên mẫu phiếu |
| | ↳ description | string | X | Mô tả |
| | ↳ version | string | O | Phiên bản |
| | ↳ is_active | string | O | Trạng thái |
| | ↳ created_at | string | O | Thời gian tạo |
| | ↳ updated_at | string | O | Thời gian cập nhật |

---

## deck11/s08_1.png — get_list_templates (tmpl02)
Method/path: không hiển thị (tab sheet: "GET apitemplatesall")

Câu mô tả: "Truy xuất danh sách các mẫu phiếu khám đang có trên hệ thống, hỗ trợ phân trang."

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | page | string | X | (Query) Số trang hiện tại |
| 3 | limit | string | X | (Query) Số bản ghi trên 1 trang |

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo kết quả |
| 3 | data | array | O | Mảng chứa danh sách các mẫu phiếu |
| 4 | ↳ code_template | string | O | Mã định danh mẫu |
| 5 | ↳ name | string | O | Tên mẫu phiếu |
| 6 | ↳ description | string | X | Mô tả |
| 7 | ↳ version | string | O | Phiên bản |
| 8 | ↳ is_active | string | O | Trạng thái hoạt động |
| 9 | ↳ created_at | string | O | Thời gian tạo |

---

## deck11/s11_1.png — get_template_detail (tmpl03)
Method/path: không hiển thị (tab sheet: "GET apitemplatesid")

Câu mô tả: "Lấy toàn bộ cấu trúc động của một mẫu phiếu khám (Bao gồm các section, questions và options)."

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | id | string | O | (Path) Mã định danh mẫu phiếu (code_template) |

**Output** (header row không in nghiêng/đậm trong ảnh)
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo kết quả |
| 3 | data | object | O | Chi tiết mẫu phiếu và toàn bộ cây biểu mẫu |
| | ↳ code_template | string | O | Mã định danh mẫu |
| | ↳ name | string | O | Tên mẫu phiếu |
| | ↳ sections | array | O | Mảng các phần (sections) trong mẫu |
| | ↳↳ section_id | string | O | ID của phần |
| | ↳↳ title | string | O | Tiêu đề phần |
| | ↳↳ questions | array | O | Mảng các câu hỏi thuộc phần này |
| | ↳↳↳ question_id | string | O | ID câu hỏi |
| | ↳↳↳ question_text | string | O | Nội dung câu hỏi |
| | ↳↳↳ type_question | string | O | Kiểu câu hỏi |
| | ↳↳↳ options | array | X | Mảng các lựa chọn (Nếu có) |
| | ↳↳↳↳ id | string | O | ID lựa chọn |
| | ↳↳↳↳ option_text | string | O | Tên lựa chọn hiển thị |
| | ↳↳↳↳ option_value | string | O | Giá trị lựa chọn |

---

## deck11/s14_1.png — edit_template (tmpl04)
Method/path: không hiển thị (tab sheet: "PUT apitemplatesid")

Câu mô tả: "Chỉnh sửa thông tin chung của mẫu phiếu khám (Không bao gồm cấu trúc bên trong)."

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | id | string | O | (Path) Mã định danh mẫu phiếu (code_template) |
| 4 | name | string | X | Cập nhật tên mẫu phiếu |
| 5 | description | string | X | Cập nhật mô tả |
| 6 | version | string | X | Cập nhật phiên bản |
| 7 | is_active | string | X | Cập nhật trạng thái sử dụng |

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Cập nhật mẫu thành công) |
| 3 | data | object | O | Chi tiết mẫu phiếu sau cập nhật |
| 4 | ↳ code_template | string | O | Mã định danh mẫu |
| 5 | ↳ name | string | O | Tên mẫu phiếu |
| 6 | ↳ version | string | O | Phiên bản |
| 7 | ↳ is_active | string | O | Trạng thái |

---

## deck11/s17_1.png — delete_template (tmpl05)
Method/path: không hiển thị (tab sheet: "DELETE apitemplatesid")

Câu mô tả: "Bảng đặc tả Input và Output chi tiết cho API Admin xóa mẫu bệnh án"

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | id | string | O | (Path) Mã định danh mẫu (code_template) |

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Xóa mẫu thành công) |
| 3 | data | object | X | Object rỗng {} |

---

## deck11/s21_1.png — set_template_section (sec01)
Method/path: không hiển thị (tab sheet: "POST apitemplatestemplate_idsec")

Câu mô tả: "Thêm một phần nội dung (section) mới vào trong một mẫu phiếu khám."

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | template_id | string | O | (Path) Mã định danh mẫu phiếu cha |
| 4 | title | string | O | Tiêu đề phần (VD: "Thông tin chung") |
| 5 | order | string | O | Thứ tự hiển thị phần |
| 6 | is_required | string | X | Có bắt buộc hoàn thành không ("0" hoặc "1") |
| 7 | filled_by | string | X | Đối tượng điền ("patient", "doctor", "patdoc") |

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1001: Thành công) |
| 2 | message | string | O | Thông báo (Tạo section thành công) |
| 3 | data | object | O | Chi tiết section vừa tạo |
| 4 | ↳ section_id | string | O | ID của phần (PK) |
| 5 | ↳ template_id | string | O | Mã mẫu phiếu chứa phần này |
| 6 | ↳ title | string | O | Tiêu đề phần |
| 7 | ↳ order | string | O | Thứ tự hiển thị |
| 8 | ↳ is_required | string | O | Trạng thái bắt buộc |
| 9 | ↳ filled_by | string | O | Đối tượng điền |

---

## deck11/s24_1.png — edit_template_section (sec02)
Method/path: không hiển thị (tab sheet: "PUT apitemplatessectionsid")

Câu mô tả: "Sửa đổi thông tin cấu hình của một phần (section)."

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | id | string | O | (Path) ID của section cần sửa |
| 4 | title | string | X | Cập nhật tiêu đề |
| 5 | order | string | X | Cập nhật thứ tự hiển thị |
| 6 | is_required | string | X | Cập nhật trạng thái bắt buộc |
| 7 | filled_by | string | X | Cập nhật đối tượng điền |

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Cập nhật section thành công) |
| 3 | data | object | O | Chi tiết section sau cập nhật (Giống output sec01) |
| 4 | ↳ section_id | string | O | ID của phần |
| 5 | ↳ template_id | string | O | Mã mẫu phiếu chứa phần |
| 6 | ↳ title | string | O | Tiêu đề phần |
| 7 | ↳ order | string | O | Thứ tự hiển thị |
| 8 | ↳ is_required | string | O | Trạng thái bắt buộc |
| 9 | ↳ filled_by | string | O | Đối tượng điền |

---

## deck11/s27_1.png — delete_template_section (sec03)
Method/path: không hiển thị (tab sheet: "DELETE apitemplatessectionsid")

Câu mô tả: "Bảng đặc tả Input và Output chi tiết cho API Admin xóa phân mục"

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | id | string | O | (Path) ID của section cần xóa |

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Xóa section thành công) |
| 3 | data | object | X | Object rỗng {} |

---

## deck11/s31_1.png — set_template_question (ques01) (input)
Method/path: không hiển thị (tab sheet: "POST apitemplatessectionssectio")

Câu mô tả: "Thêm mới một câu hỏi (và danh sách lựa chọn nếu là trắc nghiệm) vào trong một section."

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | section_id | string | O | (Path) ID của phần chứa câu hỏi |
| 4 | question_id | string | O | (Body) Mã định danh câu hỏi (VD: "Q_ITCH") |
| 5 | question_text | string | O | Nội dung câu hỏi |
| 6 | type_question | string | O | Kiểu: "text", "number", "radio", "checkbox"... |
| 7 | placeholder | string | X | Gợi ý nhập liệu |
| 8 | order | string | O | Thứ tự hiển thị câu hỏi |
| 9 | is_required | string | X | Câu hỏi có bắt buộc không ("0" hoặc "1") |
| 10 | parent_question_id | string | X | Mã câu hỏi cha (Nếu là câu hỏi phụ thuộc) |
| 11 | show_if_answer | string | X | Điều kiện hiển thị (Chuỗi JSON) |
| 12 | help_text | string | X | Văn bản giải thích thêm |
| 13 | allow_image | string | X | Cho phép đính kèm ảnh ("0" hoặc "1") |
| 14 | options | array | X | Mảng các lựa chọn (Nếu type là radio/checkbox) |
| | ↳ option_text | string | O | Nội dung lựa chọn hiển thị |
| | ↳ option_value | string | O | Giá trị lưu trữ (VD: "YES", "NO") |
| | ↳ order | string | O | Thứ tự hiển thị lựa chọn |
| | ↳ trigger_image_up[load] | string | X | Bắt buộc tải ảnh khi chọn ("0" hoặc "1") |

(Trong ảnh tên "trigger_image_up" bị cắt do độ rộng cột; sheet ghi đầy đủ "trigger_image_upload".)

---

## deck11/s32_1.png — set_template_question (ques01) (output)

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1001: Thành công) |
| 2 | message | string | O | Thông báo (Tạo câu hỏi thành công) |
| 3 | data | object | O | Chi tiết câu hỏi và các lựa chọn vừa tạo |
| | ↳ question_id | string | O | ID câu hỏi |
| | ↳ section_id | string | O | ID section chứa nó |
| | ↳ question_text | string | O | Nội dung câu hỏi |
| | ↳ type_question | string | O | Kiểu câu hỏi |
| | ↳ options | array | X | Mảng các lựa chọn (Đã được cấp DB ID) |
| | ↳↳ id | string | O | ID của bản ghi lựa chọn |
| | ↳↳ option_text | string | O | Tên hiển thị |
| | ↳↳ option_value | string | O | Giá trị lưu trữ |

---

## deck11/s35_1.png — edit_template_question (ques02) (input)
Method/path: không hiển thị (tab sheet: "PUT apitemplatesquestionsid")

Câu mô tả: "Chỉnh sửa cấu hình, nội dung hoặc các danh sách lựa chọn của một câu hỏi đã tồn tại."

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | Content-Type | string | O | (Header) Mặc định là application/json |
| 3 | id | string | O | (Path) Mã định danh của câu hỏi (question_id) |
| 4 | question_text | string | X | Cập nhật nội dung câu hỏi |
| 5 | placeholder | string | X | Cập nhật gợi ý |
| 6 | order | string | X | Cập nhật thứ tự |
| 7 | show_if_answer | string | X | Cập nhật điều kiện hiển thị |
| 8 | options | array | X | Mảng các lựa chọn (Upsert - thêm/sửa/xóa options) |
| | ↳ id | string | X | ID lựa chọn (Nếu sửa), bỏ trống nếu tạo mới |
| | ↳ option_text | string | X | Nội dung lựa chọn hiển thị |
| | ↳ option_value | string | X | Giá trị lưu trữ |

---

## deck11/s36_1.png — edit_template_question (ques02) (output)

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Cập nhật câu hỏi thành công) |
| 3 | data | object | O | Chi tiết câu hỏi sau cập nhật |
| | ↳ question_id | string | O | ID câu hỏi |
| | ↳ section_id | string | O | ID section chứa nó |
| | ↳ question_text | string | O | Nội dung câu hỏi |
| | ↳ type_question | string | O | Kiểu câu hỏi |
| | ↳ options | array | X | Mảng các lựa chọn |
| | ↳↳ id | string | O | ID của bản ghi lựa chọn |
| | ↳↳ option_text | string | O | Tên hiển thị |
| | ↳↳ option_value | string | O | Giá trị lưu trữ |

---

## deck11/s39_1.png — delete_template_question (ques03)
Method/path: không hiển thị (tab sheet: "DELETE apitemplatesquestionsid")

Câu mô tả: "Bảng đặc tả Input và Output chi tiết cho API Admin xóa câu hỏi"

**Input**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | Authorization | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | id | string | O | (Path) Mã định danh câu hỏi cần xóa (question_id) |

**Output**
| NO | Tên parameter | Type | NN | Mô tả |
|---|---|---|---|---|
| 1 | code | string | O | Mã phản hồi (1000: Thành công) |
| 2 | message | string | O | Thông báo (Xóa câu hỏi thành công) |
| 3 | data | object | X | Object rỗng {} |

---

# Kết quả so sánh với sheet (api.txt)

Cả 12 ảnh khớp hoàn toàn với tab sheet tương ứng: cùng tham số, type, cờ NN (O/X), cấp lồng, mô tả và mã code (1001 cho tạo; 1000 cho các API còn lại). Khác biệt duy nhất là định dạng: ảnh s31 cắt tên "trigger_image_upload" thành "trigger_image_up"; header Output ở s11 không in nghiêng/đậm. Không ảnh nào có method/path; method/path chỉ suy ra được từ tên tab sheet.
