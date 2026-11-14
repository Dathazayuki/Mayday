# Giai đoạn 6a — Điểm UAS7: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 API UAS7, màn chấm điểm hằng ngày cho bệnh nhân (Mobile) và mục xem điểm UAS7 cho bác sĩ (Web).

**Architecture:** Module `uas7` theo khuôn các giai đoạn trước. Hằng số, nhãn và hàm tính điểm đặt trong `packages/shared`, dùng chung cho cả ba phía.

**Spec:** [docs/superpowers/specs/2026-11-15-giai-doan-6a-uas7-design.md](../specs/2026-11-15-giai-doan-6a-uas7-design.md).

## Global Constraints

- **Toàn bộ Global Constraints của các giai đoạn 1–4 vẫn áp dụng:**
  - code sạch, cấu trúc nhất quán;
  - tên cột tiếng Việt chỉ nằm trong tầng truy cập dữ liệu;
  - mã lỗi chỉ lấy từ catalog;
  - không tự quyết mục "Chờ chốt";
  - commit message tiếng Việt kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Mọi trường trả về của API UAS7 là string.**
- **Nhãn ISS7/HSS7** chỉ lấy từ `UAS7_FIELD_LABELS` (MT-11).

---

### Task G6-1: Hợp đồng và tiện ích UAS7 (shared)

**Files:** Create `packages/shared/src/contracts/uas7.ts`, `packages/shared/src/uas7.ts`, `packages/shared/src/uas7.spec.ts`; Modify `packages/shared/src/index.ts`.

- [ ] **Step 1: Test trước** (`uas7.spec.ts`):
  - `uas7SeverityLabel`: 0 → "Không có"; 1 và 15 → "Nhẹ"; 16 và 27 → "Trung bình"; 28 và 42 → "Nặng"; âm hoặc lớn hơn 42 → ném `RangeError`.
  - `dailyScore('2','1')` = 3.
  - `isValidUas7Score`: `'0'` và `'3'` ✓; `'4'`, `'-1'`, `'1.5'`, `''`, `'a'` ✗; số `2` ✓.
- [ ] **Step 2: Cài đặt.** `contracts/uas7.ts`:

```ts
/** GET /api/v1/uas7-scores/eligibility — mọi giá trị là chuỗi (slide uas701). */
export interface Uas7EligibilityData {
  eligible: 'true' | 'false';
  medical_record_id?: string;
}

/** POST /api/v1/uas7-scores — điểm truyền dạng chuỗi số "0".."3". */
export interface CreateUas7ScoreRequest {
  medical_record_id: string;
  score_date: string;
  iss7: string;
  hss7: string;
  note?: string;
}

/** Bản ghi điểm UAS7 (POST trả mảng 1 phần tử — MT-75; GET lịch sử trả mảng). */
export interface Uas7ScoreData {
  patient_id: string;
  medical_record_id: string;
  score_date: string;
  iss7: string;
  hss7: string;
  daily_score: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/uas7-scores/week/:patientId — thêm start_date/end_date để hiển thị kỳ tính. */
export interface Uas7WeekData {
  patient_id: string;
  week_score: string;
  severity_label: string;
  completed_days: string;
  start_date: string;
  end_date: string;
}
```

`uas7.ts`:

```ts
export const UAS7_SCORE_MIN = 0;
export const UAS7_SCORE_MAX = 3;
export const UAS7_WEEK_MAX = 42;

/** Nhãn hiển thị — nghĩa theo Sheet/slide/CSDL; đổi tại đây nếu MT-11 chốt theo quy ước quốc tế. */
export const UAS7_FIELD_LABELS = { iss7: 'Điểm sẩn', hss7: 'Điểm ngứa' } as const;

export const UAS7_LEVEL_LABELS: Readonly<Record<number, string>> = {
  0: 'Không có',
  1: 'Nhẹ',
  2: 'Vừa',
  3: 'Nặng',
};

/** Điểm hợp lệ 0..3, nhận chuỗi số (API) hoặc số nguyên. */
export function isValidUas7Score(value: unknown): boolean {
  const text = typeof value === 'number' ? String(value) : value;
  return typeof text === 'string' && /^[0-3]$/.test(text);
}

export function dailyScore(iss7: string | number, hss7: string | number): number {
  return Number(iss7) + Number(hss7);
}

/** Nhãn mức độ theo tổng điểm tuần (ngưỡng tạm theo MT-76). */
export function uas7SeverityLabel(weekScore: number): string {
  if (!Number.isInteger(weekScore) || weekScore < 0 || weekScore > UAS7_WEEK_MAX) {
    throw new RangeError(`Điểm UAS7 tuần không hợp lệ: ${weekScore}`);
  }
  if (weekScore === 0) return 'Không có';
  if (weekScore <= 15) return 'Nhẹ';
  if (weekScore <= 27) return 'Trung bình';
  return 'Nặng';
}
```

  `index.ts` export `./contracts/uas7.js` và `./uas7.js`.
