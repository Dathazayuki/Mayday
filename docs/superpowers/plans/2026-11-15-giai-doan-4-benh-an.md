# Giai đoạn 4 — Bệnh nhân và hồ sơ bệnh án: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 16 API bệnh nhân và bệnh án, phiếu khám động hiển thị được trên Web (bác sĩ) và Mobile (bệnh nhân).

**Architecture:**
- Hai module Nest `patients` (docpat01–02) và `medical-records` (medrec*), theo khuôn của các giai đoạn trước.
- Chuyển đổi câu trả lời ↔ trạng thái form là hàm thuần trong `packages/shared`, dùng chung cho Web và Mobile.

**Tech Stack:** NestJS 12, Prisma 7 + MySQL 8.4 (dev), React 19 + antd 6, Expo 58.

**Spec:** [docs/superpowers/specs/2026-11-15-giai-doan-4-benh-an-design.md](../specs/2026-11-15-giai-doan-4-benh-an-design.md).

## Global Constraints

- **Toàn bộ Global Constraints của các giai đoạn 1–3 vẫn áp dụng:**
  - code sạch, cấu trúc nhất quán;
  - Prisma và tên cột tiếng Việt chỉ nằm trong tầng truy cập dữ liệu (`*.repository.ts` cùng file mapping cạnh nó); service không bao giờ gọi tên cột;
  - mã lỗi chỉ lấy từ catalog;
  - không tự quyết mục "Chờ chốt";
  - commit message tiếng Việt kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Kiểu ID theo từng tab Sheet:** bệnh án dùng int, `template_id`/`question_id` là string, `PATCH status` trả string.

---

### Task G4-1: Hợp đồng bệnh án và chuyển đổi câu trả lời (shared)

**Files:**
- Create: `packages/shared/src/contracts/patients.ts`, `packages/shared/src/contracts/medical-records.ts`, `packages/shared/src/form-answers.ts`, `packages/shared/src/form-answers.spec.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Test trước** (`form-answers.spec.ts`). Dùng một mẫu gồm các câu: radio (YES/NO, `id` lựa chọn `'11'`/`'12'`), checkbox (A/B/C), number, text, date, câu con của radio với `show_if_answer` `["YES"]`, và một câu `image_upload`.
  - `answersToState`:
    - radio lấy `answer_value`; nếu không có thì tra `option_value` theo `question_option_id`;
    - checkbox ra mảng;
    - number ra chuỗi;
    - text/date lấy `answer_text`;
    - `image_upload` bị bỏ qua;
    - câu trả lời của câu hỏi không có trong mẫu bị bỏ qua.
  - `collectVisibleQuestions`: câu con chỉ có trong kết quả khi câu cha là YES; câu con của câu bị ẩn cũng bị ẩn.
  - `stateToAnswerInputs`:
    - radio → `{question_id, question_option_id: 11, answer_value: 'YES'}`;
    - checkbox → `{question_id, answer_value: ['A','C']}`;
    - number `'7'` → `answer_value: 7`, `'abc'` thì bỏ qua;
    - text → `answer_text`; chuỗi rỗng hoặc mảng rỗng thì bỏ qua;
    - chỉ lấy câu hỏi được truyền vào (người gọi truyền danh sách câu đang hiển thị).
- [ ] **Step 2: Cài đặt.** `contracts/patients.ts`:

```ts
import type { Gender } from '../options.js';
import type { SignupRequest } from './auth.js';
import type { PatientEditableField, PatientProfileData, PatientProfileFields } from './profile.js';

/** GET /api/v1/doctor/patients/search — total nằm ngoài data (MT-35). */
export interface PatientSearchQuery {
  keyword?: string;
  gender?: Gender;
  min_year?: number;
  max_year?: number;
  page?: number;
  limit?: number;
}

export interface PatientSearchItem {
  user_id: number;
  full_name: string;
  phone: string;
  gender: Gender | null;
  year_of_birth: number | null;
}

/** POST /api/v1/doctor/patients/create (MT-02): tài khoản + hồ sơ bệnh nhân. */
export type CreatePatientRequest = SignupRequest &
  Partial<{ [K in PatientEditableField]: PatientProfileFields[K] }>;

export type CreatePatientResponseData = PatientProfileData & { created_at: string };
```

`contracts/medical-records.ts`:

```ts
import type { QuestionType } from './templates.js';

