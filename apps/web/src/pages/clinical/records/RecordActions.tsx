import {
  MEDICAL_RECORD_ACTION_LABELS,
  type MedicalRecordAction,
  type MedicalRecordData,
} from '@drmayday/shared';
import { App, Button } from 'antd';
import { useNavigate } from 'react-router';
import { useDeleteMedicalRecord } from '../../../clinical/medical-records-api';
import { useRunAction } from '../../../components/crud/use-run-action';
import type { Transitions } from './TransitionModals';

/** Thao tác trên đầu màn chi tiết, theo thứ tự của spec B mục 8.7. */
const HEADER_ACTIONS = ['accept', 'add_visit', 'complete', 'cancel', 'delete'] as const;

const PRIMARY: ReadonlySet<MedicalRecordAction> = new Set(['accept', 'complete']);
const DANGER: ReadonlySet<MedicalRecordAction> = new Set(['cancel', 'delete']);

/**
 * Nút "Tiếp nhận / Thêm phiên khám / Hoàn tất / Huỷ / Xoá" của màn chi tiết (spec B, mục 8.7), chỉ những
 * nút có trong `allowed_actions`. Tiếp nhận, Hoàn tất, Huỷ mở hộp xác nhận dùng chung (`useTransitions`);
 * Xoá (admin, D-B22) hỏi lại rồi về trang bệnh án.
 */
export function RecordActions({
  record,
  transitions,
  onAddVisit,
}: {
  record: MedicalRecordData;
  transitions: Transitions;
  onAddVisit: () => void;
}) {
  const { modal } = App.useApp();
  const run = useRunAction();
  const navigate = useNavigate();
  const remove = useDeleteMedicalRecord();
  const id = record.medical_record_id;
  const busy = transitions.pendingId === id || remove.isPending;

  function confirmDelete() {
    modal.confirm({
      title: `Xoá bệnh án #${id}?`,
      content: 'Xoá cả các phiên khám của bệnh án. Không thể khôi phục.',
      okText: 'Xoá bệnh án',
      okButtonProps: { danger: true },
      cancelText: 'Đóng',
      onOk: () =>
        run(async () => {
          await remove.mutateAsync(id);
          navigate('/medical-records');
        }, `Đã xoá bệnh án #${id}`),
    });
  }

  function handle(action: (typeof HEADER_ACTIONS)[number]) {
    if (action === 'add_visit') onAddVisit();
    else if (action === 'delete') confirmDelete();
    else transitions.start(action, record);
  }

  return HEADER_ACTIONS.filter((action) => record.allowed_actions.includes(action)).map(
    (action) => (
      <Button
        key={action}
        type={PRIMARY.has(action) ? 'primary' : 'default'}
        danger={DANGER.has(action)}
        disabled={busy}
        onClick={() => handle(action)}
      >
        {MEDICAL_RECORD_ACTION_LABELS[action]}
      </Button>
    ),
  );
}
