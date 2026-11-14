# Từ điển dữ liệu 183 biến lâm sàng (BV Da liễu Trung ương)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: [Google Doc](https://docs.google.com/document/d/1kGWCfqyb7g1yOBE8qmR4P_u1dLlFqjuB); bản chụp `docs/nguon/tu-dien-du-lieu-183-bien.docx`.
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

BẢN ĐẶC TẢ TỪ ĐIỂN DỮ LIỆU Y TẾ ĐA PHƯƠNG THỨC (DATA DICTIONARY SPECIFICATION v2.0)

Dự án: Ứng dụng Trí tuệ nhân tạo Hỗ trợ Chẩn đoán và Quản lý Bệnh Mày đay (Dr May Day)

Đơn vị chủ trì chuyên môn: Bệnh viện Da liễu Trung ương

Phiên bản: v2.0 (Chính thức ban hành ngày 04/09/2026, tích hợp toàn bộ 183 biến số lâm sàng giao diện bác sĩ)

Căn cứ pháp lý và kỹ thuật:

- Quyết định phê duyệt Đề tài cấp Bộ: "Ứng dụng Trí tuệ nhân tạo quản lý bệnh mày đay".

- Văn kiện "Bảng biến: Giao diện Bác sĩ (v2)" 16 trang của Bệnh viện Da liễu Trung ương.

- Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15 và Nghị định 13/2023/NĐ-CP.

- Tiêu chuẩn quốc tế EAACI/GA²LEN/EuroGuiDerm/APAAACI 2021 và hướng dẫn WAO 2020 về phản vệ.

――――――――――――――――――――――――――――――――――――――――――――――――――

I. TỔNG QUAN VÀ NGUYÊN TẮC QUẢN TRỊ DỮ LIỆU

1. Mục tiêu kiến trúc

1. Đồng bộ ngữ nghĩa lâm sàng và kỹ thuật (Semantic Alignment): Chuẩn hóa toàn bộ 183 biến số từ mẫu bệnh án chuyên khoa của Bệnh viện Da liễu Trung ương thành lược đồ cơ sở dữ liệu quan hệ (PostgreSQL) và mô hình dữ liệu NoSQL/JSON, phục vụ trực tiếp cho Web Portal bác sĩ, Mobile App bệnh nhân và hệ thống AI.

2. Loại bỏ rác dữ liệu từ gốc (Data Quality by Design): Ràng buộc kiểu dữ liệu, danh mục mã hóa đóng (controlled vocabulary), kiểm tra tính hợp lệ về logic và ngưỡng số học ngay tại tầng nhập liệu.

3. Phân luồng 4 nguồn thu thập dữ liệu (4-Tier Ingestion): Tối ưu hóa trải nghiệm bác sĩ bằng cơ chế tự động đồng bộ từ HIS (30 biến), nạp trước dữ liệu do bệnh nhân tự báo cáo từ app di động (44 biến), hệ thống tự sinh (2 biến) và phần bác sĩ trực tiếp thăm khám (107 biến).

4. Phục vụ trực tiếp cho chuỗi 7 bài báo khoa học và 3 tầng mô hình AI:

- Tầng cảnh báo an toàn tức thời (Safety Layer Zero-Latency): Động cơ quy tắc xác định (Deterministic Rule Engine) dựa trên cây quyết định WAO/EAACI 2020 phản hồi dưới 30 giây khi có nguy cơ phản vệ hoặc tắc nghẽn đường thở.

- Tầng hỗ trợ ra quyết định lâm sàng (CDSS): Mô hình học máy phân tầng 4 Endotype (CSU Type I tự dị ứng vs CSU Type IIb tự miễn) và khuyến nghị bậc điều trị cá thể hóa.

- Tầng thị giác máy tính: Mô hình học sâu phân vùng sẩn phù, thích ứng tương phản da vàng (Fitzpatrick III/IV) và tính điểm UAS7 liên tục.

2. Nguyên tắc bảo mật và khử định danh (Zero-PII Architecture)

- Giả danh hóa (Pseudonymization): Mọi bản ghi lâm sàng, xét nghiệm và hình ảnh đều được gắn với khóa giả danh patient_uuid (UUIDv4 ngẫu nhiên). Bảng ánh xạ giữa patient_uuid và dữ liệu định danh cá nhân thật (họ tên, số điện thoại, số thẻ BHYT, địa chỉ) được mã hóa AES-256 và lưu trữ độc quyền trên máy chủ cục bộ đặt tại Bệnh viện Da liễu Trung ương.

