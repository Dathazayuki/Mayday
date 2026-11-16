# Kịch bản demo DrMayDay (5 đến 10 phút)

Dựng bộ demo theo [README.md](README.md) trước. Mở sẵn: Web ở `http://localhost:8080` (hai cửa sổ ẩn danh hoặc hai trình duyệt để đổi vai trò nhanh) và Expo Go trên điện thoại đã đăng nhập sẵn màn hình đăng nhập của app. Tài khoản và mật khẩu: xem bảng "Tài khoản demo" ở README. Mỗi bước dưới đây chỉ dùng các màn hình đã có trên `main`.

Thời lượng gợi ý: Admin 2 phút, Bác sĩ 5 đến 6 phút, Bệnh nhân 2 phút.

## 1. Admin: quản trị hệ thống (khoảng 2 phút)

Đăng nhập `0900000001` / `admin123`.

1. **Menu bên trái.** Lời dẫn: "Admin thấy thêm nhóm Quản trị hệ thống; bác sĩ và điều dưỡng chỉ thấy Khám và điều trị."
2. **Người dùng** (`/admin/users`). Cho thấy danh sách tài khoản nhân viên và bệnh nhân, bộ lọc theo vai trò, trạng thái hoạt động. Nút "Thêm nhân viên" mở form tạo tài khoản mới (không cần tạo thật, chỉ mở rồi đóng). Lời dẫn: "Tài khoản bác sĩ, điều dưỡng do admin cấp."
3. **Vai trò và quyền hạn** (`/admin/roles`). Cho thấy 4 vai trò hệ thống và quyền gán cho từng vai trò: bác sĩ có đủ quyền khám, điều dưỡng (đóng vai lễ tân) chỉ tiếp nhận, không khám. Lời dẫn: "Phân quyền theo vai trò, thay đổi có hiệu lực ngay."
4. **Cơ sở vật chất** (`/admin/facilities`). Cho thấy chi nhánh và các phòng khám; phòng này được chọn khi tạo phiên khám.
5. Đăng xuất (menu người dùng ở thanh trên cùng, mục "Đăng xuất") để sang vai trò bác sĩ.

## 2. Bác sĩ: khám và điều trị (khoảng 5 đến 6 phút)

Đăng nhập `0900000002` / `demo1234` (BÁC SĨ MẪU).

1. **Tổng quan** (`/`). Ba ô số liệu: Chờ tiếp nhận, Đang khám, Hoàn tất, kèm dòng phụ Nháp và Đã huỷ; bấm một ô để sang bảng bệnh án đã lọc theo trạng thái đó. Dưới là "Phiên khám hôm nay" và "Bệnh án tôi phụ trách". Lời dẫn: "Bác sĩ vào là thấy ngay việc của mình hôm nay."
2. **Bảng cột bệnh án** (`/medical-records`, mặc định chế độ cột). Các cột Chờ tiếp nhận, Đang khám, Hoàn tất đầy đủ; bật "Tôi phụ trách" để chỉ còn việc của mình, bật "Hiện bệnh án đã huỷ" để xem cột đã huỷ, lọc theo loại bệnh án (cấp tính, mạn tính).
3. **Kéo thả đổi trạng thái.** Kéo một thẻ ở cột "Chờ tiếp nhận" sang "Đang khám": hiện **hộp xác nhận** Tiếp nhận (không đổi trạng thái cho đến khi bấm "Tiếp nhận"). Lời dẫn: "Mọi chuyển trạng thái đều có hộp xác nhận, tránh kéo nhầm." Cho thấy kéo sang ô không hợp lệ thì không được thả. Có thể bấm Huỷ ở hộp để giữ nguyên dữ liệu mẫu.
4. **Chuyển dạng bảng.** Ở góc trên phải, chuyển "Chế độ xem" sang Bảng: danh sách có phân trang, lọc theo trạng thái. Chuyển lại dạng cột nếu cần.
5. **Chi tiết bệnh án.** Bấm một thẻ của bệnh nhân "BỆNH NHÂN MẪU MỘT" (bệnh án mạn tính đang khám): mở `/medical-records/<mã>`. Đi qua các khối: thông tin bệnh nhân, phần tự khai, thông tin lâm sàng, và các nút theo trạng thái (Tiếp nhận / Thêm phiên khám / Hoàn tất / Huỷ). Lời dẫn: "Chỉ hiện các nút hợp lệ với trạng thái hiện tại."
6. **Phiên khám.** Ở khối "Phiên khám" xem các lần khám trước (phòng, bác sĩ, ngày, dặn dò, ngày hẹn tái khám); bấm "Thêm phiên khám" để mở form phiên mới (chọn phòng, nhập triệu chứng/điểm AAS7...), điền nhanh rồi lưu hoặc đóng.
7. **Tạo bệnh án mới.** Về `/medical-records`, bấm "Tạo bệnh án": tìm bệnh nhân (theo tên hoặc số điện thoại, ví dụ `0900000005`), chọn loại bệnh án, nhập giờ đến khám lần đầu và chẩn đoán tuyến trước, bấm tạo. Bệnh án mới xuất hiện ở bảng cột.
8. Có thể bấm "Bệnh nhân" ở menu để cho thấy danh sách và trang chi tiết bệnh nhân (các bệnh án của họ).

