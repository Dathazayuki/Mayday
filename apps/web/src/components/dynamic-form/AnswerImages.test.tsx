import type { OptionData } from '@drmayday/shared';
import { screen } from '@testing-library/react';
import {
  errorResponse,
  okResponse,
  renderApp,
  seedSession,
  stubImageApi,
} from '../../test/helpers';
import { AnswerImages } from './AnswerImages';

const BASE = 'http://localhost:3000/api/v1';

const OPTIONS: OptionData[] = [
  {
    id: '1',
    option_text: 'Nhìn thẳng',
    option_value: 'front_view',
    order: '1',
    trigger_image_upload: '1',
  },
];

const item = (id: string, option_value: string | null) => ({
  id,
  option_value,
  attachment: {
    attachment_id: `9${id}`,
    file_url: `/api/v1/image-attachments/view/9${id}`,
    file_name: `anh-${id}.jpg`,
  },
});

function setup(answerId: number | undefined, response: () => Response) {
  const urls = stubImageApi(response);
  seedSession();
  renderApp(<AnswerImages answerId={answerId} options={OPTIONS} labelledBy="label" />);
  return urls;
}

describe('AnswerImages', () => {
  it('không có answerId thì không gọi API', () => {
    const urls = setup(undefined, () => okResponse([]));
    expect(urls).toEqual([]);
  });

  it('gọi GET /answer-images/:answer_id và hiện đúng số ảnh', async () => {
    const urls = setup(12, () => okResponse([item('1', null), item('2', null)]));
    expect(await screen.findAllByRole('img')).toHaveLength(2);
    expect(urls[0]).toBe(`${BASE}/answer-images/12`);
  });

  it('ảnh có option_value kèm nhãn option_text của lựa chọn', async () => {
    setup(12, () => okResponse([item('1', 'front_view')]));
    expect(await screen.findByText('Nhìn thẳng')).toBeInTheDocument();
  });

  it('danh sách rỗng thì không hiện gì', async () => {
    const urls = setup(12, () => okResponse([]));
    await vi.waitFor(() => expect(urls).toHaveLength(1));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lỗi hiện bằng describeError', async () => {
    setup(12, () => errorResponse(403, '3106'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bệnh nhân không được xem dữ liệu người khác',
    );
  });
});