- Tách biệt môi trường huấn luyện AI: Toàn bộ dữ liệu trích xuất phục vụ huấn luyện mô hình máy học, nghiên cứu khoa học hoặc đối soát ngoài bệnh viện đều được loại bỏ hoàn toàn các trường định danh cấp 1 (A1. Hành chính).

- Tính toàn vẹn theo thời gian: Mọi sự kiện lâm sàng, biến thiên thang đo PROMs và đơn thuốc đều bắt buộc có khóa ngoại encounter_id và mốc thời gian chuẩn hóa ISO 8601 UTC.

――――――――――――――――――――――――――――――――――――――――――――――――――

II. TIÊU CHUẨN LỰA CHỌN VÀ LOẠI TRỪ BỆNH NHÂN

1. Tiêu chuẩn lựa chọn (Inclusion Criteria)

- Bệnh nhân từ 18 tuổi trở lên tại thời điểm ký văn bản đồng thuận tham gia nghiên cứu (ngay_sinh xác nhận tuoi >= 18).

- Được bác sĩ chuyên khoa da liễu chẩn đoán xác định là Mày đay theo hướng dẫn EAACI/GA²LEN 2021:

- Mày đay tự phát mạn tính (CSU): sẩn phù và/hoặc phù mạch tự phát kéo dài từ 6 tuần trở lên (thoi_gian_khoi_phat_tuan >= 6).

- Mày đay cảm ứng mạn tính (CIndU): sẩn phù xuất hiện lặp lại khi có kích thích vật lý đặc hiệu từ 6 tuần trở lên, có kết quả dương tính với ít nhất 1 nghiệm pháp kích thích chuẩn hóa.

- Thể kết hợp CSU kèm CIndU.

- Phù mạch đơn thuần (sau khi đã loại trừ phù mạch di truyền do thiếu hụt C1-INH hoặc do thuốc ức chế men chuyển).

- Bệnh nhân (hoặc người giám hộ hợp pháp) tự nguyện ký Bản đồng thuận tham gia nghiên cứu (Informed Consent Form - ICF).

2. Tiêu chuẩn loại trừ (Exclusion Criteria)

- Bệnh nhân dưới 18 tuổi.

- Tổn thương da dạng sẩn phù nhưng là triệu chứng của các bệnh lý mạch máu hoặc hội chứng toàn thân:

- Viêm mạch mày đay (Urticarial Vasculitis): nốt sẩn tồn tại trên 24 giờ (thoi_gian_ton_tai > 24h), kèm xuất huyết, để lại vết thâm sau lặn, kết quả sinh thiết da có hoại tử mạch bạch cầu.

- Mày đay sắc tố (Mastocytosis / Urticaria Pigmentosa).

- Hội chứng tự viêm toàn thân (Schnitzler syndrome, CAPS, Adult-onset Still disease).

- Phù mạch do thiếu hụt chất ức chế C1-esterase (HAE Typ 1, Typ 2) hoặc phù mạch mắc phải (AAE).

- Phụ nữ đang mang thai hoặc đang cho con bú (đối với nhánh thử nghiệm lâm sàng can thiệp thuốc).

- Bệnh nhân có rối loạn tâm thần nặng hoặc suy giảm nhận thức không thể sử dụng ứng dụng di động để theo dõi PROMs.

――――――――――――――――――――――――――――――――――――――――――――――――――

III. MA TRẬN 183 BIẾN SỐ LÂM SÀNG CHI TIẾT (CHUẨN HÓA THEO 16 PHÂN NHÓM)

Bảng dưới đây chuẩn hóa 100% tên biến, kiểu dữ liệu, danh mục giá trị đóng và nguồn thu thập bám sát bản thiết kế giao diện bác sĩ v2 của Bệnh viện Da liễu Trung ương:

Phân nhóm A0: Mã hồ sơ và phân loại

| STT | Tên biến số | Nhãn hiển thị | Kiểu dữ liệu | Giá trị / Ràng buộc | Nguồn nhập | Ý nghĩa kỹ thuật |
|---|---|---|---|---|---|---|
| 1 | ma_benh_nhan | Mã bệnh nhân * | String | Mã HIS cấp | HIS (tự động) | Khóa định danh quản lý bệnh nhân tại bệnh viện |
| 2 | ma_ho_so | Mã hồ sơ | String | Tự sinh hệ thống | Hệ thống tự sinh | Mã hồ sơ bệnh án điện tử của đề tài, không cho sửa tay |

