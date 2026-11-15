import { EllipsisOutlined } from '@ant-design/icons';
import { MEDICAL_RECORD_ACTION_LABELS, type MedicalRecordListItem } from '@drmayday/shared';
import { Button, Dropdown, Spin, type MenuProps } from 'antd';
import type { TransitionKind } from '../../../clinical/board-rules';
import { RecordTypeBadge } from '../../../clinical/record-type';
import { formatDate, formatShortDateTime } from '../../../lib/format-date';

/** Thao tác từ thẻ: mở màn chi tiết, thêm phiên khám (mở chi tiết), hoặc một chuyển trạng thái. */
export type RecordCardAction = 'open' | 'add_visit' | TransitionKind;

/** Nút chính hiện ngay trên thẻ khi có trong `allowed_actions` (spec B, mục 8.6). */
const PRIMARY_ACTIONS = ['accept', 'complete'] as const;

/** Chân thẻ theo trạng thái (spec B, mục 8.6). */
function CardFooter({ record }: { record: MedicalRecordListItem }) {
  switch (record.status) {
    case 'draft':
    case 'pending':
      // CSDL không lưu ai tạo hồ sơ nên thẻ không ghi "tự khai" (D-B9).
      return (
        <div className="dm-card__meta">
          {record.first_visit_at
            ? `Đến khám ${formatShortDateTime(record.first_visit_at)}`
            : 'Chưa đến khám'}
        </div>
      );
    case 'in_progress':
    case 'completed':
      return (
        <div className="dm-card__meta">
          {record.assigned_doctor_name && <div>{record.assigned_doctor_name}</div>}
          {record.last_visit_date && (
            <div>
              Lần {record.visit_count} · {formatDate(record.last_visit_date)}
            </div>
          )}
          {record.next_appointment_date && (
            <div>Hẹn {formatDate(record.next_appointment_date)}</div>
          )}
        </div>
      );
    case 'cancelled':
      return null;
  }
}

/** Nội dung thẻ: mã + loại, họ tên, SĐT, chân theo trạng thái. Dùng chung với Tổng quan (thẻ rút gọn). */
export function RecordCardSummary({ record }: { record: MedicalRecordListItem }) {
  return (
    <>
      <div className="dm-card__head">
        <span className="num">#{record.medical_record_id}</span>
        <RecordTypeBadge type={record.record_type} />
      </div>
      <div className="dm-card__name">{record.patient_name}</div>
      <div className="dm-card__meta num">{record.patient_phone}</div>
      <CardFooter record={record} />
    </>
  );
}

/**
 * Thẻ bệnh án của bảng cột (`RecordCard`, spec B mục 8.6). Bấm thẻ → màn chi tiết. Nút "Tiếp nhận",
 * "Hoàn tất" khi có trong `allowed_actions`; menu "⋯" luôn có "Mở" (đường cho bàn phím), thêm "Thêm phiên
 * khám", "Huỷ" khi có. `busy`: hồ sơ đang chờ API, thẻ mờ đi và không bấm được.
 */
export function RecordCard({
  record,
  busy,
  onAction,
}: {
  record: MedicalRecordListItem;
  busy: boolean;
  onAction: (action: RecordCardAction, record: MedicalRecordListItem) => void;
}) {
  const id = record.medical_record_id;
  const allowed = record.allowed_actions;
  const menu: MenuProps = {
    items: [
      { key: 'open', label: 'Mở' },
      ...(allowed.includes('add_visit')
        ? [{ key: 'add_visit', label: MEDICAL_RECORD_ACTION_LABELS.add_visit }]
        : []),
      ...(allowed.includes('cancel')
        ? [{ key: 'cancel', label: MEDICAL_RECORD_ACTION_LABELS.cancel, danger: true }]
        : []),
    ],
    onClick: ({ key }) => onAction(key as RecordCardAction, record),
  };
  const classes = ['dm-card', busy && 'dm-card--busy'].filter(Boolean).join(' ');

  return (
    <article
      className={classes}
      aria-label={`Bệnh án #${id}`}
      aria-busy={busy}
      onClick={() => {
        if (!busy) onAction('open', record);
      }}
    >
      <RecordCardSummary record={record} />
      {/* Bấm nút hay menu (kể cả menu render ở body) không mở màn chi tiết. */}
      <div className="dm-card__actions" onClick={(event) => event.stopPropagation()}>
        {busy && <Spin size="small" />}
        {PRIMARY_ACTIONS.filter((action) => allowed.includes(action)).map((action) => (
          <Button
            key={action}
            size="small"
            type="primary"
            disabled={busy}
            onClick={() => onAction(action, record)}
          >
            {MEDICAL_RECORD_ACTION_LABELS[action]}
          </Button>
        ))}
        <Dropdown trigger={['click']} disabled={busy} menu={menu}>
          <Button
            size="small"
            type="text"
            icon={<EllipsisOutlined />}
            aria-label={`Thao tác khác với bệnh án #${id}`}
          />
        </Dropdown>
      </div>
    </article>
  );
}