export const MEDICAL_RECORD_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type MedicalRecordStatus = (typeof MEDICAL_RECORD_STATUSES)[number];

/** GET /api/v1/medical_records/classify-questions phần tử. */
export interface ClassifyQuestion {
  question_id: string;
  question_text: string;
  type_question: QuestionType;
  options: { id: number; option_text: string; option_value: string }[];
}

export interface ClassifyRequest {
  answers: { question_id: string; option_value: string }[];
}

export interface ClassifyResponseData {
  template_id: string;
  template_name: string;
}

/** Một câu trả lời gửi lên (POST /medical_records, PUT /:id/answers). */
export interface AnswerInput {
  question_id: string;
  question_option_id?: number | null;
  answer_text?: string | null;
  /** JSON tuỳ kiểu câu hỏi: option_value (radio), mảng option_value (checkbox), số (number). */
  answer_value?: unknown;
}

/** POST /api/v1/medical_records — bệnh nhân bỏ qua patient_id. */
export interface CreateMedicalRecordRequest {
  patient_id?: number;
  template_id: string;
  answers?: AnswerInput[];
}

export interface MedicalRecordCreatedData {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  created_by: number | null;
  template_id: string;
  status: MedicalRecordStatus;
  instructions: string | null;
  created_at: string;
}

export interface MedicalRecordListQuery {
  status?: MedicalRecordStatus;
  patient_id?: number;
  page?: number;
  limit?: number;
}

/** GET /api/v1/medical_records/all phần tử (total ngoài data). */
export interface MedicalRecordListItem {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  template_id: string | null;
  status: MedicalRecordStatus;
  created_at: string;
}