- [ ] **Step 3:** Chạy test, build, typecheck, lint, prettier. Commit `feat(shared): hợp đồng và tiện ích điểm UAS7`.

---

### Task G6-2: API UAS7 (4 API)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`uas7_scores` theo spec mục 1), `apps/api/test/db/helpers.ts`
- Create: `apps/api/src/uas7/` (`uas7.controller.ts`, `uas7.service.ts` (+ spec), `uas7.repository.ts`, `uas7-mapping.ts` (+ spec), `dto/*`, `uas7.module.ts`)
- Create: `apps/api/test/db/uas7.db-spec.ts`

- [ ] **Step 1: Test trước:**
  - mỗi nhánh mã lỗi trong spec mục 2: 5001–5005, 2006, 2003 (ngày tương lai), 3104, 3106, 3007;
  - `uas7_score_id` đúng định dạng `p<id>_<YYMMDD>`;
  - lỗi UNIQUE khi gửi đồng thời → 5002;
  - tổng tuần và `completed_days`.
- [ ] **Step 2: Cài đặt.**
  - Route `week/:patientId` và `patient/:patient_id` khai báo theo Sheet.
  - Ngày "hôm nay" tính theo múi giờ `Asia/Ho_Chi_Minh`, đặt một hằng số ở module.
- [ ] **Step 3: Test tích hợp** theo spec mục 6.
- [ ] **Step 4:** Chạy toàn bộ kiểm tra của API. Commit `feat(api): điểm UAS7 hằng ngày, lịch sử và tổng tuần`.

---

### Task G6-3: Mobile — chấm điểm UAS7

**Files:**
- Create: `apps/mobile/src/lib/uas7-api.ts`, `apps/mobile/src/components/uas7/*` (ScorePicker, WeekCard, HistoryList)
- Modify: `apps/mobile/src/app/(tabs)/uas7.tsx`

- [ ] **Step 1: Cài đặt** theo spec mục 4.
  - Dùng `UAS7_FIELD_LABELS`, `UAS7_LEVEL_LABELS`, `isValidUas7Score`, `dailyScore` và các kiểu trong shared.
  - Ngày hôm nay lấy giờ địa phương của máy, định dạng `YYYY-MM-DD` bằng một hàm duy nhất.
  - Nút cao ≥ 56px, chữ ≥ 18.
  - Có trạng thái loading, lỗi và thử lại; pull-to-refresh.
- [ ] **Step 2:** Chạy mobile typecheck, `pnpm lint`, `pnpm typecheck`, `expo export`, `npx expo-doctor`. Commit `feat(mobile): chấm điểm UAS7 hằng ngày và xem tổng tuần`.

---

### Task G6-4: Web — điểm UAS7 trong màn bệnh án

**Files:** `apps/web/src/clinical/uas7-api.ts`, `apps/web/src/pages/clinical/medical-record/Uas7Panel.tsx` (+ test, hoặc đặt theo cấu trúc mà G4-3 đã tạo), gắn vào `MedicalRecordDetailPage`.

- [ ] **Step 1: Test trước:**
  - Panel hiển thị tổng tuần dạng "x/42", nhãn mức độ, số ngày đã chấm;
  - bảng lịch sử dùng nhãn trong `UAS7_FIELD_LABELS`;
  - lỗi hiển thị bằng `describeError`.
- [ ] **Step 2: Cài đặt** theo spec mục 5.
- [ ] **Step 3:** Chạy test, build, lint, typecheck. Commit `feat(web): xem điểm UAS7 của bệnh nhân trong bệnh án`.