Phân nhóm A1: Thông tin hành chính

Toàn bộ phân nhóm A1 được tự động trích xuất từ HIS, bác sĩ không cần nhập lại.

| STT | Tên biến số | Nhãn hiển thị | Kiểu dữ liệu | Giá trị / Ràng buộc | Nguồn nhập |
|---|---|---|---|---|---|
| 3 | ho_ten | Họ và tên (in hoa) * | String | Tự động in hoa | HIS (tự động) |
| 4 | ngay_sinh | Sinh ngày | Date | YYYY-MM-DD | HIS (tự động) |
| 5 | gioi_tinh | Giới | Enum | Nam, Nu | HIS (tự động) |
| 6 | so_dien_thoai | Số điện thoại * | String | 10 chữ số | HIS (tự động) |
| 7 | nghe_nghiep | Nghề nghiệp | Enum | Cong nhan, Nong dan, Hoc sinh - Sinh vien, Can bo cong chuc, Khac | HIS (tự động) |
| 8 | dan_toc | Dân tộc | String | Tên dân tộc | HIS (tự động) |
| 9 | dia_chi_so_nha_thon_pho | Địa chỉ: số nhà, thôn/phố | String | Tự do | HIS (tự động) |
| 10 | dia_chi_xa_phuong | Địa chỉ: xã/phường | String | Danh mục hành chính | HIS (tự động) |
| 11 | dia_chi_tinh_tp | Địa chỉ: tỉnh/thành phố | String | Danh mục hành chính | HIS (tự động) |
| 12 | noi_lam_viec | Nơi làm việc | String | Tự do | HIS (tự động) |
| 13 | bhyt_so_the | Số thẻ BHYT | String | Mã BHYT hợp lệ | HIS (tự động) |
| 14 | bhyt_gia_tri_den | BHYT giá trị đến ngày | Date | YYYY-MM-DD | HIS (tự động) |
| 15 | nguoi_nha_ho_ten_dia_chi | Họ tên, địa chỉ người nhà | String | Tự do | HIS (tự động) |
| 16 | nguoi_nha_so_dien_thoai | Số điện thoại người nhà | String | 10 chữ số | HIS (tự động) |
| 17 | thoi_diem_kham_lan_dau | Đến khám lần đầu lúc | DateTime | ISO 8601 | HIS (tự động) |
| 18 | ngay_bat_dau_dieu_tri_ngoai_tru | Điều trị ngoại trú từ ngày | Date | YYYY-MM-DD | HIS (tự động) |
| 19 | ngay_ket_thuc_dieu_tri_ngoai_tru | Điều trị ngoại trú đến ngày | Date | YYYY-MM-DD | HIS (tự động) |

Phân nhóm A2: Chẩn đoán tuyến trước và bảo hiểm

| STT | Tên biến số | Nhãn hiển thị | Kiểu dữ liệu | Giá trị / Ràng buộc | Nguồn nhập |
|---|---|---|---|---|---|
| 20 | chan_doan_tuyen_truoc | Chẩn đoán tuyến trước | String | Tự do | App BN (BS sửa) |
| 21 | chan_doan_ban_dau_phong_kham | Chẩn đoán phòng khám ban đầu | String | Tự do | App BN (BS sửa) |
| 22 | chan_doan_tai_kham | Chẩn đoán tái khám (lần 1-4) | Array[Object] | Lần tái khám (1-4) và Chuỗi chẩn đoán | Bác sĩ nhập |
| 23 | benh_phu | Bệnh phụ | String | Bệnh lý đồng mắc | Bác sĩ nhập |
| 24 | ket_qua_dieu_tri_bao_hiem | Kết quả điều trị cuối đợt bảo hiểm | Enum | Khoi benh, Do, Khong do, Nang hon, Chet, Bien chung | Bác sĩ nhập |

Phân nhóm B1: Lưu trữ mẫu và phiên khám

| STT | Tên biến số | Nhãn hiển thị | Kiểu dữ liệu | Giá trị / Ràng buộc | Nguồn nhập |
|---|---|---|---|---|---|
| 25 | ngay_kham | Ngày khám | Date | YYYY-MM-DD | HIS (tự động) |
| 26 | bac_si_kham | Bác sĩ khám | String | Tên tài khoản bác sĩ | Hệ thống tự sinh |
| 27 | luu_huyet_thanh | Lưu huyết thanh | Enum | Co, Khong | Bác sĩ nhập |

