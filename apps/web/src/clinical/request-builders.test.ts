import { buildLabRequest, buildPrescriptionRequest } from './request-builders';

describe('buildPrescriptionRequest', () => {
  it('đổi id sang chuỗi, cắt khoảng trắng và bỏ trường rỗng', () => {
    expect(
      buildPrescriptionRequest(12, {
        note: '  Uống sau ăn ',
        items: [
          { medicine_name: ' Cetirizine ', dosage: '10mg', frequency: '  ', duration: undefined },
        ],
      }),
    ).toEqual({
      medical_record_id: '12',
      note: 'Uống sau ăn',
      items: [{ medicine_name: 'Cetirizine', dosage: '10mg' }],
    });
  });

  it('không gửi note khi trống (sau khi serialize JSON)', () => {
    const body = buildPrescriptionRequest(1, { note: ' ', items: [{ medicine_name: 'A' }] });
    expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('note');
  });
});

describe('buildLabRequest', () => {
  it('gửi test_name, description (bỏ khi trống) và note', () => {
    expect(
      buildLabRequest(5, {
        note: 'Gấp',
        items: [
          { test_name: ' CBC ', description: ' ' },
          { test_name: 'IgE', description: 'Tổng' },
        ],
      }),
    ).toEqual({
      medical_record_id: '5',
      note: 'Gấp',
      items: [{ test_name: 'CBC' }, { test_name: 'IgE', description: 'Tổng' }],
    });
  });
});
