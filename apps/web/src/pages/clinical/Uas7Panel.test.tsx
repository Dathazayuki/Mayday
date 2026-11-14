import { UAS7_FIELD_LABELS } from '@drmayday/shared';
import { screen, within } from '@testing-library/react';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { Uas7Panel } from './Uas7Panel';

const BASE = 'http://localhost:3000/api/v1';

const WEEK = {
  patient_id: '7',
  week_score: '18',
  severity_label: 'Trung bình',
  completed_days: '5',
  start_date: '2026-11-09',
  end_date: '2026-11-15',
};

const score = (date: string, iss7: string, hss7: string, note: string | null) => ({
  patient_id: '7',
  medical_record_id: '101',
  score_date: date,
  iss7,
  hss7,
  daily_score: String(Number(iss7) + Number(hss7)),
  note,
  created_at: '',
  updated_at: '',
});

function setup(routes: Record<string, () => Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const handler = routes[url.replace(BASE, '').split('?')[0]];
      return Promise.resolve(handler ? handler() : okResponse({}));
    }),
  );
  seedSession();
  renderApp(<Uas7Panel patientId={7} />);
}

describe('Uas7Panel', () => {
  it('hiện tổng tuần x/42, mức độ, số ngày đã chấm và kỳ tính', async () => {
    setup({
      '/uas7-scores/week/7': () => okResponse(WEEK),
      '/uas7-scores/patient/7': () => okResponse([]),
    });
    expect(await screen.findByText('18/42')).toBeInTheDocument();
    expect(screen.getByText('Trung bình')).toBeInTheDocument();
    expect(screen.getByText('5/7 ngày')).toBeInTheDocument();
    expect(screen.getByText('2026-11-09 → 2026-11-15')).toBeInTheDocument();
  });

  it('bảng lịch sử dùng nhãn từ UAS7_FIELD_LABELS và hiện điểm từng ngày', async () => {
    setup({
      '/uas7-scores/week/7': () => okResponse(WEEK),
      '/uas7-scores/patient/7': () =>
        okResponse([
          score('2026-11-15', '2', '3', 'Ngứa đêm'),
          score('2026-11-14', '1', '0', null),
        ]),
    });
    const table = await screen.findByRole('table');
    for (const label of [
      'Ngày',
      UAS7_FIELD_LABELS.iss7,
      UAS7_FIELD_LABELS.hss7,
      'Tổng ngày',
      'Ghi chú',
    ]) {
      expect(within(table).getByText(label)).toBeInTheDocument();
    }
    expect(await within(table).findByText('Ngứa đêm')).toBeInTheDocument();
    const row = within(table).getByText('2026-11-15').closest('tr')!;
    expect(within(row).getByText('5')).toBeInTheDocument();
  });

  it('chưa chấm điểm: hiện trạng thái trống', async () => {
    setup({
      '/uas7-scores/week/7': () =>
        okResponse({ ...WEEK, week_score: '0', completed_days: '0', severity_label: 'Không có' }),
      '/uas7-scores/patient/7': () => okResponse([]),
    });
    expect(await screen.findByText('Bệnh nhân chưa chấm điểm UAS7')).toBeInTheDocument();
  });

  it('lỗi tải hiện bằng describeError', async () => {
    setup({
      '/uas7-scores/week/7': () => errorResponse(403, '3106'),
      '/uas7-scores/patient/7': () => errorResponse(403, '3106'),
    });
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
  });
});
