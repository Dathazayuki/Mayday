import { describe, expect, it } from 'vitest';
import {
  LESION_MILESTONES,
  LESION_MILESTONE_LABELS,
  LESION_PATHS,
  MEDICATION_UNITS,
  MEDICATION_UNIT_LABELS,
} from './contracts/lesions.js';
import {
  checkSymptomScore,
  describeMedication,
  formatDisplayLesionDateTime,
  formatLesionDateTime,
  groupPhotosByMilestone,
  isLesionMilestone,
  isNonNegativeIntString,
  isRecordActiveForLesions,
  isValidLesionDateTime,
  parseContextTags,
  stringifyContextTags,
} from './lesions.js';

describe('isLesionMilestone', () => {
  it('nhận đúng ba mốc', () => {
    expect(isLesionMilestone('start')).toBe(true);
    expect(isLesionMilestone('peak')).toBe(true);
    expect(isLesionMilestone('normal')).toBe(true);
  });

  it('từ chối giá trị khác mốc hoặc không phải chuỗi', () => {
    expect(isLesionMilestone('Start')).toBe(false);
    expect(isLesionMilestone('end')).toBe(false);
    expect(isLesionMilestone('')).toBe(false);
    expect(isLesionMilestone(1)).toBe(false);
  });
});

describe('checkSymptomScore', () => {
  it('chấp nhận điểm trong khoảng 0..10 (cho phép khoảng trắng)', () => {
    expect(checkSymptomScore('0')).toBe('ok');
    expect(checkSymptomScore('10')).toBe('ok');
    expect(checkSymptomScore(' 5 ')).toBe('ok');
  });

  it('trả out_of_range khi ngoài khoảng', () => {
    expect(checkSymptomScore('11')).toBe('out_of_range');
    expect(checkSymptomScore('-1')).toBe('out_of_range');
  });

  it('trả invalid khi không phải số nguyên', () => {
    expect(checkSymptomScore('5.5')).toBe('invalid');
    expect(checkSymptomScore('abc')).toBe('invalid');
    expect(checkSymptomScore('')).toBe('invalid');
  });
});

describe('isNonNegativeIntString', () => {
  it('chấp nhận số nguyên ≥ 0 trong phạm vi int', () => {
    expect(isNonNegativeIntString('0')).toBe(true);
    expect(isNonNegativeIntString('2')).toBe(true);
    expect(isNonNegativeIntString('2147483647')).toBe(true);
  });

  it('từ chối số âm, số thập phân, rỗng hoặc vượt int', () => {
    expect(isNonNegativeIntString('2147483648')).toBe(false);
    expect(isNonNegativeIntString('-1')).toBe(false);
    expect(isNonNegativeIntString('1.5')).toBe(false);
    expect(isNonNegativeIntString('')).toBe(false);
  });
});

describe('parseContextTags', () => {
  it('đọc mảng JSON và trim từng thẻ', () => {
    expect(parseContextTags('["sau ăn"]')).toEqual(['sau ăn']);
    expect(parseContextTags('[" Sau vận động "]')).toEqual(['Sau vận động']);
    expect(parseContextTags('[]')).toEqual([]);
  });

  it('trả null khi dữ liệu không hợp lệ', () => {
    expect(parseContextTags('sau ăn')).toBeNull();
    expect(parseContextTags('{"a":1}')).toBeNull();
    expect(parseContextTags('[1]')).toBeNull();
    expect(parseContextTags('[""]')).toBeNull();
  });
});

describe('stringifyContextTags', () => {
  it('trim, bỏ rỗng và trùng, giữ thứ tự', () => {
    expect(stringifyContextTags([' Sau ăn ', '', 'Sau ăn', 'Sau vận động'])).toBe(
      '["Sau ăn","Sau vận động"]',
    );
  });

  it('trả chuỗi mảng rỗng khi không có thẻ', () => {
    expect(stringifyContextTags([])).toBe('[]');
  });
});