Phân nhóm 2.1: Thời gian diễn biến và điều khiển hiển thị

| STT | Tên biến số | Nhãn hiển thị | Kiểu dữ liệu | Giá trị / Ràng buộc | Nguồn nhập |
|---|---|---|---|---|---|
| 28 | thoi_gian_khoi_phat_tuan | Thời gian khởi phát bệnh (tuần) | Integer | Số tuần (>= 0) | App BN (BS sửa) |
| 29 | bieu_hien_qua_trinh_benh | Biểu hiện trong quá trình bệnh | Enum | Chi san phu, Chi phu mach, San phu + phu mach | App BN (BS sửa) |

Phân nhóm 2.2: Đặc điểm sẩn phù (Kích hoạt khi biến 29 có sẩn phù)

| STT | Tên biến số | Nhãn hiển thị | Kiểu dữ liệu | Giá trị / Ràng buộc | Nguồn nhập |
|---|---|---|---|---|---|
| 30 | hien_tai_co_san_phu | Hiện tại có sẩn phù | Enum | Co, Khong | App BN (BS sửa) |
| 31 | anh_san_phu | Ảnh sẩn phù (Có/Không) | FileRef/Flag | Cờ có tệp đính kèm (chi tiết ảnh quản lý riêng) | App BN (BS sửa) |
| 32 | hoan_canh_xuat_hien_san_phu | Hoàn cảnh xuất hiện sẩn phù | Enum | Ngẫu nhiên; Kích thích cơ học/nhiệt/vật lý; Cả hai | App BN (BS sửa) |
| 33 | uu_the_san_phu_va_phu_mach | Trường hợp ưu thế khi chọn cả hai | Multi-Enum | Ngẫu nhiên (số tuần); Kích thích (số tuần); Tương đương; Không rõ | App BN (BS sửa) |
| 34 | dac_diem_san_phu_khong_dung_thuoc | Đặc điểm tổn thương khi KHÔNG dùng thuốc | Array[Object] | Dạng tổn thương, Kích thước (<=5mm, >5mm), Thời gian tồn tại (<1h, 1-2h, 2-6h, 6-12h, 12-24h, >24h), Thời điểm (Sáng, Trưa, Chiều, Tối, Đêm, Không cố định) | App BN (BS sửa) |
| 35 | dac_diem_san_phu_co_dung_thuoc | Đặc điểm tổn thương khi CÓ dùng thuốc | Array[Object] | Cấu trúc ma trận tương tự mục 34 | App BN (BS sửa) |
| 36 | vi_tri_san_phu | Vị trí sẩn phù | Enum | Khap co the, Vi tri dac biet, Khong ro | App BN (BS sửa) |
| 37 | yeu_to_lam_nang_sa_phu | Yếu tố làm nặng sẩn phù | Enum | Khong co, Stress, Kinh nguyet, Nhiem trung, NSAIDs, Thuc an, Thuoc khac, Khac | App BN (BS sửa) |
| 38 | danh_gia_muc_do_hoat_dong_benh | Đánh giá mức độ hoạt động (UAS7/ISS7/HSS7) | Array[Object] | Bảng 3 dòng (UAS7 /42, ISS7, HSS7) x 3 cột (Không thuốc, Dùng đều, Dùng không đều) | Hệ thống/BS |

Phân nhóm 2.3: Đặc điểm phù mạch (Kích hoạt khi biến 29 có phù mạch)

