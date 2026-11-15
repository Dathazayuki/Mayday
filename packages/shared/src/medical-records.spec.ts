import {
  MEDICAL_RECORD_ACTIONS,
  MEDICAL_RECORD_STATUSES,
  RECORD_TYPES,
} from './contracts/medical-records.js';
import {
  MEDICAL_RECORD_ACTION_LABELS,
  MEDICAL_RECORD_STATUS_LABELS,
  RECORD_TYPE_LABELS,
} from './medical-records.js';

describe('nhãn bệnh án (spec B, mục 5.7)', () => {
  it('mọi trạng thái có nhãn tiếng Việt, theo thứ tự của CHECK', () => {
    expect(MEDICAL_RECORD_STATUSES.map((status) => MEDICAL_RECORD_STATUS_LABELS[status])).toEqual([
      'Nháp',
      'Chờ tiếp nhận',
      'Đang khám',
      'Hoàn tất',
      'Đã huỷ',
    ]);
  });

  it('loại bệnh án: CAP mày đay cấp, MAN mày đay mạn', () => {
    expect(RECORD_TYPES.map((type) => RECORD_TYPE_LABELS[type])).toEqual([
      'Mày đay cấp',
      'Mày đay mạn',
    ]);
  });

  it('mọi hành động của allowed_actions có nhãn nút (mục 6.4, 8.6)', () => {
    expect(MEDICAL_RECORD_ACTIONS.map((action) => MEDICAL_RECORD_ACTION_LABELS[action])).toEqual([
      'Sửa',
      'Tiếp nhận',
      'Thêm phiên khám',
      'Sửa phiên khám',
      'Hoàn tất',
      'Huỷ',
      'Xoá',
    ]);
  });
});
