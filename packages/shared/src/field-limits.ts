/**
 * Độ dài tối đa của trường theo cột của CSDL thật (spec A, mục 5.2, 5.6, D13). DTO của API, form Web
 * và Mobile dùng chung. Cột TEXT không giới hạn trong CSDL thì giữ giới hạn API hiện tại.
 */
export const FIELD_LIMITS = {
  /** nguoi.ho_ten VARCHAR(150) */
  full_name: 150,
  /** vaitro.ten_vai_tro VARCHAR(50) */
  role_name: 50,
  /** vaitro.ten_hien_thi VARCHAR(100) */
  role_display_name: 100,
  /** quyenhan.ten_quyen_han VARCHAR(100) */
  permission_name: 100,
  /** chinhanh.ten_chi_nhanh VARCHAR(150) */
  branch_name: 150,
  /** phongkham.ten_phong_kham VARCHAR(150) */
  room_name: 150,
  /** benhnhan.dan_toc VARCHAR(50) */
  ethnic: 50,
  /** nguoi.dia_chi_so_nha_thon_pho VARCHAR(255) */
  hamlet_address: 255,
  /** nguoi.dia_chi_xa_phuong VARCHAR(100) */
  commune_address: 100,
  /** nguoi.dia_chi_tinh_tp VARCHAR(100) */
  city_address: 100,
  /** benhnhan.bhyt_so_the VARCHAR(30) */
  health_insurance_number: 30,
  /** benhnhan.nguoi_nha_ho_ten_dia_chi TEXT: giữ giới hạn API */
  next_of_kin_name: 100,
  /** Cột TEXT lâm sàng (hồ sơ, phiên khám): CSDL không giới hạn, API giữ 2000 ký tự (D-B29, MT-125). */
  clinical_text: 2000,
} as const;
