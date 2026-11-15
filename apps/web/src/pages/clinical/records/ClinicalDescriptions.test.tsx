import { RECORD_CHRONIC_FIELDS, RECORD_CORE_FIELDS, SELF_REPORT_FIELDS } from '@drmayday/shared';
import { render, screen } from '@testing-library/react';
import type { ClinicalBlock } from '../../../clinical/clinical-form';
import { ClinicalDescriptions } from './ClinicalDescriptions';

const CHRONIC: ClinicalBlock = {
  path: 'chronic',
  fields: RECORD_CHRONIC_FIELDS,
  values: { main_diagnosis: 'Phu mach don thuan', cindu_cold: true, cindu_other: false },
};

describe('ClinicalDescriptions (chế độ xem, spec B mục 8.7)', () => {
  it('nhãn và giá trị theo bộ mô tả; ô chưa nhập "—"; một nhóm thì không có tiêu đề nhóm', () => {
    render(<ClinicalDescriptions blocks={[CHRONIC]} />);
    expect(screen.getByText('Chẩn đoán chính')).toBeInTheDocument();
    expect(screen.getByText('Phù mạch đơn thuần')).toBeInTheDocument();
    expect(screen.getByText('Có')).toBeInTheDocument();
    expect(screen.getByText('Không')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(6);
    expect(screen.queryByText('Chẩn đoán xác định')).toBeNull();
  });

  it('ô ghi rõ chỉ hiện khi cờ đang lưu bật (D-B14)', () => {
    const { rerender } = render(<ClinicalDescriptions blocks={[CHRONIC]} />);
    expect(screen.queryByText('Ghi rõ mày đay cảm ứng khác')).toBeNull();
    rerender(
      <ClinicalDescriptions
        blocks={[
          { ...CHRONIC, values: { cindu_other: true, cindu_other_detail: 'Mày đay do nóng' } },
        ]}
      />,
    );
    expect(screen.getByText('Ghi rõ mày đay cảm ứng khác')).toBeInTheDocument();
    expect(screen.getByText('Mày đay do nóng')).toBeInTheDocument();
  });

  it('từ hai nhóm trở lên: tiêu đề theo phân nhóm docs/04', () => {
    render(
      <ClinicalDescriptions
        blocks={[
          { path: 'self_report', fields: SELF_REPORT_FIELDS, values: {} },
          { path: null, fields: RECORD_CORE_FIELDS, values: {} },
        ]}
      />,
    );
    for (const title of [
      'Chẩn đoán tuyến trước và bảo hiểm',
      'Thời gian diễn biến',
      'Thông tin hành chính',
      'Tiền sử gia đình',
      'Điều trị trước đó',
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });
});
