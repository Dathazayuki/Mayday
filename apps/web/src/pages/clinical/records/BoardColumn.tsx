import { ShrinkOutlined } from '@ant-design/icons';
import {
  MEDICAL_RECORD_STATUS_LABELS,
  type MedicalRecordCountsQuery,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { Button, Skeleton } from 'antd';
import type { DragEvent, ReactNode } from 'react';
import { useColumnRecords } from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';

/** Vai trò của cột khi đang kéo một thẻ: `target` là đích hợp lệ (sáng lên), `muted` thì mờ đi. */
export type DropState = 'idle' | 'target' | 'muted';

/**
 * Một cột của bảng cột (spec B, mục 8.5): tiêu đề + số đếm (status-counts), thẻ mã hồ sơ giảm dần, 20 thẻ
 * một lần và nút "Xem thêm". Cột thu gọn (Nháp, Đã huỷ) hẹp, tiêu đề dọc + số đếm, bấm để mở; chỉ tải thẻ
 * khi mở. Cột nhận thả (HTML5 gốc) khi `drop` là `target`; thả chỉ báo cho bảng, không gọi API.
 */
export function BoardColumn({
  status,
  count,
  filter,
  collapsed,
  onToggle,
  drop,
  onDrop,
  renderCard,
}: {
  status: MedicalRecordStatus;
  /** undefined khi số đếm chưa tải xong. */
  count: number | undefined;
  filter: MedicalRecordCountsQuery;
  collapsed: boolean;
  /** Có ở cột thu gọn được: mở hoặc thu gọn lại. */
  onToggle?: () => void;
  drop: DropState;
  onDrop: () => void;
  renderCard: (record: MedicalRecordListItem) => ReactNode;
}) {
  const label = MEDICAL_RECORD_STATUS_LABELS[status];
  const { data, error, isPending, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useColumnRecords(status, filter, !collapsed);
  const countText = <span className="num dm-board__count">{count ?? '–'}</span>;
  // preventDefault ở dragenter/dragover là cách HTML5 đánh dấu "thả được vào đây".
  const allowDrop = (event: DragEvent) => {
    if (drop === 'target') event.preventDefault();
  };
  const columnProps = {
    className: [
      'dm-board__col',
      collapsed && 'dm-board__col--collapsed',
      drop !== 'idle' && `dm-board__col--${drop}`,
    ]
      .filter(Boolean)
      .join(' '),
    'aria-label': `Cột ${label}`,
    onDragEnter: allowDrop,
    onDragOver: allowDrop,
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (drop === 'target') onDrop();
    },
  };

  if (collapsed) {
    return (
      <section {...columnProps}>
        <button
          type="button"
          className="dm-board__expand"
          aria-label={count === undefined ? `Mở cột ${label}` : `Mở cột ${label} (${count})`}
          onClick={onToggle}
        >
          <span className="dm-board__col-title">{label}</span>
          {countText}
          {drop === 'target' && <span className="dm-board__drop-hint">Thả để huỷ</span>}
        </button>
      </section>
    );
  }

  // Hồ sơ đổi cột giữa hai lần tải trang có thể lặp lại ở trang sau: giữ một thẻ cho mỗi mã.
  const records = [
    ...new Map(
      (data?.pages ?? []).flatMap((page) =>
        page.items.map((record) => [record.medical_record_id, record] as const),
      ),
    ).values(),
  ];
  return (
    <section {...columnProps}>
      <header className="dm-board__col-head">
        <span className="dm-board__col-title">{label}</span>
        {countText}
        {onToggle && (
          <Button
            size="small"
            type="text"
            icon={<ShrinkOutlined />}
            aria-label={`Thu gọn cột ${label}`}
            onClick={onToggle}
          />
        )}
      </header>
      <div className="dm-board__cards">
        <QueryErrorAlert error={error} />
        {isPending ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          records.map((record) => renderCard(record))
        )}
        {!isPending && !error && records.length === 0 && (
          <div className="dm-board__empty">Không có bệnh án</div>
        )}
        {hasNextPage && (
          <Button block loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            Xem thêm
          </Button>
        )}
      </div>
    </section>
  );
}