Mẹo nếu cần chuyển vai: đăng nhập `0900000003` (điều dưỡng) cho thấy cùng màn hình nhưng không có nút khám.

## 3. Bệnh nhân trên Expo Go (khoảng 2 phút)

Trên điện thoại, đăng nhập `0900000004` / `demo1234` (BỆNH NHÂN MẪU MỘT).

1. **Đăng nhập.** Màn hình "DrMayDay: Theo dõi bệnh mề đay mỗi ngày", nhập số điện thoại và mật khẩu.
2. **Trang chủ và thanh tab.** Màn "Xin chào, <họ tên>" với các mục Hồ sơ cá nhân, Đổi mật khẩu, Đăng xuất; thanh tab gồm trang chủ, UAS7, tổn thương da, bệnh án, thông báo. Lời dẫn: "Đây là app dành cho người bệnh."
3. **Tab "Bệnh án".** Danh sách bệnh án của chính bệnh nhân này (2 bệnh án mạn tính, trạng thái khác nhau): mỗi dòng có mã, loại, ngày và trạng thái. Bấm vào một bệnh án để xem chi tiết: loại bệnh án, ngày khám, bác sĩ phụ trách và dặn dò của bác sĩ (nếu đã hoàn tất).
4. Quay lại Web, đăng nhập bác sĩ, mở cùng bệnh nhân để cho thấy cùng một dữ liệu hai phía (bác sĩ ghi, bệnh nhân xem).

Lưu ý khi trình bày: màn "tạo bệnh án" trong app hiện là "Đang phát triển" (xem mục cuối); các tab UAS7, tổn thương da, thông báo chỉ cho xem lướt. Ảnh/tệp đính kèm (kể cả chụp ảnh tổn thương da) không dùng được vì bộ demo không có MinIO.

## Sau khi lát B6 vào (chưa có, không trình diễn)

Lát B6 (bệnh nhân tự khai trên mobile) **chưa có trên `main`**, nên các bước dưới đây chưa demo được. Khi B6 được gộp, thêm vào kịch bản (sau mục 3) và cập nhật lại tài liệu này:

- Bệnh nhân **tạo phần tự khai** của bệnh án ngay trên app (nút tạo bệnh án hiện đang là "Đang phát triển");
- Bệnh nhân **sửa phần tự khai** khi hồ sơ còn ở trạng thái cho phép;
- Bệnh nhân **tự huỷ hồ sơ chưa tiếp nhận**;
- Bác sĩ thấy hồ sơ vừa tự khai ở cột "Chờ tiếp nhận" và **tiếp nhận** nó (khép vòng bệnh nhân khai, bác sĩ khám);
- Dữ liệu mẫu: bệnh nhân `0900000005` đã có sẵn một bệnh án tự khai ở trạng thái chờ tiếp nhận để minh hoạ.
