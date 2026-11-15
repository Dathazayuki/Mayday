import { RECORD_TYPES, type RecordType } from '@drmayday/shared';
import { Button, Checkbox, Segmented, Select, Switch } from 'antd';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { RECORD_TYPE_SHORT_LABELS } from '../../clinical/record-type';
import { recordsFilter, useRecordsView, type RecordsMode } from '../../clinical/records-view';
import { Page } from '../../layout/Page';
import { Panel, PanelToolbar } from '../../layout/Panel';
import { CreateRecordModal } from './records/CreateRecordModal';
import { RecordBoard } from './records/RecordBoard';
import { RecordTable } from './records/RecordTable';

/** Giá trị "Tất cả" của bộ lọc loại (không lọc). */
const ALL_TYPES = 'all';

const TYPE_OPTIONS = [
  { value: ALL_TYPES, label: 'Tất cả' },
  ...RECORD_TYPES.map((type) => ({ value: type, label: RECORD_TYPE_SHORT_LABELS[type] })),
];

const MODE_OPTIONS: { value: RecordsMode; label: string }[] = [
  { value: 'board', label: 'Cột' },
  { value: 'table', label: 'Bảng' },
];

/**
 * Trang bệnh án (spec B, mục 8.5): hai chế độ cột (mặc định, D-B25) và bảng, chế độ và bộ lọc nằm trên URL;
 * thanh lọc chung (loại, "Tôi phụ trách"); "Hiện bệnh án đã huỷ" chỉ ở chế độ cột; "Tạo bệnh án" mở hộp tạo
 * có ô tìm bệnh nhân.
 */
export function MedicalRecordsPage() {
  const { user } = useAuth();
  const [view, updateView] = useRecordsView();
  const [showCancelled, setShowCancelled] = useState(false);
  const [creating, setCreating] = useState(false);
  const filter = recordsFilter(view, user ? Number(user.user_id) : undefined);

  return (
    <Page
      title="Bệnh án"
      actions={
        <>
          <Segmented<RecordsMode>
            aria-label="Chế độ xem"
            options={MODE_OPTIONS}
            value={view.mode}
            onChange={(mode) => updateView({ mode })}
          />
          <Button type="primary" onClick={() => setCreating(true)}>
            Tạo bệnh án
          </Button>
        </>
      }
    >
      <Panel flush>
        <PanelToolbar>
          <Select<RecordType | typeof ALL_TYPES>
            aria-label="Lọc theo loại bệnh án"
            style={{ minWidth: 140 }}
            options={TYPE_OPTIONS}
            value={view.type ?? ALL_TYPES}
            onChange={(type) => updateView({ type: type === ALL_TYPES ? undefined : type })}
          />
          <Checkbox
            checked={view.mine}
            onChange={(event) => updateView({ mine: event.target.checked })}
          >
            Tôi phụ trách
          </Checkbox>
          {view.mode === 'board' && (
            <label className="dm-switch-label">
              <Switch
                size="small"
                aria-label="Hiện bệnh án đã huỷ"
                checked={showCancelled}
                onChange={setShowCancelled}
              />
              Hiện bệnh án đã huỷ
            </label>
          )}
        </PanelToolbar>
        {view.mode === 'board' ? (
          <RecordBoard filter={filter} showCancelled={showCancelled} />
        ) : (
          // Đổi bộ lọc thì dựng lại bảng để về trang 1.
          <RecordTable
            key={`${view.type ?? ALL_TYPES}-${view.mine}`}
            filter={filter}
            status={view.status}
            onStatusChange={(status) => updateView({ status })}
          />
        )}
      </Panel>
      <CreateRecordModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
}
