import type {
  MedicalRecordCountsQuery,
  MedicalRecordListItem,
  MedicalRecordStatus,
} from '@drmayday/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStatusCounts } from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { BoardColumn } from './BoardColumn';
import { RecordCard, type RecordCardAction } from './RecordCard';
import { useTransitions } from './TransitionModals';

/**
 * Cột của bảng (spec B, mục 8.5, D-B25): Chờ tiếp nhận, Đang khám, Hoàn tất đầy đủ; Nháp thu gọn (B không
 * tạo nháp, D-B4); Đã huỷ thu gọn và chỉ hiện khi bật công tắc (trạng thái cuối, D-B7).
 */
const COLUMNS: readonly { status: MedicalRecordStatus; collapsible: boolean }[] = [
  { status: 'draft', collapsible: true },
  { status: 'pending', collapsible: false },
  { status: 'in_progress', collapsible: false },
  { status: 'completed', collapsible: false },
  { status: 'cancelled', collapsible: true },
];

/**
 * Chế độ cột kiểu Trello của trang bệnh án (spec B, mục 8.5–8.6). Thẻ và thao tác theo `allowed_actions`;
 * mọi chuyển trạng thái qua cùng hộp xác nhận (`useTransitions`), không cập nhật lạc quan.
 */
export function RecordBoard({
  filter,
  showCancelled,
}: {
  filter: MedicalRecordCountsQuery;
  showCancelled: boolean;
}) {
  const navigate = useNavigate();
  const counts = useStatusCounts(filter);
  const transitions = useTransitions();
  const [expanded, setExpanded] = useState<ReadonlySet<MedicalRecordStatus>>(() => new Set());

  function toggle(status: MedicalRecordStatus) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function handleAction(action: RecordCardAction, record: MedicalRecordListItem) {
    const path = `/medical-records/${record.medical_record_id}`;
    if (action === 'open') navigate(path);
    // "Thêm phiên khám": mở chi tiết, cuộn tới panel phiên khám (id "visits", màn chi tiết của B5).
    else if (action === 'add_visit') navigate(`${path}#visits`);
    else transitions.start(action, record);
  }

  return (
    <>
      <QueryErrorAlert error={counts.error} />
      <div className="dm-board">
        {COLUMNS.filter(({ status }) => status !== 'cancelled' || showCancelled).map(
          ({ status, collapsible }) => (
            <BoardColumn
              key={status}
              status={status}
              filter={filter}
              count={counts.data?.[status]}
              collapsed={collapsible && !expanded.has(status)}
              onToggle={collapsible ? () => toggle(status) : undefined}
              renderCard={(record) => (
                <RecordCard
                  key={record.medical_record_id}
                  record={record}
                  busy={transitions.pendingId === record.medical_record_id}
                  onAction={handleAction}
                />
              )}
            />
          ),
        )}
      </div>
      {transitions.modals}
    </>
  );
}
