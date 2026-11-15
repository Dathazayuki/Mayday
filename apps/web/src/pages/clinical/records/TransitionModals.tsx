import type { CloseMedicalRecordRequest } from '@drmayday/shared';
import { App } from 'antd';
import { useState, type ReactNode } from 'react';
import type { TransitionKind } from '../../../clinical/board-rules';
import {
  useAcceptMedicalRecord,
  useCancelMedicalRecord,
  useCloseMedicalRecord,
} from '../../../clinical/medical-records-api';
import { useRunAction } from '../../../components/crud/use-run-action';
import { AcceptModal, CompleteModal, type TransitionRecord } from './TransitionDialogs';

export type { TransitionRecord };

export interface Transitions {
  /** Mở hộp xác nhận của thao tác; API chỉ được gọi khi người dùng xác nhận (spec B, mục 8.6). */
  start: (kind: TransitionKind, record: TransitionRecord) => void;
  /** Hồ sơ đang chờ API trả lời (thẻ hiện đang xử lý, không kéo được); null khi không có. */
  pendingId: number | null;
  /** Hộp Tiếp nhận và Hoàn tất: trang render một lần. Hộp Huỷ là `modal.confirm`. */
  modals: ReactNode;
}

/**
 * Hộp xác nhận chuyển trạng thái (`TransitionModals`, spec B mục 8.6), dùng chung cho nút trên thẻ, kéo thả
 * và màn chi tiết: Tiếp nhận, Hoàn tất, Huỷ. Không cập nhật lạc quan: mutation làm mới danh sách các cột,
 * số đếm, chi tiết, lịch sử, Tổng quan; thẻ chỉ sang cột mới khi API trả 1000. Lỗi → message.error.
 */
export function useTransitions(): Transitions {
  const { modal } = App.useApp();
  const run = useRunAction();
  const accept = useAcceptMedicalRecord();
  const close = useCloseMedicalRecord();
  const cancel = useCancelMedicalRecord();
  const [dialog, setDialog] = useState<{
    kind: 'accept' | 'complete';
    record: TransitionRecord;
  } | null>(null);
  const dismiss = () => setDialog(null);

  async function submitAccept(record: TransitionRecord, roomId: number | undefined) {
    const id = record.medical_record_id;
    const body = roomId === undefined ? {} : { room_id: roomId };
    if (await run(() => accept.mutateAsync({ id, body }), `Đã tiếp nhận bệnh án #${id}`)) dismiss();
  }

  async function submitComplete(record: TransitionRecord, instructions: string | undefined) {
    const id = record.medical_record_id;
    const body: CloseMedicalRecordRequest =
      instructions === undefined ? { status: 'completed' } : { status: 'completed', instructions };
    if (await run(() => close.mutateAsync({ id, body }), `Đã hoàn tất bệnh án #${id}`)) dismiss();
  }

  /** Huỷ: hồ sơ đang khám qua PUT /:id (bác sĩ phụ trách), còn lại qua PATCH /:id/status (mục 8.6). */
  function confirmCancel(record: TransitionRecord) {
    const id = record.medical_record_id;
    modal.confirm({
      title: `Huỷ bệnh án #${id}?`,
      content: 'Không thể khôi phục.',
      okText: 'Huỷ bệnh án',
      okButtonProps: { danger: true },
      cancelText: 'Đóng',
      onOk: () =>
        run(
          () =>
            record.status === 'in_progress'
              ? close.mutateAsync({ id, body: { status: 'cancelled' } })
              : cancel.mutateAsync(id),
          `Đã huỷ bệnh án #${id}`,
        ),
    });
  }

  return {
    start: (kind, record) => {
      if (kind === 'cancel') confirmCancel(record);
      else setDialog({ kind, record });
    },
    pendingId: pendingRecordId(accept, close, cancel),
    modals: (
      <>
        <AcceptModal
          record={dialog?.kind === 'accept' ? dialog.record : null}
          saving={accept.isPending}
          onCancel={dismiss}
          onSubmit={(record, roomId) => void submitAccept(record, roomId)}
        />
        <CompleteModal
          record={dialog?.kind === 'complete' ? dialog.record : null}
          saving={close.isPending}
          onCancel={dismiss}
          onSubmit={(record, instructions) => void submitComplete(record, instructions)}
        />
      </>
    ),
  };
}

/** Mã hồ sơ của mutation đang chạy (mỗi lúc chỉ một hộp xác nhận nên nhiều nhất một). */
function pendingRecordId(
  accept: ReturnType<typeof useAcceptMedicalRecord>,
  close: ReturnType<typeof useCloseMedicalRecord>,
  cancel: ReturnType<typeof useCancelMedicalRecord>,
): number | null {
  if (accept.isPending) return accept.variables.id;
  if (close.isPending) return close.variables.id;
  if (cancel.isPending) return cancel.variables;
  return null;
}
