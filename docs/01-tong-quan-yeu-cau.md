# Tổng quan và yêu cầu của đề tài DrMayDay

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE1_DrMayDay.pptx`.
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

#### HỆ THỐNG QUẢN LÝ KHÁM BỆNH & THEO DÕI MỀ ĐAY (DRMAYDAY)

- Giới thiệu
- Ghi chú người thuyết trình: https://docs.google.com/document/d/1m9rYl75TZToIJ_xCIdjF0FqqEhJd2Ctn_lMsAXOZcOk/edit?usp=sharing
- ⚠ Link Google Doc trong ghi chú slide này trỏ tới một bài tập lập trình không liên quan (net.xml).
- _(slide 1)_

#### Yêu cầu tổng quan của đề tài

- Phát triển hệ thống bao gồm Client (chỉ dành cho lớp IT4788: ứng dụng đa nền tảng), hệ thống Database server, AI server (option) và Service server để xây dựng ứng dụng quản lý khám chữa bệnh chuyên sâu.
- Ứng dụng giải quyết bài toán theo dõi bệnh mề đay/da liễu mạn tính, giúp bệnh nhân tự ghi nhận tình trạng tổn thương da, chấm điểm UAS7 hằng ngày, và hỗ trợ bác sĩ tùy biến mẫu phiếu khám bệnh linh hoạt.
- _(slide 4)_

- Hệ thống gồm:
- Database: Lưu trữ hồ sơ bệnh án, thông tin người dùng, biểu mẫu động, và dữ liệu cấu trúc tổ chức (Khoa/phòng).
- AI & Service server: Cung cấp API xử lý nghiệp vụ lâm sàng và tích hợp mô hình AI phân tích/nhận diện tổn thương da qua hình ảnh.
- Client (Mobile/Web App): Hiển thị giao diện cho bệnh nhân tự theo dõi bệnh lý và giao diện quản trị cho nhân viên y tế/Admin. 	Mobile app cho cả bệnh nhân và bác sĩ (dành cho lớp IT4788)
- Web app: chỉ cho bác sĩ dùng
- Push notification: Thực hiện bằng Firebase (FCM) để thông báo nhắc lịch khám, thông báo có kết quả xét nghiệm, đơn thuốc mới.
- _(slide 5)_

- Phần 1: Người dùng, Phân quyền & Cơ sở vật chất
- Quản lý tài khoản, phân quyền RBAC và tổ chức chi nhánh → khoa → phòng khám.
- Phần 2: Bộ tạo mẫu phiếu khám động (Dynamic Form Builder)
- Cho phép Admin/Bác sĩ thiết kế các bảng câu hỏi linh hoạt theo 4 tầng: Template → Section → Question → Option.
- Phần 3: Hồ sơ bệnh án & Tệp đính kèm
- Quản lý lượt khám, câu trả lời phiếu khám và kho lưu trữ hình ảnh minh họa (Media).
- _(slide 6)_

- Phần 4: Theo dõi tổn thương da & Thang điểm UAS7
- Ghi nhận các 'đợt tổn thương', chụp ảnh theo mốc tiến triển và đánh giá điểm UAS7 hằng ngày.
- Phần 5: Xét nghiệm & Đơn thuốc
- Quản lý quy trình chỉ định xét nghiệm, trả kết quả và kê đơn thuốc chi tiết.
- Phần 6: AI & Thông báo
- Tích hợp xử lý ảnh AI Predict và hệ thống gửi Push Notification tới thiết bị người dùng. (TUỲ CHỌN). PHẦN CÀI ĐẶT AI PREDICT CÓ BÊN KHÁC LÀM, NHÓM CHỈ VIỆC CALL TÍCH HỢP VÀO
- _(slide 7)_

#### 2. Yêu cầu chức năng và phi chức năng

- 2.1. Yêu cầu chức năng
- 2.2. Yêu cầu phi chức năng
- _(slide 9)_

#### 2.1. Yêu cầu chức năng

- A. Phân hệ Bệnh nhân
- 1. Xác thực và Quản lý tài khoản:
- Đăng ký, đăng nhập bằng số điện thoại/email, hỗ trợ khôi phục mật khẩu (OTP).
- Cập nhật hồ sơ thông tin cá nhân (BHYT, địa chỉ, người thân) và thiết lập cấu hình nhận thông báo (Push Notification/Âm thanh).
- 2. Khai báo Y tế & Quản lý bệnh án cá nhân:
- Tự khởi tạo hồ sơ bệnh án mới dựa trên các mẫu phiếu khám động (Templates) được hệ thống cung cấp.
- Trả lời bảng câu hỏi (Text, Trắc nghiệm, Tải ảnh đính kèm) với logic hiển thị rẽ nhánh thông minh.
- Tra cứu lịch sử bệnh án, xem chi tiết kết quả xét nghiệm và đơn thuốc điện tử (liều dùng, tần suất, hướng dẫn).
- _(slide 11)_

- A. Phân hệ Bệnh nhân
- 3. Theo dõi tổn thương da chuyên sâu (Lesion Tracking):
- Bệnh nhân chủ động ghi nhận các đợt bùng phát tổn thương da (Lesion Episodes) kèm bối cảnh (sau ăn, vận động) và thuốc đã dùng.
- Đánh dấu cụ thể các vị trí tổn thương trên cơ thể (Mặt, Tay, Đùi...).
- Chụp ảnh theo dõi tiến triển 3 giai đoạn: Khởi phát (Start) - Đỉnh điểm (Peak) - Hồi phục (Normal).
- Đánh giá và lưu trữ các điểm số lâm sàng: Mức độ ngứa, mức độ đau, mức độ rát và đếm số lượng sẩn phù.
- 4. Đánh giá thang điểm UAS7:
- Chấm điểm UAS7 (Urticaria Activity Score) hằng ngày bao gồm: Điểm mức độ ngứa (HSS7) và Điểm số mảng sẩn (ISS7) để theo dõi mức độ hoạt động của bệnh mề đay.
- _(slide 12)_

- B. Phân hệ Web/App Bác sĩ & Nhân viên y tế
- 1. Khám và Điều trị (Clinical Tasks):
- Tìm kiếm bệnh nhân, xem lịch sử khám và tiếp nhận xử lý hồ sơ bệnh án (đang chờ - pending).
- Đánh giá các câu trả lời, xem hình ảnh tổn thương da của bệnh nhân tải lên và ghi chú chỉ dẫn y tế.
- 2. Chỉ định Xét nghiệm & Kê đơn thuốc:
- Tạo yêu cầu xét nghiệm (Lab Requests) gồm nhiều hạng mục (IgE, Công thức máu...) và nhập kết quả xét nghiệm trả về.
- Kê đơn thuốc chi tiết (Prescriptions): Thêm danh sách thuốc, liều dùng, tần suất và thời gian điều trị.
- _(slide 13)_

- C. Phân hệ Web Admin - Quản trị hệ thống
- 1. Bộ tạo mẫu phiếu khám động (Dynamic Form Builder):
- Cung cấp công cụ xây dựng các biểu mẫu y tế linh hoạt theo mô hình 4 tầng: Template (Mẫu) → Section (Phần) → Question (Câu hỏi) → Option (Lựa chọn).
- Hỗ trợ nhiều định dạng: Text, Number, Radio, Checkbox, Image Upload, v.v..
- Thiết lập logic rẽ nhánh điều kiện: Hiển thị câu hỏi con dựa vào câu trả lời của câu hỏi cha.
- 2. Quản trị Cơ sở hạ tầng (Facilities):
- Tạo và quản lý sơ đồ tổ chức đa cấp: Chi nhánh (Branches) → Khoa/Phòng ban (Departments) → Phòng khám chức năng (Rooms).
- _(slide 14)_

- C. Phân hệ Web Admin - Quản trị hệ thống
- 3. Quản trị Người dùng & Phân quyền (RBAC):
- Quản lý danh sách toàn bộ tài khoản (Bệnh nhân, Bác sĩ, Nhân viên) và gán vị trí công tác (Khoa/Phòng).
- Phân quyền linh hoạt nhiều cấp (Giám đốc, Trưởng khoa, Bác sĩ, Điều dưỡng...).
- Cấu hình quyền truy cập (Permissions) tới tận từng API Endpoints riêng biệt.
- _(slide 15)_

- D. Phân hệ Lõi Phân tích (AI Engine):
- CHỨC NĂNG NÀY DO BÊN KHÁC LÀM
- Tích hợp AI dự đoán (AI Predict): Tự động phân tích hình ảnh vùng da tổn thương do bệnh nhân tải lên.
- Trích xuất dữ liệu tự động: Đếm số lượng nốt sẩn/mảng mề đay (hives count) và tính toán chỉ số AUAS cục bộ để hỗ trợ bác sĩ chẩn đoán.
- _(slide 16)_

#### 2.2. Yêu cầu phi chức năng

- 1. Yêu cầu về Hiệu năng (Performance & Responsiveness)
- CHỨC NĂNG VỀ AI SẼ ĐƯỢC BÊN KHÁC LÀM
- Tốc độ xử lý lõi AI (AI Engine): Luồng phân tích hình ảnh tổn thương da (đếm nốt sẩn, tính chỉ số AUAS cục bộ) phải được tối ưu hóa. Thời gian từ lúc người dùng tải ảnh lên đến khi trả về kết quả AI phân tích không được vượt quá 3 - 5 giây để đảm bảo trải nghiệm khai báo bệnh án mượt mà.
- Độ trễ API (API Latency): Các truy vấn tải cấu trúc biểu mẫu động (Dynamic Forms đa tầng) và lưu trữ câu trả lời (Answers) phải phản hồi cực nhanh dưới 500ms.
- Xử lý đa phương tiện (Media Storage): Cấu trúc backend phải hỗ trợ cơ chế upload mẻ (batch upload tối đa 10 ảnh cùng lúc) lên kho lưu trữ MinIO, xử lý đồng thời luồng dữ liệu hình ảnh độ phân giải cao một cách ổn định.
- _(slide 18)_

- 2. Yêu cầu về Tính sẵn sàng và Độ tin cậy (Availability & Reliability)
- Hoạt động 24/7: Hệ thống phải đảm bảo thời gian hoạt động (Uptime) tối thiểu 99.9%. Bệnh nhân cần truy cập liên tục hằng ngày để chấm điểm UAS7 và nhận thông báo nhắc nhở (nhắc lịch khám, uống thuốc) qua FCM.
- Toàn vẹn dữ liệu lâm sàng: Mọi giao dịch ghi nhận điểm số hằng ngày phải có ràng buộc toàn vẹn tuyệt đối (Ví dụ: UNIQUE key patient_id và score_date trong bảng uas7_scores để chặn lỗi người dùng submit nhiều lần trong một ngày).
- Lưu trữ cache: Ứng dụng client cần có khả năng lưu tạm (cache) các bảng câu hỏi nội bộ (Templates) để đề phòng trường hợp rớt mạng, bệnh nhân vẫn có thể xem lại lịch sử trả lời.
- _(slide 19)_

- 3. Yêu cầu về Tính bảo mật (Security)
- Xác thực & Vô hiệu hóa Token: Tuân thủ chuẩn bảo mật JWT (Bearer Token). Đặc biệt, hệ thống trang bị cơ chế token_blacklist - lập tức đưa Access Token vào danh sách đen ngay khi người dùng đăng xuất hoặc đổi mật khẩu để vô hiệu hóa hoàn toàn truy cập trái phép.
- Bảo mật phân quyền động (Dynamic RBAC): Hệ thống không hard-code phân quyền. Bảng permissions_endpoints sẽ kiểm soát chặt chẽ vai trò (Role) nào được phép gọi API (Endpoint) nào. Tự động từ chối (403 Forbidden) nếu truy cập sai thẩm quyền.
- Quyền riêng tư Y tế (Medical Privacy): Hình ảnh vùng da tổn thương và hồ sơ bệnh án là dữ liệu nhạy cảm. Hệ thống đảm bảo bác sĩ chỉ xem được hồ sơ khi được gán quyền (assigned_doctor_id), và người dùng tuyệt đối không truy cập chéo dữ liệu của nhau. Mọi dữ liệu giao tiếp phải mã hóa qua HTTPS (TLS/SSL).
- _(slide 20)_

- 4. Yêu cầu về Trải nghiệm Người dùng (Usability / UI-UX)
- PHẦN MOBILE DO LỚP IT4788 LÀM
- Giao diện thân thiện theo dõi bệnh lý mạn tính: Người mắc bệnh mề đay cần thao tác chụp ảnh và chấm điểm hằng ngày. Giao diện (Mobile App) phải tập trung thiết kế nút bấm lớn, flow rõ ràng, hiển thị cảnh báo lỗi (validate) ngay tại client trước khi đẩy lên server để tiết kiệm thời gian.
- Tương tác động mượt mà: Bộ tạo form (Dynamic Forms) phải xử lý mượt mà logic rẽ nhánh. Khi bệnh nhân chọn một Option cụ thể, câu hỏi phụ (child question) hoặc module "Tải ảnh lên" phải lập tức hiển thị mà không cần tải lại trang.
- Nhắc nhở qua Push Notification: Bệnh nhân phải nhận được thông báo đẩy (Firebase Cloud Messaging) trực tiếp và ngay lập tức khi bác sĩ cập nhật đơn thuốc hay có kết quả xét nghiệm mới.
- _(slide 21)_

- 5. Yêu cầu về Kiến trúc và Khả năng Mở rộng (Maintainability & Scalability)
- Tách biệt hệ thống (Decoupling): Lõi xử lý trí tuệ nhân tạo (AI Predict Engine) phải được triển khai như một Service độc lập (Standalone Service) tách rời khỏi API Backend lõi. Tránh việc server bị sập khi có lượng lớn người dùng cùng xử lý ảnh trong khung giờ cao điểm.
- Kiến trúc Đa chi nhánh (Multi-branch Topology): Sơ đồ tổ chức cơ sở vật lý (Branches → Departments → Rooms) được chuẩn hóa 1-N. Cho phép triển khai mở rộng cho chuỗi phòng khám mà không phá vỡ cấu trúc code.
- Mở rộng chuyên khoa linh hoạt: Khối dữ liệu Bộ tạo biểu mẫu (Template → Section → Question → Option) được thiết kế trừu tượng hoàn toàn. Bệnh viện có thể mở rộng ứng dụng khám cho chuyên khoa khác (Hô hấp, Tiêu hóa...) chỉ bằng cách thiết lập cấu hình trên Admin Dashboard, không cần lập trình lại App.
- _(slide 22)_

#### 3. Cơ sở dữ liệu

- Tổng quan hệ thống (link)
- Quy mô hệ thống: Cơ sở dữ liệu được thiết kế với tổng cộng 29 bảng, chia thành 7 nhóm chức năng chuyên biệt, phục vụ bài toán quản lý y tế và da liễu mạn tính.
- Đặc trưng thiết kế: Không sử dụng các quan hệ 1-1 cứng nhắc mà tối ưu hoàn toàn bằng quan hệ 1-N và giải quyết các quan hệ Nhiều - Nhiều (N-N) thông qua các bảng trung gian.
- 3 Mô hình Cây phân cấp cốt lõi:
- Tổ chức: Chi nhánh → Khoa/Phòng ban → Phòng khám → Người dùng.
- Biểu mẫu: Mẫu phiếu (Template) → Phần (Section) → Câu hỏi (Question) → Lựa chọn (Option).
- Tổn thương da: Bệnh án → Đợt bùng phát → Vị trí → Ảnh chụp tiến triển.
- Liên kết trên slide: <https://docs.google.com/document/d/1smCGZ0DYY9HXpxjmnyOGg-3Or34GPX-L/edit?usp=sharing&ouid=112257972794059576004&rtpof=true&sd=true>
- _(slide 24)_

- 3.1 Nhóm Người dùng, Phân quyền & Hạ tầng cơ sở
- Tài khoản & Hồ sơ (Subtype Design): Thiết kế phân rã với bảng trung tâm users (lưu định danh, mật khẩu). Từ đây chia thành 2 bảng subtype:
- staffs: Dành cho nhân viên/bác sĩ, lưu thông tin công tác, liên kết trực tiếp tới role_id, branch_id, department_id, room_id.
- patients: Dành cho người bệnh, lưu thông tin nhân khẩu học chuyên sâu (Năm sinh, dân tộc, địa chỉ 3 cấp), thông tin BHYT và ngày điều trị ngoại trú.
- Hạ tầng y tế (Topology): Quan hệ 1-N chặt chẽ: branches (Chi nhánh) chứa departments (Khoa), Khoa chứa rooms (Phòng khám).
- Bảo mật & Phân quyền động (RBAC):
- Cấu trúc quyền hạn đa tầng qua roles, permissions và role_permissions.
- Kiểm soát bảo mật tới tận API qua bảng bổ sung api_endpoints và bảng nối permissions_endpoints.
- Quản lý phiên làm việc qua token_blacklist và user_fcm_tokens.
- _(slide 25)_

- 3.2 Nhóm Bộ tạo mẫu phiếu khám động (Form Builder)
- Thiết kế dữ liệu lưu trữ biểu mẫu linh hoạt,
- Mô hình 4 tầng (1-N liên tiếp): Bảng templates là gốc, chứa nhiều template_sections. Mỗi phần chứa nhiều questions. Các câu trắc nghiệm sẽ tham chiếu tới question_options.
- Xử lý logic rẽ nhánh (Conditional Logic):
  - Bảng questions có cơ chế tự tham chiếu (Self-referencing) qua parent_question_id để tạo cây câu hỏi cha-con.
  - Điều kiện hiển thị được lưu trữ linh hoạt dưới định dạng JSON trong cột show_if_answer và condition_rules.
- Linh hoạt loại câu hỏi: Cột type_question (enum) hỗ trợ Text, Number, Date, Radio, Image Upload....
- _(slide 26)_

- 3.3 Nhóm Hồ sơ bệnh án & Kho Media trung tâm
- Hồ sơ bệnh án (medical_records): Là bảng giao diện trung tâm của nghiệp vụ lâm sàng, tham chiếu tới bệnh nhân (patient_id), bác sĩ phụ trách (assigned_doctor_id) và mẫu phiếu khám (template_id).
- Dữ liệu lâm sàng (answers):
  - Lưu câu trả lời tương ứng với question_id.
  - Có ràng buộc UNIQUE(medical_record_id, question_id) để đảm bảo mỗi câu hỏi chỉ có 1 câu trả lời duy nhất cho 1 hồ sơ.
- Tối ưu lưu trữ Media (media_attachments): Thiết kế thành kho lưu trữ tập trung (chứa URL, định dạng). Liên kết N-N với câu trả lời thông qua bảng trung gian answer_images để tái sử dụng ảnh, tránh phình to CSDL.
- _(slide 27)_

- 3.4 Nhóm Theo dõi tổn thương da & UAS7 (Nghiệp vụ cốt lõi)
- Tracking tổn thương 3 cấp (Lesion Tracking):
  - Cấp 1: lesion_episodes lưu đợt bùng phát (thời điểm, thẻ bối cảnh dạng JSON, thuốc đã dùng).
  - Cấp 2: lesion_locations chỉ định chi tiết các vị trí trên cơ thể (Mặt, Tay...).
  - Cấp 3: lesion_photos lưu ảnh chụp tại 3 mốc (khởi phát/đỉnh điểm/hồi phục). Chứa các cột điểm lâm sàng: itch_score, pain_score, hives_count và local_auas.
- Ghi nhận điểm UAS7 (uas7_scores): Lưu điểm số sẩn (ISS7) và điểm ngứa (HSS7) hằng ngày. Ràng buộc UNIQUE(patient_id, score_date) đảm bảo không bị ghi trùng lặp trong 1 ngày.
- _(slide 28)_

- 3.5 Nhóm Cận lâm sàng, Kê đơn & Thông báo
- Quy trình Xét nghiệm (3 tầng): Bảng lab_requests (Yêu cầu chung) → lab_request_items (Mục xét nghiệm chi tiết) → lab_results (Kết quả trả về).
- Đơn thuốc (2 tầng): Bảng prescriptions (Lưu thông tin bác sĩ, ghi chú) là cha của prescription_items (Lưu tên thuốc, liều dùng, tần suất, thời gian).
- Hệ thống Thông báo: Bảng notifications lưu lịch sử push notification, kết hợp với bảng user_notification_settings (Bật/tắt thông báo lịch hẹn, xét nghiệm, âm thanh riêng) để cá nhân hóa trải nghiệm.
- _(slide 29)_

- 3.6 Các Quy tắc Ràng buộc & Toàn vẹn Dữ liệu
- Xử lý xóa dữ liệu (ON DELETE CASCADE): Được áp dụng cho các dữ liệu phụ thuộc hoàn toàn. Ví dụ: Xóa một mẫu phiếu khám (templates) sẽ tự động xóa sạch các section và câu hỏi bên trong. Xóa tài khoản sẽ xóa token bị blacklist.
- Lưu vết lịch sử (ON DELETE SET NULL): Áp dụng cho các dữ liệu cần lưu hồ sơ vĩnh viễn. Ví dụ: Nếu một bác sĩ nghỉ việc (bị xóa khỏi bảng users/staffs), ID người tạo trong bảng medical_records sẽ chuyển thành NULL, đảm bảo bệnh án của bệnh nhân không bị mất.
- Bảo vệ dữ liệu (RESTRICT): Hệ thống chặn việc xóa một chi nhánh/phòng ban nếu vẫn còn nhân viên (staffs) đang được phân công tại đó.
- _(slide 30)_

#### 4. Danh sách API

- Slide chỉ có một mã QR, giải mã ra `https://qr.generatorqr.com/9PPethzZs` (trang chuyển hướng động, chưa xác minh được đích; nhiều khả năng là Sheet API). Danh sách API đầy đủ: [02-api/README.md](02-api/README.md).

#### DANH SÁCH MÃ RESPONSE

- https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit?gid=1513579546#gid=1513579546&range=A1
- Liên kết trên slide: <https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit?gid=1513579546#gid=1513579546&range=A1>
- _(slide 33)_