| STT | Tên biến số | Nhãn hiển thị | Kiểu dữ liệu | Giá trị / Ràng buộc | Nguồn nhập |
|---|---|---|---|---|---|
| 39 | trong_dot_co_phu_mach | Trong đợt bệnh này có phù mạch | Enum | Co, Khong | App BN (BS sửa) |
| 40 | hien_tai_co_phu_mach | Hiện tại có phù mạch | Enum | Co, Khong | App BN (BS sửa) |
| 41 | anh_phu_mach | Ảnh phù mạch (Có/Không) | FileRef/Flag | Cờ tệp đính kèm | App BN (BS sửa) |
| 42 | hoan_canh_xuat_hien_phu_mach | Hoàn cảnh xuất hiện phù mạch | Enum | Ngẫu nhiên; Tì đè; Sau ngủ dậy; Lạnh; Thuốc NSAIDs/ACEi/Opioids; Khác | App BN (BS sửa) |
| 43 | vi_tri_phu_mach | Vị trí phù mạch và bên phù mạch | Multi-Enum | Mi mắt; Lưỡi; Môi; Mặt; Thanh quản (Cờ đỏ); Bàn tay; Bàn chân; Sinh dục; Vị trí khác; Một bên; Hai bên | App BN (BS sửa) |
| 44 | tan_suat_va_muc_do_nang_phu_mach | Tần suất và mức độ nặng | Object | Số lần phù mạch đợt này; Số lần phải đến viện | App BN (BS sửa) |
| 45 | thoi_gian_ton_tai_phu_mach | Thời gian tồn tại trung bình | Array[Object] | Bảng 2 dòng (Không thuốc, Có thuốc) x 8 cột thời gian (<1h, 1-6h, 6-12h, 12-24h, 24-48h, 48-72h, >72h, Khác) | App BN (BS sửa) |
| 46 | moi_lien_quan_san_phu_va_phu_mach | Mối liên quan sẩn phù và phù mạch | Multi-Enum | Sẩn phù trước; Phù mạch trước; Đồng thời; Trong 3 tháng; 4-12 tháng; Sau 1 năm; Không rõ | App BN (BS sửa) |
| 47 | phu_mach_1_tuan_gan_day | Trong 1 tuần gần đây có phù mạch | Enum | Co, Khong | App BN (BS sửa) |
| 48 | aas7_diem | Điểm hoạt lực phù mạch AAS7 (/105) | Integer | 0 đến 105 | Bác sĩ nhập |

Phân nhóm 2.4: Test kích thích đặc hiệu CIndU (Biến 49 đến 97)

Bao gồm 4 biến chuẩn bị ngừng thuốc và 7 nhóm nghiệm pháp kích thích chuẩn hóa:

- Chuẩn bị ngừng thuốc (49-52): ngung_khang_histamine_truoc_test (Co/Khong), thoi_gian_ngung_khang_histamine (ngay), ngung_corticoid_truoc_test (Co/Khong), thoi_gian_ngung_corticoid (ngay).

- Test da vẽ nổi FricTest (53-57): da_ve_noi_ket_qua (Duong tinh/Am tinh), fric_score (diem), da_ve_noi_ngua_nrs (0-10), da_ve_noi_dau_nrs (0-10), da_ve_noi_bong_rat_nrs (0-10).

- Mày đay cholinergic gắng sức (58-62): may_day_cholin_kq (Duong tinh/Am tinh), thoi_gian_xuat_hien_ton_thuong (phut), cholin_ngua_nrs (0-10), cholin_dau_nrs (0-10), cholin_bong_rat_nrs (0-10).

- Mày đay do nóng TempTest (63-67): may_day_nong_temptest_kq (Duong tinh/Am tinh), nguong_nhiet_do_nong (do C), nong_ngua_nrs, nong_dau_nrs, nong_bong_rat_nrs.

- Mày đay do lạnh TempTest (68-72): may_day_lanh_temptest_kq (Duong tinh/Am tinh), vung_nhiet_do_duong_tinh (do C), temptest_ngua_nrs, temptest_dau_nrs, temptest_bong_rat_nrs.

- Mày đay do lạnh test cục đá (73-77): may_day_lanh_test_cuc_da_kq (Duong tinh/Am tinh), nguong_thoi_gian (phut), test_cuc_da_ngua_nrs, test_cuc_da_dau_nrs, test_cuc_da_bong_rat_nrs.

- Mày đay áp lực chậm treo tạ (78-82): may_day_ap_luc_cham_kq (Duong tinh/Am tinh), nguong_ap_luc (kg), ap_luc_ngua_nrs, ap_luc_dau_nrs, ap_luc_bong_rat_nrs.

- Mày đay do ánh sáng UVA/UVB (83-87): may_day_anh_sang_kq (Duong tinh/Am tinh), buoc_song_duong_tinh (nm), anh_sang_ngua_nrs, anh_sang_dau_nrs, anh_sang_bong_rat_nrs.

- Mày đay do nước (88-92): may_day_nuoc_kq (Duong tinh/Am tinh), thoi_gian_xuat_hien_nuoc (phut), nuoc_ngua_nrs, nuoc_dau_nrs, nuoc_bong_rat_nrs.

- Căn nguyên khác (93-97): can_nguyen_khac_ten, can_nguyen_khac_test_kq, can_nguyen_khac_ngua_nrs, can_nguyen_khac_dau_nrs, can_nguyen_khac_bong_rat_nrs.