describe('isValidLesionDateTime', () => {
  it('chấp nhận ngày giờ đúng định dạng và có thật', () => {
    expect(isValidLesionDateTime('2026-04-24 10:30:00')).toBe(true);
    expect(isValidLesionDateTime('2024-02-29 00:00:00')).toBe(true);
  });

  it('từ chối ngày không có thật, giờ phút sai hoặc sai định dạng', () => {
    expect(isValidLesionDateTime('2026-02-29 10:00:00')).toBe(false);
    expect(isValidLesionDateTime('2026-04-24 24:00:00')).toBe(false);
    expect(isValidLesionDateTime('2026-04-24 10:60:00')).toBe(false);
    expect(isValidLesionDateTime('2026-04-24T10:30:00')).toBe(false);
    expect(isValidLesionDateTime('2026-04-24 10:30')).toBe(false);
    expect(isValidLesionDateTime('24/04/2026 10:30:00')).toBe(false);
  });
});

describe('formatLesionDateTime', () => {
  it('định dạng Date theo giờ địa phương và kết quả hợp lệ', () => {
    const text = formatLesionDateTime(new Date(2026, 3, 24, 9, 5, 7));
    expect(text).toBe('2026-04-24 09:05:07');
    expect(isValidLesionDateTime(text)).toBe(true);
  });
});

describe('isRecordActiveForLesions', () => {
  it('bệnh án draft, pending, in_progress còn ghi tổn thương được', () => {
    expect(isRecordActiveForLesions('draft')).toBe(true);
    expect(isRecordActiveForLesions('pending')).toBe(true);
    expect(isRecordActiveForLesions('in_progress')).toBe(true);
  });

  it('bệnh án completed, cancelled không còn ghi được', () => {
    expect(isRecordActiveForLesions('completed')).toBe(false);
    expect(isRecordActiveForLesions('cancelled')).toBe(false);
  });
});

describe('groupPhotosByMilestone', () => {
  it('nhóm ảnh theo mốc, giữ thứ tự đầu vào', () => {
    const groups = groupPhotosByMilestone([
      { id: 1, milestone: 'peak' as const },
      { id: 2, milestone: 'start' as const },
      { id: 3, milestone: 'peak' as const },
    ]);
    expect(groups.start.map((photo) => photo.id)).toEqual([2]);
    expect(groups.peak.map((photo) => photo.id)).toEqual([1, 3]);
    expect(groups.normal).toEqual([]);
  });
});

describe('describeMedication', () => {
  it('ghép tên thuốc và thời gian đã dùng', () => {
    expect(
      describeMedication({
        medication_name: 'Cetirizin',
        medication_taken_ago: '2',
        medication_unit: 'hour',
      }),
    ).toBe('Cetirizin, 2 giờ trước');
  });

  it('chỉ có thời gian khi không có tên thuốc', () => {
    expect(
      describeMedication({
        medication_name: null,
        medication_taken_ago: '3',
        medication_unit: 'day',
      }),
    ).toBe('3 ngày trước');
  });

  it('trả null khi tên thuốc rỗng và không có thời gian', () => {
    expect(
      describeMedication({
        medication_name: '  ',
        medication_taken_ago: null,
        medication_unit: null,
      }),
    ).toBeNull();
  });

  it('bỏ phần thời gian khi thiếu đơn vị', () => {
    expect(
      describeMedication({
        medication_name: 'A',
        medication_taken_ago: '2',
        medication_unit: null,
      }),
    ).toBe('A');
  });
});

describe('hằng số tổn thương', () => {
  it('nhãn mốc khớp với danh sách mốc', () => {
    expect(Object.keys(LESION_MILESTONE_LABELS).sort()).toEqual([...LESION_MILESTONES].sort());
  });

  it('nhãn đơn vị thuốc khớp với danh sách đơn vị', () => {
    expect(Object.keys(MEDICATION_UNIT_LABELS).sort()).toEqual([...MEDICATION_UNITS].sort());
  });

  it('ghép đường dẫn theo id', () => {
    expect(LESION_PATHS.photoMilestone(9)).toBe('/lesion-photos/9/milestone');
    expect(LESION_PATHS.episodesByRecord('12')).toBe('/lesion-episodes/record/12');
  });
});

describe('formatDisplayLesionDateTime', () => {
  it('đổi sang dd/MM/yyyy HH:mm', () => {
    expect(formatDisplayLesionDateTime('2026-11-15 08:30:45')).toBe('15/11/2026 08:30');
  });

  it('chỉ có ngày thì không để thừa khoảng trắng', () => {
    expect(formatDisplayLesionDateTime('2026-11-15')).toBe('15/11/2026');
  });
});
