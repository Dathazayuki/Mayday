import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  errorResponse,
  okResponse,
  renderApp,
  seedSession,
  stubImageApi,
} from '../../test/helpers';
import { LesionPanel } from './LesionPanel';

const BASE = 'http://localhost:3000/api/v1';

const LIST_ITEM = {
  id: '31',
  medical_record_id: '101',
  name: 'Nổi mẩn sau ăn',
  occurred_at: '2026-11-14 19:30:00',
  context_tags: '["Sau ăn","Sau ăn hải sản"]',
  description: 'Mẩn đỏ ở tay',
};

const EPISODE = {
  episode_id: '31',
  medical_record_id: '101',
  patient_id: '7',
  name: 'Nổi mẩn sau ăn',
  description: 'Mẩn đỏ ở tay',
  occurred_at: '2026-11-14 19:30:00',
  context_tags: '["Sau ăn"]',
  context_other: 'Trời nóng',
  medication_name: 'Cetirizin',
  medication_taken_ago: '2',
  medication_unit: 'hour',
  created_at: '',
  updated_at: '',
};

const LOCATIONS = [
  { lesion_location_id: '41', episode_id: '31', body_part: 'Cẳng tay trái' },
  { lesion_location_id: '42', episode_id: '31', body_part: 'Lưng' },
].map((l) => ({
  ...l,
  context_tags: null,
  context_other: null,
  medication_name: null,
  medication_taken_ago: null,
  medication_unit: null,
  created_at: '',
  updated_at: '',
}));

const photo = (id: string, milestone: string, extra: object = {}) => ({
  photo_id: id,
  episode_id: '31',
  location_id: '41',
  attachment_id: `9${id}`,
  taken_at: '2026-11-14 20:00:00',
  milestone,
  itch_score: null,
  pain_score: null,
  burn_score: null,
  hives_count: null,
  local_auas: null,
  annotated_url: null,
  created_at: '',
  updated_at: '',
  attachment: { attachment_id: `9${id}`, file_url: `/api/v1/image-attachments/view/9${id}` },
  ...extra,
});

const PHOTOS = [
  photo('1', 'start', {
    itch_score: '5',
    pain_score: '3',
    hives_count: '4',
    local_auas: '2',
    annotated_url: 'https://example.com/anno.png',
  }),
  photo('2', 'peak', { annotated_url: 'javascript:alert(1)' }),
  photo('3', 'normal'),
];

function setup(routes: Record<string, () => Response>) {
  const urls = stubImageApi((path) => routes[path]?.());
  seedSession();
  renderApp(<LesionPanel medicalRecordId={101} />);
  return urls;
}

const DETAIL_ROUTES = {
  '/lesion-episodes/record/101': () => okResponse([LIST_ITEM]),
  '/lesion-episodes/31': () => okResponse(EPISODE),
  '/lesion-locations/episode/31': () => okResponse(LOCATIONS),
  '/lesion-photos/location/41': () => okResponse(PHOTOS),
  '/lesion-photos/location/42': () => okResponse([]),
};

describe('LesionPanel', () => {
  it('danh sách đợt lấy từ record/:id kèm thẻ bối cảnh và mô tả', async () => {
    const urls = setup(DETAIL_ROUTES);
    expect(await screen.findByText('Nổi mẩn sau ăn')).toBeInTheDocument();
    expect(screen.getByText('Sau ăn hải sản')).toBeInTheDocument();
    expect(screen.getByText('Mẩn đỏ ở tay')).toBeInTheDocument();
    expect(screen.getByText('14/11/2026 19:30')).toBeInTheDocument();
    expect(urls).toEqual([`${BASE}/lesion-episodes/record/101`]);
  });

  it('chưa có đợt nào thì hiện trạng thái trống', async () => {
    setup({ '/lesion-episodes/record/101': () => okResponse([]) });
    expect(
      await screen.findByText('Bệnh nhân chưa ghi nhận đợt tổn thương nào'),
    ).toBeInTheDocument();
  });

  it('mở một đợt thì tải chi tiết, vị trí và ảnh từng vị trí', async () => {
    const urls = setup(DETAIL_ROUTES);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xem chi tiết' }));
    expect(await screen.findByText('Cẳng tay trái')).toBeInTheDocument();
    expect(screen.getByText('Lưng')).toBeInTheDocument();
    expect(await screen.findByText('Cetirizin, 2 giờ trước')).toBeInTheDocument();
    expect(screen.getByText('Trời nóng')).toBeInTheDocument();
    expect(urls).toEqual(
      expect.arrayContaining([
        `${BASE}/lesion-episodes/31`,
        `${BASE}/lesion-locations/episode/31`,
        `${BASE}/lesion-photos/location/41`,
        `${BASE}/lesion-photos/location/42`,
      ]),
    );
  });

  it('ảnh chia 3 cột theo mốc, kèm điểm, chỉ số và liên kết annotated_url http(s)', async () => {
    setup(DETAIL_ROUTES);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xem chi tiết' }));
    for (const label of ['Khởi phát', 'Đỉnh điểm', 'Hồi phục']) {
      // Hai vị trí nên mỗi nhãn mốc xuất hiện hai lần.
      expect(await screen.findAllByText(label)).toHaveLength(2);
    }
    expect(await screen.findAllByRole('img')).toHaveLength(3);
    const startColumn = screen.getAllByTestId('milestone-start')[0];
    expect(within(startColumn).getByText('Ngứa 5/10 · Đau 3/10 · Rát –')).toBeInTheDocument();
    expect(within(startColumn).getByText('Số nốt sẩn: 4')).toBeInTheDocument();
    expect(within(startColumn).getByText('AUAS cục bộ: 2')).toBeInTheDocument();
    expect(within(startColumn).getByRole('link', { name: 'Ảnh đánh dấu' })).toHaveAttribute(
      'href',
      'https://example.com/anno.png',
    );
    expect(
      within(screen.getAllByTestId('milestone-peak')[0]).queryByRole('link'),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getAllByTestId('milestone-peak')[0]).getByText('Ngứa – · Đau – · Rát –'),
    ).toBeInTheDocument();
  });

  it('lỗi 3101 hiện bằng describeError', async () => {
    setup({ '/lesion-episodes/record/101': () => errorResponse(403, '3101') });
    expect(await screen.findByRole('alert')).toHaveTextContent('Không có quyền thực hiện thao tác');
  });
});
