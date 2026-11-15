import {
  MEDICAL_RECORD_STATUSES,
  RECORD_TYPES,
  type MedicalRecordCountsQuery,
  type MedicalRecordStatus,
  type RecordType,
} from '@drmayday/shared';
import { useSearchParams } from 'react-router';

/** Chế độ của trang bệnh án (spec B, mục 8.5): cột kiểu Trello (mặc định, D-B25) hoặc bảng. */
export type RecordsMode = 'board' | 'table';

/** Trạng thái của trang bệnh án trên URL (spec B, mục 8.1): `view`, `status`, `type`, `mine=1`. */
export interface RecordsView {
  mode: RecordsMode;
  /** Tab của chế độ bảng; undefined = "Tất cả". */
  status?: MedicalRecordStatus;
  type?: RecordType;
  /** "Tôi phụ trách": bác sĩ phụ trách là người đăng nhập. */
  mine: boolean;
}

function oneOf<T extends string>(values: readonly T[], value: string | null): T | undefined {
  return values.find((item) => item === value);
}

/** Đọc từ URL; giá trị lạ về mặc định (chế độ cột, không lọc). */
export function parseRecordsView(params: URLSearchParams): RecordsView {
  return {
    mode: params.get('view') === 'table' ? 'table' : 'board',
    status: oneOf(MEDICAL_RECORD_STATUSES, params.get('status')),
    type: oneOf(RECORD_TYPES, params.get('type')),
    mine: params.get('mine') === '1',
  };
}

/** Ghi lên URL: luôn có `view`; `status` chỉ ở chế độ bảng (cột không dùng); bỏ bộ lọc rỗng. */
export function recordsViewParams(view: RecordsView): URLSearchParams {
  const params = new URLSearchParams({ view: view.mode });
  if (view.mode === 'table' && view.status) params.set('status', view.status);
  if (view.type) params.set('type', view.type);
  if (view.mine) params.set('mine', '1');
  return params;
}

/** Bộ lọc chung của hai chế độ (spec B, mục 8.5): loại, "Tôi phụ trách" = `doctor_id` của người đăng nhập. */
export function recordsFilter(
  view: RecordsView,
  userId: number | undefined,
): MedicalRecordCountsQuery {
  return { record_type: view.type, doctor_id: view.mine ? userId : undefined };
}

/** Trạng thái trang bệnh án trên URL; mỗi lần đổi thay mục lịch sử hiện tại, không thêm mục mới. */
export function useRecordsView(): [RecordsView, (changes: Partial<RecordsView>) => void] {
  const [params, setParams] = useSearchParams();
  const view = parseRecordsView(params);
  return [
    view,
    (changes) => setParams(recordsViewParams({ ...view, ...changes }), { replace: true }),
  ];
}
