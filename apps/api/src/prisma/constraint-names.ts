/**
 * Tên ràng buộc mà nhiều repository cùng dựa vào (spec A, mục 4.6; spec B, mục 4.5), để repository này
 * không phải import hằng của repository khác. Ràng buộc chỉ một repository dùng thì đặt hằng ngay trong
 * repository đó. test/db/schema.db-spec.ts kiểm mọi tên có thật trong CSDL.
 */

/** Unique trên biểu thức lower(ten_dang_nhap) (SQL:1289): tài khoản người dùng và bệnh nhân. */
export const LOGIN_UNIQUE = 'uq_tai_khoan_ten_dang_nhap';
