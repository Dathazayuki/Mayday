import { MEDICAL_RECORD_STATUSES, type MedicalRecordStatus } from '@drmayday/shared';
import {
  RECORD_TRANSITIONS,
  TRANSITION_TARGETS,
  transitionError,
  type RecordTransition,
} from './record-transitions.js';

/** Bảng spec B, mục 6.1: null = ✓ (được phép, còn phải qua kiểm tra người làm). */
const TABLE: Record<RecordTransition, Record<MedicalRecordStatus, string | null>> = {
  edit: { draft: null, pending: null, in_progress: null, completed: '4003', cancelled: '4009' },
  accept: {
    draft: '4004',
    pending: null,
    in_progress: '4005',
    completed: '4004',
    cancelled: '4004',
  },
  visit: {
    draft: '4009',
    pending: '4009',
    in_progress: null,
    completed: '4003',
    cancelled: '4009',
  },
  complete: {
    draft: '4009',
    pending: '4009',
    in_progress: null,
    completed: '4003',
    cancelled: '4009',
  },
  cancel_in_progress: {
    draft: '4009',
    pending: '4009',
    in_progress: null,
    completed: '4003',
    cancelled: '4009',
  },
  cancel: { draft: null, pending: null, in_progress: null, completed: '4003', cancelled: '4009' },
  delete: { draft: null, pending: null, in_progress: null, completed: null, cancelled: null },
};

const CELLS = RECORD_TRANSITIONS.flatMap((transition) =>
  MEDICAL_RECORD_STATUSES.map((status) => [transition, status, TABLE[transition][status]] as const),
);

describe('record-transitions (spec B, mục 6.1)', () => {
  it('đủ 7 hành động có ô trạng thái (tạo không có ô; draft → pending không có API, MT-113)', () => {
    expect(RECORD_TRANSITIONS).toEqual([
      'edit',
      'accept',
      'visit',
      'complete',
      'cancel_in_progress',
      'cancel',
      'delete',
    ]);
  });

  it.each(CELLS)('%s khi hồ sơ %s → %s', (transition, status, expected) => {
    expect(transitionError(transition, status)).toBe(expected);
  });

  it('tiếp nhận hồ sơ đang khám: bác sĩ phụ trách là người khác → 4005, là chính người gọi → 4004', () => {
    expect(transitionError('accept', 'in_progress', false)).toBe('4005');
    expect(transitionError('accept', 'in_progress', true)).toBe('4004');
  });

  it('callerIsAssigned chỉ đổi ô tiếp nhận khi đang khám', () => {
    for (const [transition, status, expected] of CELLS) {
      if (transition === 'accept' && status === 'in_progress') continue;
      expect(transitionError(transition, status, true)).toBe(expected);
    }
  });

  it('trạng thái đích; không có chuyển nào ra khỏi completed/cancelled (D-B7)', () => {
    expect(TRANSITION_TARGETS).toEqual({
      accept: 'in_progress',
      complete: 'completed',
      cancel_in_progress: 'cancelled',
      cancel: 'cancelled',
    });
    for (const transition of [
      'accept',
      'visit',
      'complete',
      'cancel_in_progress',
      'cancel',
    ] as const) {
      expect(transitionError(transition, 'completed')).not.toBeNull();
      expect(transitionError(transition, 'cancelled')).not.toBeNull();
    }
  });
});
