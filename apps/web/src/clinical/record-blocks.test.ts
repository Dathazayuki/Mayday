import { acuteDetails, chronicDetails, chronicVisit } from '../test/clinical-fixture';
import { medicalRecord } from '../test/medical-record-fixture';
import { initialFormValues } from './clinical-form';
import {
  recordCoreBlock,
  recordTypeBlock,
  selfReportBlock,
  visitBlocks,
  visitChanges,
} from './record-blocks';

const keys = (block: { fields: readonly { key: string }[] }) =>
  block.fields.map((field) => field.key);

describe('record-blocks: khối của màn chi tiết (spec B, mục 8.7)', () => {
  it('"Bệnh nhân tự khai": hồ sơ CAP không có biểu hiện bệnh (D-B31), MAN có đủ 4 trường', () => {
    expect(keys(selfReportBlock(medicalRecord({ record_type: 'CAP' })))).toEqual([
      'referral_diagnosis',
      'initial_clinic_diagnosis',
      'onset_weeks',
    ]);
    const chronic = selfReportBlock(medicalRecord({ record_type: 'MAN' }));
    expect(chronic.path).toBe('self_report');
    expect(keys(chronic)).toContain('disease_manifestation');
  });

  it('"Hồ sơ": first_visit_at của hồ sơ + lõi trong details, ở cấp cao nhất của body', () => {
    const block = recordCoreBlock(
      medicalRecord({ first_visit_at: '2026-11-15T01:00:00.000Z' }),
      chronicDetails(),
    );
    expect(block.path).toBeNull();
    expect(block.values).toMatchObject({
      first_visit_at: '2026-11-15T01:00:00.000Z',
      family_history: 'Co',
    });
  });

  it('khối theo loại: CAP → acute, MAN → chronic', () => {
    expect(recordTypeBlock('CAP', acuteDetails()).path).toBe('acute');
    expect(recordTypeBlock('MAN', chronicDetails()).path).toBe('chronic');
  });

  it('phiên của nhân viên: lõi (ngày khám, hẹn, dặn dò + details) và khối theo loại', () => {
    const [core, chronic] = visitBlocks(chronicVisit(), 'MAN');
    expect(core?.values).toMatchObject({
      visit_date: '2026-11-16',
      instructions: 'Uống thuốc đúng giờ',
      visit_summary: 'Đỡ ngứa',
    });
    expect(chronic?.path).toBe('chronic');
  });

  it('phiên dạng cho bệnh nhân (details null, D-B21): chỉ ngày khám, ngày hẹn, dặn dò', () => {
    const blocks = visitBlocks(chronicVisit({ details: null }), 'MAN');
    expect(blocks).toHaveLength(1);
    expect(keys(blocks[0]!)).toEqual(['visit_date', 'next_appointment_date', 'instructions']);
  });

  it('visitChanges: chỉ trường đã đổi, cộng room_id khi đổi phòng (bỏ chọn = null, MT-115)', () => {
    const visit = chronicVisit();
    const blocks = visitBlocks(visit, 'MAN');
    const values = { ...initialFormValues(blocks), room_id: 1 };
    expect(visitChanges(visit, blocks, values)).toEqual({});
    expect(visitChanges(visit, blocks, { ...values, room_id: 2 })).toEqual({ room_id: 2 });
    expect(visitChanges(visit, blocks, { ...values, room_id: undefined })).toEqual({
      room_id: null,
    });
  });
});
