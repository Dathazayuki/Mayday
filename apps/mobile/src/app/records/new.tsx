import { ComingSoon } from '@/components/coming-soon';

/**
 * Tạo bệnh án mới tạm ẩn (spec B, mục 13, B2): luồng phân loại + mẫu phiếu đã gỡ (D-B27), form tự khai
 * có kiểu (D-B30) viết lại ở B6. Màn vẫn giữ để các nút "Tạo bệnh án" ở mục tổn thương da không trỏ
 * tới route không tồn tại.
 */
export default function NewRecordScreen() {
  return (
    <ComingSoon
      title="Tạo bệnh án mới"
      description="Sắp có: bạn sẽ tự khai bệnh án mới ngay trên ứng dụng. Trong lúc chờ, nhân viên phòng khám tạo bệnh án cho bạn khi bạn đến khám."
    />
  );
}
