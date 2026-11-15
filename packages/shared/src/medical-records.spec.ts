import { MEDICAL_RECORD_STATUSES } from './contracts/medical-records.js';
import { MEDICAL_RECORD_STATUS_LABELS } from './medical-records.js';

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
});