/** GET/PUT /api/v1/medical_records/:id. */
export interface MedicalRecordData {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  created_by: number | null;
  template_id: string | null;
  status: MedicalRecordStatus;
  instructions: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicalRecordSummary {
  medical_record_id: number;
  status: MedicalRecordStatus;
  patient_name: string;
  created_at: string;
}

export interface MedicalRecordHistoryItem {
  medical_record_id: number;
  status: MedicalRecordStatus;
  instructions: string | null;
  created_at: string;
}

export interface AcceptMedicalRecordData {
  medical_record_id: number;
  assigned_doctor_id: number;
  status: MedicalRecordStatus;
}

/** PUT /api/v1/medical_records/:id — chốt bệnh án. */
export interface CloseMedicalRecordRequest {
  status: 'completed' | 'cancelled';
  instructions?: string | null;
}

/** GET /api/v1/medical_records/:id/answers phần tử. */
export interface AnswerData {
  id: number;
  medical_record_id: number;
  question_id: string;
  question_option_id: number | null;
  answer_text: string | null;
  answer_value: unknown;
  answered_by: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertAnswersRequest {
  answers: AnswerInput[];
}

/** data của PUT/POST /:id/answers (POST trả trong data theo MT-72). */
export interface AnswersCountData {
  count: number;
}

/** POST /api/v1/medical_records/:id/answers — Sheet dùng option_id kiểu string. */
export interface AddAnswersRequest {
  answers: { question_id: string; answer_text?: string; option_id?: string }[];
}

/** PATCH /api/v1/medical_records/:id/status — Sheet chỉ cho cancelled; data kiểu string theo tab. */
export interface UpdateMedicalRecordStatusRequest {
  status: 'cancelled';
}

export interface MedicalRecordStatusData {
  id: string;
  status: MedicalRecordStatus;
}
```

`form-answers.ts`:

```ts
import type { AnswerData, AnswerInput } from './contracts/medical-records.js';
import type { QuestionData } from './contracts/templates.js';
import { buildQuestionTree, isQuestionVisible, type AnswerValue, type QuestionNode } from './form-tree.js';

/** Trạng thái form: radio/text/date/number → chuỗi, checkbox → mảng option_value. */
export type FormState = Record<string, AnswerValue>;

const IGNORED_TYPES = new Set(['image_upload', 'group_questions']);

/** Câu trả lời từ API → trạng thái form (bỏ câu không thuộc mẫu và câu không có giá trị). */
export function answersToState(questions: readonly QuestionData[], answers: readonly AnswerData[]): FormState {
  const byId = new Map(questions.map((q) => [q.question_id, q]));
  const state: FormState = {};
  for (const answer of answers) {
    const question = byId.get(answer.question_id);
    if (!question || IGNORED_TYPES.has(question.type_question)) continue;
    const value = toStateValue(question, answer);
    if (value !== undefined) state[question.question_id] = value;
  }
  return state;
}

function toStateValue(question: QuestionData, answer: AnswerData): AnswerValue {
  switch (question.type_question) {
    case 'radio': {
      if (typeof answer.answer_value === 'string') return answer.answer_value;
      const option = question.options.find((o) => Number(o.id) === answer.question_option_id);
      return option?.option_value;
    }
    case 'checkbox':
      return Array.isArray(answer.answer_value)
        ? answer.answer_value.filter((v): v is string => typeof v === 'string')
        : undefined;
    case 'number':
      return typeof answer.answer_value === 'number' ? String(answer.answer_value) : undefined;
    default:
      return answer.answer_text ?? undefined;
  }
}

/** Các câu hỏi đang hiển thị theo trạng thái hiện tại (duyệt cây, dừng ở nút bị ẩn). */
export function collectVisibleQuestions(questions: readonly QuestionData[], state: FormState): QuestionData[] {
  const visible: QuestionData[] = [];
  const walk = (nodes: QuestionNode[]) => {
    for (const node of nodes) {
      if (!isQuestionVisible(node.question, state)) continue;
      visible.push(node.question);
      walk(node.children);
    }
  };
  walk(buildQuestionTree(questions));
  return visible;
}

/** Trạng thái form → câu trả lời gửi API, chỉ cho các câu hỏi được truyền vào (thường là câu đang hiển thị). */
export function stateToAnswerInputs(questions: readonly QuestionData[], state: FormState): AnswerInput[] {
  const inputs: AnswerInput[] = [];
  for (const question of questions) {
    if (IGNORED_TYPES.has(question.type_question)) continue;
    const input = toAnswerInput(question, state[question.question_id]);
    if (input) inputs.push(input);
  }
  return inputs;
}

function toAnswerInput(question: QuestionData, value: AnswerValue): AnswerInput | undefined {
  const { question_id } = question;
  switch (question.type_question) {
    case 'radio': {
      const option = typeof value === 'string' ? question.options.find((o) => o.option_value === value) : undefined;
      return option ? { question_id, question_option_id: Number(option.id), answer_value: option.option_value } : undefined;
    }
    case 'checkbox':
      return Array.isArray(value) && value.length > 0 ? { question_id, answer_value: [...value] } : undefined;
    case 'number': {
      const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
      return Number.isFinite(number) ? { question_id, answer_value: number } : undefined;
    }
    default:
      return typeof value === 'string' && value.trim() !== '' ? { question_id, answer_text: value.trim() } : undefined;
  }
}
```

  `index.ts` export 2 file contracts và `./form-answers.js`.
- [ ] **Step 3:** Chạy test, build, typecheck, lint; chạy prettier trên file mới. Commit `feat(shared): hợp đồng bệnh án và chuyển đổi câu trả lời phiếu khám`.

---

### Task G4-2: API bệnh nhân và bệnh án (16 API)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`medical_records`, `answers` theo spec mục 2), `seed.ts` (quyền mục 3, mẫu `TMPL_CLASSIFY`), `test/db/helpers.ts`
- Create: `apps/api/src/patients/` (`patients.controller.ts`, `patients.service.ts` (+ spec), `dto/*`, `patients.module.ts`; dùng lại `UsersRepository` và thêm `searchPatients` ở tầng users)
- Create: `apps/api/src/medical-records/` (`medical-records.controller.ts`, `medical-records.service.ts` (+ spec), `answers.service.ts` (+ spec), `classification.service.ts` (+ spec), `classification-rules.ts`, `medical-records.repository.ts`, `medical-record-mapping.ts` (+ spec), `dto/*`, `medical-records.module.ts`)
- Modify: `apps/api/src/templates/templates.service.ts` (4105)
- Create: `apps/api/test/db/patients.db-spec.ts`, `apps/api/test/db/medical-records.db-spec.ts`

- [ ] **Step 1:** Schema, `db push` lên CSDL test (qua `test:db`), cập nhật `resetData`.
- [ ] **Step 2: Test trước:**
  - unit test mỗi nhánh mã lỗi trong spec mục 4: 3006, 3007, 3105, 3106, 4001, 4003, 4004, 4005, 4006, 4007, 4008, 4009, 4101, 4105;
  - quyền theo spec mục 3;
  - luật phân loại.
- [ ] **Step 3: Cài đặt** theo spec mục 3–5.
  - **Quyền:** dùng `@RequirePermission` cho quyền của nhân viên; bệnh nhân được nhận ra qua vai trò `patient` (`RolesRepository`).
  - **Thứ tự route:** các route `all`, `classify-questions`, `classify`, `patients/:id/history` phải đứng trước `:id`.
- [ ] **Step 4: Test tích hợp.**
  - Luồng chính: bệnh nhân tự tạo bệnh án kèm câu trả lời; bác sĩ thấy bệnh án trong `all?status=pending`, tiếp nhận rồi sửa câu trả lời; bác sĩ khác chốt → 3105; bác sĩ phụ trách chốt `completed` → `completed_at` có giá trị; sửa câu trả lời sau đó → 4003.
  - Bảo vệ dữ liệu và nhánh lỗi: bệnh nhân B xem lịch sử của A → 3106; admin xoá bệnh án thì câu trả lời mất theo; xoá mẫu đang được dùng → 4105; phân loại thiếu câu trả lời → 4006.
- [ ] **Step 5:** Chạy toàn bộ kiểm tra của API. Commit `feat(api): bệnh nhân và hồ sơ bệnh án (tạo, tiếp nhận, câu trả lời, chốt)`.

---

### Task G4-3: Web — bệnh nhân, danh sách và màn khám bệnh án

**Files:**
- Create: `apps/web/src/clinical/patients-api.ts`, `apps/web/src/clinical/medical-records-api.ts`
- Create: `apps/web/src/pages/clinical/PatientsPage.tsx`, `MedicalRecordsPage.tsx`, `MedicalRecordDetailPage.tsx` (+ test), `apps/web/src/components/dynamic-form/*` (`DynamicForm` + test)
- Modify: `menu.ts`, `routes.tsx`

- [ ] **Step 1: Test trước:**
  - `DynamicForm`:
    - hiển thị theo kiểu câu hỏi;
    - câu con hiện hoặc ẩn theo `show_if_answer`;
    - chế độ chỉ đọc;
    - section ngoài `filled_by` cho phép thì chỉ đọc.
  - `PatientsPage`: tìm kiếm có bộ lọc, phân trang; tạo bệnh nhân.
  - `MedicalRecordsPage`: lọc trạng thái, phân trang.
  - `MedicalRecordDetailPage`:
    - nút "Tiếp nhận" chỉ hiện khi `pending`;
    - Lưu câu trả lời gửi `stateToAnswerInputs(collectVisibleQuestions(...))`;
    - "Chốt bệnh án" gửi `{status:'completed', instructions}`;
    - lỗi 3105 hiển thị bằng `describeError`.
- [ ] **Step 2: Cài đặt** theo spec mục 7.
  - Menu "Khám và điều trị" (`/patients`, `/medical-records`) hiện với nhân viên.
  - Admin vẫn thấy menu quản trị.
- [ ] **Step 3:** Chạy test, build, lint, typecheck của Web. Commit `feat(web): tìm/tạo bệnh nhân, danh sách và màn khám bệnh án`.

---

### Task G4-4: Mobile — bệnh nhân tạo và theo dõi bệnh án

**Files:**
- Create: `apps/mobile/src/lib/medical-records-api.ts`, `apps/mobile/src/components/dynamic-form/*`
- Create: `apps/mobile/src/app/records/new.tsx` (phân loại → phiếu), `apps/mobile/src/app/records/[id].tsx` (chi tiết, dặn dò)
- Modify: `apps/mobile/src/app/(tabs)/records.tsx` (lịch sử + nút tạo)

- [ ] **Step 1: Cài đặt** theo spec mục 8.
  - `DynamicForm` của Mobile dùng `collectVisibleQuestions`, `stateToAnswerInputs` và `answersToState`.
  - Bệnh nhân chỉ điền các section có `filled_by` ∈ {patient, patdoc}.
  - Nút lớn 56px, chữ ≥ 18.
- [ ] **Step 2:** Chạy mobile typecheck, `pnpm lint`, `pnpm typecheck`, `expo export` và `npx expo-doctor`. Commit `feat(mobile): bệnh nhân tạo bệnh án theo phiếu động và xem lịch sử`.
