import { WEEKS_MAX } from './clinical-fields.js';
import type { SelfReportFields } from './contracts/medical-records.js';
import { FIELD_LIMITS } from './field-limits.js';
import {
  EMPTY_SELF_REPORT,
  RECORD_TYPE_LOCKED_NOTE,
  SELF_REPORT_TYPE_OPTIONS,
  emptySelfReportValues,
  formatDecimal,
  parseDecimal,
  selfReportChanges,
  selfReportCreateRequest,
  toSelfReportValues,
  validateSelfReport,
  type SelfReportFormValues,
} from './self-report.js';

const SAVED: SelfReportFields = {
  referral_diagnosis: 'Mày đay',
  initial_clinic_diagnosis: null,
  onset_weeks: 1.5,
  disease_manifestation: 'Chi san phu',
};

const values = (overrides: Partial<SelfReportFormValues> = {}): SelfReportFormValues => ({
  ...emptySelfReportValues(),
  ...overrides,
});

describe('lựa chọn loại bệnh án (spec B, mục 9.1; MT-130)', () => {
  it('hai nút theo mốc 6 tuần của docs/04 dòng 63, kèm cảnh báo không đổi được', () => {
    expect(SELF_REPORT_TYPE_OPTIONS).toEqual([
      { value: 'CAP', label: 'Mày đay cấp (dưới 6 tuần)' },
      { value: 'MAN', label: 'Mày đay mạn (từ 6 tuần trở lên)' },
    ]);
    expect(RECORD_TYPE_LOCKED_NOTE).toBe(
      'Không đổi được sau khi gửi; nếu chọn nhầm, bác sĩ sẽ huỷ và tạo lại',
    );
  });
});

describe('formatDecimal, parseDecimal', () => {
  it('hiển thị bằng dấu phẩy; nhận cả dấu phẩy lẫn dấu chấm; rỗng → null; không phải số → NaN', () => {
    expect(formatDecimal(1.5)).toBe('1,5');
    expect(formatDecimal(10)).toBe('10');
    expect(parseDecimal(' 1,5 ')).toBe(1.5);
    expect(parseDecimal('2.25')).toBe(2.25);
    expect(parseDecimal('-1')).toBe(-1);
    expect(parseDecimal('   ')).toBeNull();
    for (const bad of ['abc', '1,2,3', '1e3', ',5', '1,']) {
      expect(parseDecimal(bad)).toBeNaN();
    }
  });
});

describe('toSelfReportValues, emptySelfReportValues', () => {
  it('giá trị đang lưu → chuỗi trên form; null → ô trống', () => {
    expect(toSelfReportValues(SAVED)).toEqual({
      referral_diagnosis: 'Mày đay',
      initial_clinic_diagnosis: '',
      onset_weeks: '1,5',
      disease_manifestation: 'Chi san phu',
    });
    expect(emptySelfReportValues()).toEqual({
      referral_diagnosis: '',
      initial_clinic_diagnosis: '',
      onset_weeks: '',
      disease_manifestation: '',
    });
  });
});

describe('validateSelfReport: kiểm phía client theo bộ mô tả (docs/01 dòng 126)', () => {
  it('mọi ô để trống là hợp lệ (không bắt buộc, mục 9.1)', () => {
    expect(validateSelfReport('MAN', emptySelfReportValues())).toEqual({});
  });

  it('chữ quá clinical_text ký tự (sau khi cắt khoảng trắng) → lỗi; đúng giới hạn → hợp lệ', () => {
    const limit = FIELD_LIMITS.clinical_text;
    expect(
      validateSelfReport('CAP', values({ referral_diagnosis: 'a'.repeat(limit + 1) })),
    ).toEqual({ referral_diagnosis: `Tối đa ${limit} ký tự` });
    expect(
      validateSelfReport('CAP', values({ initial_clinic_diagnosis: ` ${'a'.repeat(limit)} ` })),
    ).toEqual({});
  });

  it('số tuần: không phải số, âm, quá lớn, quá 2 chữ số thập phân → lỗi tiếng Việt', () => {
    const check = (onset_weeks: string) => validateSelfReport('CAP', values({ onset_weeks }));
    expect(check('abc')).toEqual({
      onset_weeks: 'Vui lòng nhập số, phần thập phân dùng dấu phẩy (VD: 1,5)',
    });
    expect(check('-1')).toEqual({
      onset_weeks: `Vui lòng nhập số từ 0 đến ${formatDecimal(WEEKS_MAX)}`,
    });
    expect(check('10000000000')).toEqual({
      onset_weeks: 'Vui lòng nhập số từ 0 đến 9999999999,99',
    });
    expect(check('1,234')).toEqual({ onset_weeks: 'Tối đa 2 chữ số sau dấu phẩy' });
    for (const ok of ['0', '6', '1,5', '2.25', '9999999999,99']) expect(check(ok)).toEqual({});
  });
});

describe('selfReportChanges: chỉ trường đã đổi, ô trống = xoá (spec B, mục 5.7)', () => {
  it('tạo mới: chỉ các ô đã điền, đã cắt khoảng trắng, số đổi từ dấu phẩy', () => {
    expect(
      selfReportChanges(
        'MAN',
        values({
          referral_diagnosis: '  Mày đay mạn ',
          onset_weeks: '10,5',
          disease_manifestation: 'San phu + phu mach',
        }),
      ),
    ).toEqual({
      referral_diagnosis: 'Mày đay mạn',
      onset_weeks: 10.5,
      disease_manifestation: 'San phu + phu mach',
    });
  });

  it('sửa: ô không đổi bị bỏ; ô xoá trắng gửi null; số viết khác nhưng cùng giá trị không tính là đổi', () => {
    expect(
      selfReportChanges(
        'MAN',
        { ...toSelfReportValues(SAVED), referral_diagnosis: ' ', onset_weeks: '1.50' },
        SAVED,
      ),
    ).toEqual({ referral_diagnosis: null });
    expect(selfReportChanges('MAN', toSelfReportValues(SAVED), SAVED)).toEqual({});
  });

  it('CAP: không bao giờ gửi biểu hiện bệnh (chỉ hồ sơ MAN, D-B31), kể cả khi form còn giữ lựa chọn', () => {
    expect(
      selfReportChanges('CAP', values({ disease_manifestation: 'Chi phu mach', onset_weeks: '2' })),
    ).toEqual({ onset_weeks: 2 });
  });

  it('lựa chọn ngoài tập giá trị bị coi như chưa chọn', () => {
    expect(selfReportChanges('MAN', values({ disease_manifestation: 'khac' }))).toEqual({});
  });
});

describe('selfReportCreateRequest: POST /medical_records của bệnh nhân (D-B30)', () => {
  it('chỉ record_type và self_report đã điền; không có ô nào → chỉ record_type', () => {
    expect(selfReportCreateRequest('CAP', values({ referral_diagnosis: 'Dị ứng' }))).toEqual({
      record_type: 'CAP',
      self_report: { referral_diagnosis: 'Dị ứng' },
    });
    expect(selfReportCreateRequest('MAN', emptySelfReportValues())).toEqual({
      record_type: 'MAN',
    });
    expect(EMPTY_SELF_REPORT).toEqual({
      referral_diagnosis: null,
      initial_clinic_diagnosis: null,
      onset_weeks: null,
      disease_manifestation: null,
    });
  });
});
