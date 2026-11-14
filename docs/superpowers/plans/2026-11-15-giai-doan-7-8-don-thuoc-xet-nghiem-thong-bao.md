# Giai đoạn 7–8 — Đơn thuốc, xét nghiệm, thông báo: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 7 API (kê đơn, chỉ định và xem kết quả xét nghiệm, 4 API thông báo) cùng màn hình Web và Mobile tương ứng.

**Spec:** [docs/superpowers/specs/2026-11-15-giai-doan-7-8-don-thuoc-xet-nghiem-thong-bao-design.md](../specs/2026-11-15-giai-doan-7-8-don-thuoc-xet-nghiem-thong-bao-design.md).

## Global Constraints

- **Toàn bộ Global Constraints của các giai đoạn 1–6a vẫn áp dụng:**
  - code sạch, cấu trúc nhất quán;
  - tên cột tiếng Việt chỉ nằm trong tầng truy cập dữ liệu;
  - mã lỗi chỉ lấy từ catalog;
  - không tự quyết mục "Chờ chốt";
  - commit message tiếng Việt kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Mọi trường trả về là string** (theo Sheet).
- **Đường dẫn đang chờ chốt được đặt trong hằng số** (`NOTIFICATION_PATHS`), client chỉ dùng hằng số đó.

---

### Task G7-1: Hợp đồng đơn thuốc, xét nghiệm, thông báo (shared)

**Files:** Create `packages/shared/src/contracts/prescriptions.ts`, `contracts/labs.ts`, `contracts/notifications.ts`, `packages/shared/src/notifications.spec.ts`; Modify `index.ts`.

- [ ] **Step 1: Test trước** (`notifications.spec.ts`):
  - `NOTIFICATION_PATHS.registerToken` = `/notifications/register_token`;
  - `NOTIFICATION_PATHS.markRead('12')` = `/notifications/12/read`;
  - `NOTIFICATION_TYPE_LABELS` có nhãn cho `appointment`, `lab_result`, `general`, `prescription`, `lab_request`, `medical_record`;
  - `isUnread({is_read:'0'})` = true.
- [ ] **Step 2: Cài đặt.** `contracts/prescriptions.ts`:

```ts
/** Một dòng thuốc theo Sheet rx01 (MT-14: cấu trúc CSDL khác, chờ chốt). */
export interface PrescriptionItemInput {
  medicine_name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instruction?: string;
}

/** POST /api/v1/prescriptions. */
export interface CreatePrescriptionRequest {
  medical_record_id: string;
  note?: string;
  items: PrescriptionItemInput[];
}

export interface PrescriptionItemData {
  prescription_item_id: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instruction: string | null;
}

/** data của POST /prescriptions (1001) — mọi trường là chuỗi. */
export interface PrescriptionData {
  prescription_id: string;
  medical_record_id: string;
  created_by: string;
  note: string | null;
  items: PrescriptionItemData[];
  created_at: string;
}
```

`contracts/labs.ts`:

```ts
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
```

`contracts/notifications.ts`:

```ts
export const DEVICE_TYPES = ['android', 'ios', 'web'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/** Đường dẫn chờ chốt (MT-03, MT-04): server nhận cả hai cách, client chỉ dùng hằng số này. */
export const NOTIFICATION_PATHS = {
  list: '/notifications',
  registerToken: '/notifications/register_token',
  markRead: (id: string) => `/notifications/${encodeURIComponent(id)}/read`,
  remove: (id: string) => `/notifications/${encodeURIComponent(id)}`,
} as const;

export interface RegisterTokenRequest {
  fcm_token: string;
  device_type: DeviceType;
}

export interface FcmTokenData {
  id: string;
  user_id: string;
  fcm_token: string;
  device_type: DeviceType;
  created_at: string;
  updated_at: string;
}

export interface NotificationData {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  avatar: string | null;
  reference_id: string | null;
  is_read: '0' | '1';
  created_at: string;
  updated_at: string;
}

export const NOTIFICATION_TYPE_LABELS: Readonly<Record<string, string>> = {
  appointment: 'Lịch hẹn',
  lab_result: 'Kết quả xét nghiệm',
  lab_request: 'Chỉ định xét nghiệm',
  prescription: 'Đơn thuốc',
  medical_record: 'Bệnh án',
  general: 'Thông báo chung',
};

export function isUnread(notification: Pick<NotificationData, 'is_read'>): boolean {
  return notification.is_read === '0';
}
```

  `index.ts` export 3 file contracts mới.
