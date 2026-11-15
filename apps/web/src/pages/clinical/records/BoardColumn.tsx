import { ShrinkOutlined } from '@ant-design/icons';
import {
  MEDICAL_RECORD_STATUS_LABELS,
  type MedicalRecordCountsQuery,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { Button, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useColumnRecords } from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';

/**
 * Một cột của bảng cột (spec B, mục 8.5): tiêu đề + số đếm (status-counts), thẻ mã hồ sơ giảm dần, 20 thẻ
 * một lần và nút "Xem thêm". Cột thu gọn (Nháp, Đã huỷ) hẹp, tiêu đề dọc + số đếm, bấm để mở; chỉ tải thẻ
 * khi mở.
 */
export function BoardColumn({
  status,
  count,
  filter,
  collapsed,
  onToggle,
  renderCard,
}: {
  status: MedicalRecordStatus;
  /** undefined khi số đếm chưa tải xong. */
  count: number | undefined;
  filter: MedicalRecordCountsQuery;
  collapsed: boolean;
  /** Có ở cột thu gọn được: mở hoặc thu gọn lại. */
  onToggle?: () => void;
  renderCard: (record: MedicalRecordListItem) => ReactNode;
}) {
  const label = MEDICAL_RECORD_STATUS_LABELS[status];
  const { data, error, isPending, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useColumnRecords(status, filter, !collapsed);
  const countText = <span className="num dm-board__count">{count ?? '–'}</span>;

  if (collapsed) {
    return (
      <section className="dm-board__col dm-board__col--collapsed" aria-label={`Cột ${label}`}>
        <button
          type="button"
          className="dm-board__expand"
          aria-label={`Mở cột ${label}`}
          onClick={onToggle}
        >
          <span className="dm-board__col-title">{label}</span>
          {countText}
        </button>
      </section>
    );
  }

  const records = data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="dm-board__col" aria-label={`Cột ${label}`}>
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
