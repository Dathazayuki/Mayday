import { toCreateRecordRequest } from './create-record-request';

describe('toCreateRecordRequest (spec B, mục 8.4)', () => {
  it('chỉ bệnh nhân và loại: không gửi first_visit_at (API ghi thời điểm tạo, D-B9), không có self_report', () => {
    expect(toCreateRecordRequest({ patient_id: 7, record_type: 'MAN' })).toEqual({
      patient_id: 7,
      record_type: 'MAN',
    });
    expect(
      JSON.stringify(
        toCreateRecordRequest({
          patient_id: 7,
          record_type: 'CAP',
          first_visit_at: null,
          referral_diagnosis: '   ',
          initial_clinic_diagnosis: '',
        }),
      ),
    ).toBe('{"patient_id":7,"record_type":"CAP"}');
  });

  it('đủ ô: thời điểm ISO, khối self_report đã cắt khoảng trắng', () => {
    expect(
      toCreateRecordRequest({
        patient_id: 7,
        record_type: 'CAP',
        first_visit_at: { toISOString: () => '2026-11-16T01:30:00.000Z' },
        referral_diagnosis: '  Mày đay cấp  ',
        initial_clinic_diagnosis: 'Dị ứng thức ăn',
      }),
    ).toEqual({
      patient_id: 7,
      record_type: 'CAP',
      first_visit_at: '2026-11-16T01:30:00.000Z',
      self_report: {
        referral_diagnosis: 'Mày đay cấp',
        initial_clinic_diagnosis: 'Dị ứng thức ăn',
      },
    });
  });
});