Phân nhóm 2.5: Thang đo PROMs (Biến 98 đến 102)

- 98: uct_diem (UCT /16, cat-off >= 12: kiem soat tot).

- 99: aect_diem (AECT /16, kiem soat phu mach).

- 100: act_diem_legacy (diem ACT cu tren app, phuc vu tuong thich nguoc).

- 101: dlqi_diem (DLQI /30, chat luong cuoc song da lieu tong quat).

- 102: cu_q2ol_diem (CU-Q2oL, chat luong cuoc song chuyen biet may day man).

Phân nhóm 3.1: Bệnh sử các đợt bệnh trước (Biến 103 đến 111)

- 103: tung_co_dot_tuong_tu (Co, Khong, Khong ro).

- 104: tuoi_khoi_phat (so tuoi).

- 105: so_dot_truoc (so dot).

- 106: kieu_dien_bien (Lien tuc, Tung dot, Khong ro).

- 107: bieu_hien_dot_truoc (San phu, Phu mach, San phu + phu mach).

- 108: da_tung_nhap_vien (Co, Khong, Khong ro).

- 109: so_lan_nhap_vien (so lan).

- 110: thoi_gian_tu_dot_gan_nhat (chuoi mo ta).

- 111: dien_bien_cac_dot_truoc (van ban dai).

Phân nhóm 3.2: Điều trị trước đó (Biến 112 đến 113)

- 112: da_dieu_tri_truoc_kham (Co, Khong, Khong ro).

- 113: dieu_tri_truoc_do (Bang lap: Ten thuoc, Lieu dung, Thoi gian dung, Tuan thu, Dap ung dieu tri).

Phân nhóm 3.3: Tiền sử bản thân (Biến 114 đến 127)

- 114-115: tien_su_co_dia, tien_su_co_dia_ghi_ro (Viem da co dia, Hen, Viem mui di ung).

- 116-117: tien_su_tuyen_giap, tien_su_tuyen_giap_ghi_ro.

- 118-119: tien_su_tu_mien, tien_su_tu_mien_ghi_ro (Lupus, viem khop tu mien).

- 120-121: tien_su_di_ung, tien_su_di_ung_ghi_ro (Tach thuoc, thuc an, di nguyen khac).

- 122-123: tien_su_phan_ve, tien_su_phan_ve_ghi_ro (Co do nguy co so phan ve).

- 124-125: tien_su_viem_nhiem_man, tien_su_viem_nhiem_man_ghi_ro (HP, viem gan B/C, o viem man).

- 126-127: tien_su_benh_khac, tien_su_benh_khac_ghi_ro.

Phân nhóm 3.4: Tiền sử gia đình (Biến 128 đến 129)

- 128: tien_su_gia_dinh (Co, Khong, Khong ro).

- 129: tien_su_gia_dinh_ghi_ro (Thanh vien, Benh ly, Dien bien).

Phân nhóm 4: Khám thực thể (Biến 130 đến 136)

- 130-131: sot (Co/Khong), sot_nhiet_do_c (do C).

- 132: mach (lan/phut).

- 133-134: huyet_ap_tam_thu (mmHg), huyet_ap_tam_truong (mmHg).

- 135-136: bat_thuong_co_quan_khac (Co/Khong), bat_thuong_co_quan_khac_ghi_ro.

Phân nhóm 5: Cận lâm sàng (Biến 137 đến 156)

- Xét nghiệm tự miễn chuyên biệt (Bác sĩ nhập):

- 137-138: test_huyet_thanh_tu_than (Duong tinh, Am tinh, Chua lam), asst_duong_kinh_mm (mm).

- 139: bat_ket_qua (Basophil Activation Test: Duong tinh, Am tinh, Chua lam).

- 140: ige_khang_tpo_ket_qua (Duong tinh, Am tinh, Chua lam).

- 141: ige_khang_il24_ket_qua (Duong tinh, Am tinh, Chua lam).

- 142: can_lam_sang_khac_ghi_chu (van ban dai).

- Xét nghiệm định lượng thường quy (Tự động từ HIS):

- 143: wbc (G/L - Tong bach cau).

- 144: eo (G/L - Bach cau ai toan tuyet doi).

- 145: ba_bach_cau (G/L - Bach cau ai kiem Basophil tuyet doi).

- 146: crp (mg/L).

- 147-148: mau_lang_1h, mau_lang_2h (mm).

- 149-151: ft3 (pmol/L), ft4 (pmol/L), tsh (micro-IU/mL).

