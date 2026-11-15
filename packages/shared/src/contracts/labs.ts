export const LAB_REQUEST_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export type LabRequestStatus = (typeof LAB_REQUEST_STATUSES)[number];

export const LAB_REQUEST_STATUS_LABELS: Record<LabRequestStatus, string> = {
  pending: 'Chờ thực hiện',
  in_progress: 'Đang thực hiện',
  completed: 'Đã có kết quả',
};

/** POST /api/v1/lab-requests. */
export interface CreateLabRequestRequest {
  medical_record_id: string;
  note?: string;
  items: { test_name: string; description?: string }[];
}

/** data của POST /lab-requests (1001). */
export interface LabRequestData {
  id: string;
  medical_record_id: string;
  requested_by: string;
  status: LabRequestStatus;
  note: string | null;
  items: { id: string; test_name: string; description: string | null }[];
  created_at: string;
}

/** GET /api/v1/lab-results/:record_id phần tử. Trường kết quả null khi chưa có (MT-78). */
export interface LabResultRequestData {
  id: string;
  requested_by: string;
  status: LabRequestStatus;
  note: string | null;
  items: {
    id: string;
    test_name: string;
    result_id: string | null;
    result_value: string | null;
    concluded_by: string | null;
    result_note: string | null;
  }[];
  created_at: string;
}
