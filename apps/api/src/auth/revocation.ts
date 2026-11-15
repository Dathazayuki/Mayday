/**
 * Mốc thu hồi token (spec A, mục 6.2, quyết định 9, D8). Trigger `trg_taikhoan_cap_nhat` ghi
 * `taikhoan.thoi_diem_cap_nhat` ở mọi UPDATE (đổi mật khẩu, khoá, mở khoá, đổi vai trò); token phát
 * trước mốc đó bị từ chối. So theo mili giây.
 */
export function isRevokedBy(iatSeconds: number, accountUpdatedAt: Date): boolean {
  return iatSeconds * 1000 < accountUpdatedAt.getTime();
}

/**
 * `iat` khi đăng nhập = max(giây hiện tại, làm tròn lên của mốc): đăng nhập ngay sau thay đổi, trong
 * cùng giây, hoặc khi đồng hồ CSDL chạy nhanh hơn API, thì token mới không bị chính mốc đó thu hồi.
 */
export function issuedAtFor(nowMs: number, accountUpdatedAt: Date): number {
  return Math.max(Math.floor(nowMs / 1000), Math.ceil(accountUpdatedAt.getTime() / 1000));
}