- 152: ige_toan_phan (IU/mL).

- 153: anti_tpo (IU/mL - Dinh luong).

- 154: ana_hep2 (Duong tinh, Am tinh).

- 155: sieu_am_tuyen_giap (mo ta hinh thai).

- 156: xet_nghiem_khac (van ban).

Phân nhóm 6: Chẩn đoán xác định (Biến 157 đến 160)

- 157: chan_doan_chinh (CSU, CIndU, CSU + CIndU, Phu mach don thuan).

- 158: phan_nhom_csu (CSU Type I, CSU Type IIb, Chong lap Type I + Type IIb, Khong xac dinh).

- 159: phan_nhom_cindu_chinh (Da ve noi, Cholinergic, Do lanh).

- 160: phan_nhom_cindu_khac (Adrenergic, Anh sang, Do nong, Do nuoc).

Phân nhóm 7: Điều trị (Biến 161 đến 179)

- 161: nhom_dieu_tri (Khang histamine H1 TH2, Dieu tri sinh hoc/dich, Uc che mien dich, Corticosteroid toan than, Dieu tri khac).

- 162-164: Kháng histamine H1 (khang_histamine_ten_thuoc, lieu_dung, thoi_gian_dung).

- 165-167: Thuốc sinh học / đích (sinh_hoc_dich_loai: Omalizumab, Dupilumab, Remibrutinib, Khác; liều; thời gian).

- 168-170: Thuốc ức chế miễn dịch (uc_che_mien_dich_loai: Cyclosporin A, Khác; liều; thời gian).

- 171-173: Corticosteroid toàn thân (corticosteroid_ten_thuoc, liều, thời gian).

- 174-176: Điều trị khác (dieu_tri_khac_ten_thuoc, liều, thời gian).

- 177: ghi_chu_dieu_tri.

- 178-179: ngung_thuoc_lan_sau (Khong, Co) và ngung_thuoc_bang (Thuoc can ngung, Ngung tu ngay, Thoi gian ngung ngay, Muc dich wash-out).

Phân nhóm 8: Hẹn khám lại (Biến 180)

- 180: ngay_hen_tai_kham (Date - YYYY-MM-DD).

Phân nhóm 9: Tóm tắt và Dặn dò (Biến 181 đến 183)

- 181: tom_tat_buoi_kham (Ghi chu noi bo bac si).

- 182: huong_xu_tri_lan_sau (Ke hoach chuyen mon cho phien sau).

- 183: dan_do (Noi dung hien thi truc tiep cho benh nhan tren app).

――――――――――――――――――――――――――――――――――――――――――――――――――

IV. ĐẶC TẢ TẦNG HÌNH ẢNH LÂM SÀNG VÀ RÀNG BUỘC KỸ THUẬT

1. Phạm vi thể hiện trên Bệnh án Lâm sàng v2

Trong bảng 183 biến số giao diện bác sĩ, dữ liệu hình ảnh được quản lý qua 2 cờ liên kết tệp:

- Biến 31: anh_san_phu (Cờ tệp ảnh sẩn phù).

- Biến 41: anh_phu_mach (Cờ tệp ảnh phù mạch).

2. Tách biệt đặc tả kỹ thuật hình ảnh chuyên sâu

Để phục vụ huấn luyện mô hình thị giác máy tính cho Bài 4 (Học sâu sẩn phù Q1 IEEE JBHI), tầng hình ảnh được tách thành tài liệu đặc tả kỹ thuật chuyên sâu riêng, bao gồm các ràng buộc:

1. Giao thức 3 góc chụp chuẩn hóa: Ảnh toàn cảnh (xác định phân bố giải phẫu), ảnh trung cảnh (đánh giá cụm tổn thương) và ảnh cận cảnh (định danh viền sẩn phù và phù mạch).

2. Vật đối chuẩn hình học và trắc diện màu: Đặt thẻ màu chuẩn (Color-checker) và thước đo milimet đối chuẩn cạnh tổn thương để tính diện tích thực tế (mm2).

3. Cổng kiểm soát chất lượng ảnh tại rìa (Edge-CV Quality Gate):

- Đánh giá độ mờ (Blur score) bằng phương sai toán tử Laplacian (ngưỡng chấp nhận > 100.0).

- Kiểm tra ngưỡng chiếu sáng (Illumination status) loại bỏ ảnh chói lóa hoặc thiếu sáng trầm trọng.