- [ ] **Step 3:** Chạy test, build, typecheck, lint, prettier. Commit `feat(shared): hợp đồng đơn thuốc, xét nghiệm và thông báo`.

---

### Task G7-2: API đơn thuốc, xét nghiệm, thông báo

**Files:**
- Modify: schema (6 bảng theo spec mục 2), `test/db/helpers.ts`
- Create: `apps/api/src/prescriptions/`, `apps/api/src/labs/`, `apps/api/src/notifications/` (controller/service (+ spec)/repository/mapping/dto/module; `push-sender.ts` bản dev ghi log)
- Create: `test/db/prescriptions.db-spec.ts`, `labs.db-spec.ts`, `notifications.db-spec.ts`

- [ ] **Step 1: Test trước** mỗi nhánh mã lỗi trong spec mục 1, gồm:
  - hai đường dẫn của MT-03/MT-04 đều chạy;
  - thông báo được tạo khi kê đơn, chỉ định xét nghiệm, chốt bệnh án.
- [ ] **Step 2: Cài đặt.**
  - Việc tạo thông báo từ các module khác đi qua `NotificationsService.notify(userId, {title, body, type, referenceId})`.
  - Các module khác không gọi repository của thông báo trực tiếp.
- [ ] **Step 3:** Chạy toàn bộ kiểm tra của API. Commit `feat(api): kê đơn, chỉ định và kết quả xét nghiệm, thông báo`.

---

### Task G7-3: Web — đơn thuốc, xét nghiệm, chuông thông báo

**Files:**
- Create: `apps/web/src/clinical/prescriptions-api.ts`, `labs-api.ts`, `apps/web/src/notifications/notifications-api.ts`
- Create: các mục mới trong màn chi tiết bệnh án (`PrescriptionPanel`, `LabPanel` + test)
- Create: `apps/web/src/layout/NotificationBell.tsx` (+ test)

- [ ] **Step 1: Test trước:**
  - kê đơn: thêm/xoá dòng, thiếu tên thuốc thì chặn ở client, gửi đúng body, 8003 hiển thị thông báo;
  - chỉ định xét nghiệm: tương tự;
  - bảng kết quả: hiển thị trạng thái và kết quả, `null` thì hiện "Chưa có kết quả";
  - chuông thông báo: số chưa đọc; bấm một thông báo thì PUT theo `NOTIFICATION_PATHS.markRead`; xoá.
- [ ] **Step 2: Cài đặt** theo spec mục 3.
- [ ] **Step 3:** Chạy test, build, lint, typecheck. Commit `feat(web): kê đơn, chỉ định xét nghiệm và chuông thông báo`.

---

### Task G7-4: Mobile — kết quả xét nghiệm và tab Thông báo

**Files:**
- Create: `apps/mobile/src/lib/labs-api.ts`, `apps/mobile/src/lib/notifications-api.ts`, `apps/mobile/src/components/notifications/*`
- Modify: `apps/mobile/src/app/records/[id].tsx` (thêm mục kết quả xét nghiệm), `apps/mobile/src/app/(tabs)/notifications.tsx`

- [ ] **Step 1: Cài đặt** theo spec mục 4.
  - Chữ ≥ 18, nút ≥ 56px.
  - Có trạng thái loading, lỗi, thử lại, rỗng.
  - Có bộ đếm request để bỏ phản hồi cũ.
- [ ] **Step 2:** Chạy mobile typecheck, `pnpm lint`, `pnpm typecheck`, `expo export`, `npx expo-doctor`. Commit `feat(mobile): xem kết quả xét nghiệm và tab thông báo`.
