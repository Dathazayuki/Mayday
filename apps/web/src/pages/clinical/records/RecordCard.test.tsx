import type { MedicalRecordListItem } from '@drmayday/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatShortDateTime } from '../../../lib/format-date';
import { medicalRecordListItem } from '../../../test/medical-record-fixture';
import { RecordCard } from './RecordCard';

const PENDING = medicalRecordListItem({
  medical_record_id: 101,
  record_type: 'CAP',
  status: 'pending',
  assigned_doctor_id: null,
  assigned_doctor_name: null,
  visit_count: 0,
  last_visit_date: null,
  allowed_actions: ['edit', 'accept', 'cancel'],
});

const IN_PROGRESS = medicalRecordListItem({
  medical_record_id: 12,
  visit_count: 2,
  next_appointment_date: '2026-12-13',
  allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
});

function renderCard(record: MedicalRecordListItem, busy = false, draggable = true) {
  const onAction = vi.fn();
  const onDragStart = vi.fn();
  const onDragEnd = vi.fn();
  render(
    <RecordCard
      record={record}
      busy={busy}
      draggable={draggable}
      onAction={onAction}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    />,
  );
  return {
    onAction,
    onDragStart,
    onDragEnd,
    card: screen.getByRole('article', { name: `Bệnh án #${record.medical_record_id}` }),
  };
}

/** Tên các mục của menu "⋯" sau khi mở. */
async function menuItems(id: number) {
  await userEvent.click(screen.getByRole('button', { name: `Thao tác khác với bệnh án #${id}` }));
  return (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
}

describe('RecordCard (spec B, mục 8.6)', () => {
  it('chờ tiếp nhận: mã (.num) + loại, họ tên, SĐT, "Đến khám dd/MM HH:mm"; nút Tiếp nhận; menu Mở, Huỷ', async () => {
    const { card } = renderCard(PENDING);
    expect(within(card).getByText('#101')).toHaveClass('num');
    expect(within(card).getByText('Cấp')).toHaveClass('dm-badge--slate');
    expect(within(card).getByText('LÊ THỊ MAI')).toBeInTheDocument();
    expect(within(card).getByText('0911111111')).toBeInTheDocument();
    expect(
      within(card).getByText(`Đến khám ${formatShortDateTime(PENDING.first_visit_at!)}`),
    ).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Tiếp nhận' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Hoàn tất' })).not.toBeInTheDocument();
    expect(await menuItems(101)).toEqual(['Mở', 'Huỷ']);
  });

  it('chưa đến khám (first_visit_at null, thường là hồ sơ tự khai) → "Chưa đến khám"', () => {
    const { card } = renderCard({ ...PENDING, first_visit_at: null });
    expect(within(card).getByText('Chưa đến khám')).toBeInTheDocument();
  });

  it('đang khám: bác sĩ phụ trách, "Lần n · dd/MM/yyyy", "Hẹn dd/MM/yyyy"; nút Hoàn tất; menu Mở, Thêm phiên khám, Huỷ', async () => {
    const { card } = renderCard(IN_PROGRESS);
    expect(within(card).getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(within(card).getByText('Lần 2 · 15/11/2026')).toBeInTheDocument();
    expect(within(card).getByText('Hẹn 13/12/2026')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Hoàn tất' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Tiếp nhận' })).not.toBeInTheDocument();
    expect(await menuItems(12)).toEqual(['Mở', 'Thêm phiên khám', 'Huỷ']);
  });

  it('không có thao tác nào (vd. hồ sơ của bác sĩ khác) → không có nút chính, menu chỉ còn "Mở"', async () => {
    const { card } = renderCard({ ...IN_PROGRESS, allowed_actions: [] });
    expect(within(card).queryByRole('button', { name: 'Hoàn tất' })).not.toBeInTheDocument();
    expect(await menuItems(12)).toEqual(['Mở']);
  });

  it('đã huỷ: không có dòng chân', () => {
    const { card } = renderCard({ ...IN_PROGRESS, status: 'cancelled', allowed_actions: [] });
    expect(within(card).queryByText('NGUYỄN VĂN AN')).not.toBeInTheDocument();
    expect(within(card).queryByText(/Đến khám|Chưa đến khám|Lần /)).not.toBeInTheDocument();
  });

  it('bấm thẻ → open; bấm nút chính hay mục menu → đúng thao tác, không mở chi tiết', async () => {
    const user = userEvent.setup();
    const { card, onAction } = renderCard(IN_PROGRESS);
    await user.click(within(card).getByText('LÊ THỊ MAI'));
    expect(onAction).toHaveBeenLastCalledWith('open', IN_PROGRESS);

    await user.click(within(card).getByRole('button', { name: 'Hoàn tất' }));
    expect(onAction).toHaveBeenLastCalledWith('complete', IN_PROGRESS);

    await user.click(within(card).getByRole('button', { name: 'Thao tác khác với bệnh án #12' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Thêm phiên khám' }));
    expect(onAction).toHaveBeenLastCalledWith('add_visit', IN_PROGRESS);
    expect(onAction.mock.calls.map(([action]) => action)).toEqual([
      'open',
      'complete',
      'add_visit',
    ]);
  });

  it('đang xử lý: aria-busy, nút bị khoá, bấm thẻ không làm gì', async () => {
    const user = userEvent.setup();
    const { card, onAction } = renderCard(PENDING, true);
    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(within(card).getByRole('button', { name: 'Tiếp nhận' })).toBeDisabled();
    await user.click(within(card).getByText('LÊ THỊ MAI'));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('kéo được khi bảng báo có cột đích đang hiện; dragstart ghi mã hồ sơ vào dataTransfer rồi báo bảng; dragend báo kết thúc', () => {
    const { card, onDragStart, onDragEnd } = renderCard(PENDING);
    expect(card).toHaveAttribute('draggable', 'true');
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'all' };
    fireEvent.dragStart(card, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '101');
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(onDragStart).toHaveBeenCalledWith(PENDING);
    fireEvent.dragEnd(card, { dataTransfer });
    expect(onDragEnd).toHaveBeenCalled();
  });

  it('bảng báo không có cột đích hoặc thẻ đang xử lý → không kéo được', () => {
    expect(renderCard(IN_PROGRESS, false, false).card).toHaveAttribute('draggable', 'false');
    expect(renderCard({ ...PENDING, medical_record_id: 102 }, true).card).toHaveAttribute(
      'draggable',
      'false',
    );
  });
});