4. Phân bổ đa dạng màu da chống thiên vị (Skin Tone Fairness): Tối thiểu 70% tuýp da Fitzpatrick III và 25% Fitzpatrick IV của người Việt Nam.

5. Nhãn đối chứng chuẩn: Bắt buộc tối thiểu 5% ảnh da lành đối chứng (NORMAL_SKIN) và 10% ảnh chẩn đoán phân biệt (ERYTHEMA_MULTIFORME, chàm, viêm da tiếp xúc).

――――――――――――――――――――――――――――――――――――――――――――――――――

V. TÍCH HỢP VỚI ĐỘNG CƠ CẢNH BÁO AN TOÀN VÀ HỆ THỐNG CDSS

1. Bảng Chân trị Cảnh báo Phản vệ Thời gian thực (WAO/EAACI Safety Truth Table)

Hệ thống chuyên gia xác định (Deterministic Rule Engine) chạy song song tại thiết bị người dùng và máy chủ, quét liên tục dữ liệu từ biến 43 (phù thanh quản), biến 122 (tiền sử phản vệ) và biến 133-134 (huyết áp tụt) để kích hoạt báo động khẩn cấp:

| Trường hợp | Tiêu chí kích hoạt lâm sàng | Cấp độ báo động | Hành động tự động của hệ thống |
|---|---|---|---|
| Tiêu chuẩn 1 | Có tổn thương sẩn phù hoặc phù mạch (biến 30, 39, 43) KÈM THEO biến 43 = Thanh quan (khó thở, rít thanh quản) HOẶC biến 133-134 có tụt huyết áp | CRITICAL_ALERT (Tầng 2) | Hiển thị cảnh báo tối khẩn cấp, kích hoạt nút gọi 115, hướng dẫn tư thế nằm đầu thấp chân cao, tự tiêm Adrenaline nếu có |
| Tiêu chuẩn 2 | Xuất hiện từ 2 cơ quan trở lên sau tiếp xúc dị nguyên nghi ngờ: (a) Da/niêm mạc; (b) Hô hấp; (c) Tim mạch/tụt huyết áp; (d) Tiêu hóa đau bụng quặn | RED_ALERT (Tầng 1) | Cảnh báo đỏ khẩn cấp, chỉ định đến ngay cơ sở y tế gần nhất |
| Tiêu chuẩn 3 | Tụt huyết áp đơn độc sau tiếp xúc dị nguyên đã biết dị ứng từ trước | CRITICAL_ALERT (Tầng 2) | Chỉ định cấp cứu lập tức |
| Tiêu chuẩn 4 | Tiền sử phản vệ nặng (biến 122 = Co) KÈM sẩn phù lan nhanh dưới 30 phút | EARLY_WARNING | Cảnh báo nguy cơ cao, chuyển trạng thái giám sát chu kỳ 5 phút |

2. Thuật toán CDSS Phân tầng 4 Endotype (Cá thể hóa điều trị)

Mô hình Tabular ML (CatBoost/XGBoost) kết hợp luật chuyên gia giải thích được (XAI) sử dụng các biến số cận lâm sàng để phân loại tự động và đối chiếu với biến 158 (phan_nhom_csu):

- CSU Type I (Autoallergic CSU): Đặc trưng bởi IgE toàn phần cao (biến 152 > 100 IU/mL), IgE kháng TPO dương tính (biến 140 = Duong tinh), số lượng bạch cầu ái toan và ái kiềm máu ngoại vi bảo tồn (biến 144, 145 bình thường), ASST âm tính (biến 137 = Am tinh). Đáp ứng nhanh và hoàn toàn với Omalizumab liều chuẩn.

- CSU Type IIb (Autoimmune CSU): Đặc trưng bởi ASST dương tính (biến 137 = Duong tinh), BAT dương tính (biến 139 = Duong tinh), Anti-TPO định lượng cao (biến 153 tăng cao), giảm bạch cầu ái toan và ái kiềm nặng (Eosinopenia, Basopenia), IgE toàn phần thấp. Nhóm này thường kém đáp ứng với Omalizumab và cần chuyển bậc sớm sang Cyclosporin A (biến 168).

- Chồng lấp CSU Type I + Type IIb: Tồn tại đồng thời cả tự kháng thể IgE và IgG kích hoạt tế bào mast.

- Mày đay cảm ứng mạn tính (CIndU): Định danh chính xác thể bệnh qua 7 nhóm nghiệm pháp vật lý từ biến 53 đến 97.
