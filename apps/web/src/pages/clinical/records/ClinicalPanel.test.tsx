import {
  ApiError,
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
} from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { clinicalChanges, type ClinicalBlock } from '../../../clinical/clinical-form';
import { renderApp } from '../../../test/helpers';
import { ClinicalPanel } from './ClinicalPanel';

const CORE: ClinicalBlock = {
  path: null,
  fields: RECORD_CORE_FIELDS,
  values: {
    first_visit_at: '2026-11-15T01:00:00.000Z',
    outpatient_start_date: '2026-11-01',
    outpatient_end_date: null,
    insurance_treatment_result: null,
    family_history: 'Khong',
    family_history_detail: null,
    treated_before_visit: true,
  },
};

const CHRONIC: ClinicalBlock = {
  path: 'chronic',
  fields: RECORD_CHRONIC_FIELDS,
  values: {
    main_diagnosis: 'CSU',
    csu_subtype: null,
    cindu_dermographism: null,
    cindu_cholinergic: null,
    cindu_cold: null,
    cindu_adrenergic: null,
    cindu_aquagenic: null,
    cindu_solar: null,
    cindu_other: false,
    cindu_other_detail: null,
  },
};

const ACUTE: ClinicalBlock = {
  path: 'acute',
  fields: RECORD_ACUTE_FIELDS,
  values: { exposure_to_onset_seconds: 1800, first_onset_age: 25 },
};

function setup(
  blocks: readonly ClinicalBlock[],
  { editable = true, onSave = vi.fn(() => Promise.resolve({})) } = {},
) {
  renderApp(
    // Tắt hiệu ứng để form và thông báo gỡ khỏi DOM ngay (jsdom không chạy transitionend).
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <ClinicalPanel
          title="Hồ sơ"
          formName="test-panel"
          blocks={blocks}
          editable={editable}
          toChanges={(values) => clinicalChanges(blocks, values)}
          onSave={onSave}
        />
      </App>
    </ConfigProvider>,
  );
  return { onSave, panel: screen.getByRole('region', { name: 'Hồ sơ' }) };
}

/** Bấm một lựa chọn của ô bool (Segmented "Có / Không / Chưa rõ"). */
async function chooseBool(user: UserEvent, label: string, choice: 'Có' | 'Không' | 'Chưa rõ') {
  const group = screen.getByRole('radiogroup', { name: label });
  await user.click(within(group).getByText(choice));
}

/** Chọn trong Select của antd: dropdown render ở body (như UsersPage.test.tsx). */
async function chooseOption(user: UserEvent, label: string, option: string) {
  await user.click(screen.getByLabelText(label));
  const options = await screen.findAllByTitle(option);
  await user.click(options[options.length - 1]!);
}

describe('ClinicalPanel (spec B, mục 8.7)', () => {
  it('chế độ xem: giá trị theo nhãn tiếng Việt, ô trống "—", ô ghi rõ ẩn khi cờ tắt; không có quyền sửa thì không có nút "Sửa"', () => {
    const { panel } = setup([CORE], { editable: false });
    expect(within(panel).getByText('Điều trị ngoại trú từ ngày')).toBeInTheDocument();
    expect(within(panel).getByText('01/11/2026')).toBeInTheDocument();
    expect(within(panel).getByText('Không')).toBeInTheDocument();
    expect(within(panel).getByText('Có')).toBeInTheDocument();
    expect(within(panel).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(panel).queryByText('Ghi rõ tiền sử gia đình')).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Sửa Hồ sơ' })).toBeNull();
  });

  it('"Lưu" gửi chỉ các trường đã đổi, lồng đúng khối; xong thì về chế độ xem', async () => {
    const user = userEvent.setup();
    const { onSave } = setup([CORE, CHRONIC]);
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));

    await chooseOption(user, 'Chẩn đoán chính', 'CIndU');
    await chooseBool(user, 'Mày đay do lạnh', 'Có');
    await chooseBool(user, 'Đã điều trị trước khi khám', 'Chưa rõ');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        treated_before_visit: null,
        chronic: { main_diagnosis: 'CIndU', cindu_cold: true },
      }),
    );
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
  });

  it('không đổi gì: không gọi API, báo "Không có thay đổi"', async () => {
    const user = userEvent.setup();
    const { onSave } = setup([CORE]);
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Không có thay đổi')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('ô ghi rõ chỉ hiện khi chọn "Có"; tắt cờ thì ô bị xoá ngay trên form (D-B14)', async () => {
    const user = userEvent.setup();
    const { onSave } = setup([CORE]);
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));
    expect(screen.queryByLabelText('Ghi rõ tiền sử gia đình')).toBeNull();

    await chooseOption(user, 'Tiền sử gia đình', 'Có');
    await user.type(screen.getByLabelText('Ghi rõ tiền sử gia đình'), 'Mẹ bị mày đay');
    await chooseOption(user, 'Tiền sử gia đình', 'Không rõ');
    expect(screen.queryByLabelText('Ghi rõ tiền sử gia đình')).toBeNull();
    await chooseOption(user, 'Tiền sử gia đình', 'Có');
    expect(screen.getByLabelText('Ghi rõ tiền sử gia đình')).toHaveValue('');

    await user.type(screen.getByLabelText('Ghi rõ tiền sử gia đình'), '  Bố bị hen  ');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        family_history: 'Co',
        family_history_detail: 'Bố bị hen',
      }),
    );
  });

  it('ngày (DatePicker dd/MM/yyyy) và thời lượng (số + đơn vị) → YYYY-MM-DD và số giây (MT-124)', async () => {
    const user = userEvent.setup();
    const { onSave } = setup([CORE, ACUTE]);
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));

    // Gõ ngày rồi rời ô (Enter trong ô của form sẽ gửi form).
    const endDate = screen.getByLabelText('Điều trị ngoại trú đến ngày');
    await user.click(endDate);
    await user.type(endDate, '20/11/2026');
    await user.tab();

    const exposure = screen.getByLabelText('Thời gian từ tiếp xúc đến khởi phát');
    expect(exposure).toHaveValue('30');
    await user.clear(exposure);
    await user.type(exposure, '1,5');
    await chooseOption(user, 'Đơn vị: Thời gian từ tiếp xúc đến khởi phát', 'giờ');

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        outpatient_end_date: '2026-11-20',
        acute: { exposure_to_onset_seconds: 5400 },
      }),
    );
  });

  it('lỗi 2001/2003 có field của một ô → gắn vào ô đó; lỗi khác → Alert trên panel, form giữ nguyên', async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('2003', 'x', 400, { field: 'outpatient_end_date' }))
      .mockRejectedValueOnce(new ApiError('3105', 'x', 403));
    const { panel } = setup([CORE], { onSave });
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));
    await chooseBool(user, 'Đã điều trị trước khi khám', 'Không');

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await within(panel).findByText('Giá trị parameter không hợp lệ')).toBeInTheDocument();
    expect(within(panel).queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'Bác sĩ không phụ trách bệnh án này',
    );
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });
});
