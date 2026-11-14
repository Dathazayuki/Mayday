# Giai đoạn 3 — Mẫu phiếu khám động: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 11 API mẫu phiếu (templates → sections → questions → options), quyền `manage_templates` khai báo trong code, trình thiết kế mẫu phiếu trên Web, tiện ích cây câu hỏi dùng chung.

**Architecture:** Module `templates` theo khuôn giai đoạn 1–2. `@RequirePermission` mở rộng `PermissionsGuard` của giai đoạn 2. Mọi trường trả về là string theo tab Sheet. `show_if_answer` là mảng `option_value` của câu hỏi cha (MT-69).

**Tech Stack:** NestJS 12, Prisma 7 + MySQL 8.4 (dev), React 19 + antd 6 + TanStack Query 5.

**Spec:** [docs/superpowers/specs/2026-11-15-giai-doan-3-mau-phieu-design.md](../specs/2026-11-15-giai-doan-3-mau-phieu-design.md).

## Global Constraints

- **Toàn bộ Global Constraints của giai đoạn 1 và 2 vẫn áp dụng:**
  - code sạch, cấu trúc nhất quán;
  - Prisma chỉ dùng trong `*.repository.ts`;
  - mã lỗi chỉ lấy từ catalog;
  - không tự quyết mục "Chờ chốt";
  - commit message tiếng Việt kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Mọi trường trong `data` của API mẫu phiếu là string:** cờ dùng `"0"`/`"1"`, `order` là chuỗi số, ID là chuỗi. Chuyển đổi gom về một file mapping có unit test.
- **Mã định danh** `code_template`/`question_id` khớp `CODE_PATTERN` (`/^[A-Z0-9_]+$/`), độ dài tối đa lần lượt 255/50 ký tự.

---

### Task G3-1: Hợp đồng mẫu phiếu và tiện ích cây câu hỏi (shared)

**Files:**
- Create: `packages/shared/src/contracts/templates.ts`, `packages/shared/src/form-tree.ts`, `packages/shared/src/form-tree.spec.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Test trước** (`form-tree.spec.ts`).
  - `buildQuestionTree`:
    - câu hỏi có `parent_question_id` null là gốc;
    - câu hỏi có cha trỏ tới câu không có trong danh sách cũng là gốc;
    - con nằm dưới đúng cha;
    - anh em sắp theo `Number(order)` tăng dần, cùng order thì giữ thứ tự đầu vào;
    - cây 3 tầng.
  - `isQuestionVisible`:
    - không có cha → true;
    - có cha nhưng `show_if_answer` null → true (con của `group_questions`);
    - radio: `'YES'` khớp `['YES']` → true, `'NO'` → false;
    - checkbox: `['A','B']` giao với `['B']` → true;
    - cha chưa trả lời (`undefined`/`null`/`''`/`[]`) → false.
  - `isValidShowIfAnswer`: `'["YES"]'` ✓; `'[]'` ✗; `'["YES", ""]'` ✗; `'{"a":1}'` ✗; `'abc'` ✗; `'[1]'` ✗.
- [ ] **Step 2: Cài đặt.** `contracts/templates.ts`:

```ts
/** Kiểu câu hỏi theo enum questions.type_question (tài liệu CSDL, đã gồm track changes). */
export const QUESTION_TYPES = [
  'text',
  'number',
  'date',
  'radio',
  'checkbox',
  'image_upload',
  'group_questions',
  'mix_text_image',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
/** Kiểu câu hỏi bắt buộc có lựa chọn (Sheet ques01: "Nếu type là radio/checkbox"). */
export const CHOICE_QUESTION_TYPES: readonly QuestionType[] = ['radio', 'checkbox'];

export const FILLED_BY_VALUES = ['patient', 'doctor', 'patdoc'] as const;
export type FilledBy = (typeof FILLED_BY_VALUES)[number];

/** Cờ dạng chuỗi theo Sheet ("0" hoặc "1"). */
export type Flag = '0' | '1';
/** Mã định danh code_template / question_id (VD TMPL_URT, Q_ITCH_LEVEL). */
export const CODE_PATTERN = /^[A-Z0-9_]+$/;

/** GET /api/v1/templates/all phần tử (total nằm ngoài data). */
export interface TemplateSummary {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: Flag;
  created_at: string;
}

/** data của POST /templates (1001) và PUT /templates/:id. */
export interface TemplateData extends TemplateSummary {
  updated_at: string;
}

export interface CreateTemplateRequest {
  code_template: string;
  name: string;
  description?: string;
  version?: string;
  is_active?: Flag;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string | null;
  version?: string;
  is_active?: Flag;
}

export interface TemplateListQuery {
  page?: number;
  limit?: number;
  is_active?: Flag;
}

/** data của POST /templates/:template_id/sections và PUT /templates/sections/:id. */
export interface SectionData {
  section_id: string;
  template_id: string;
  title: string;
  order: string;
  is_required: Flag;
  filled_by: FilledBy | null;
}

export interface CreateSectionRequest {
  title: string;
  order: string | number;
  is_required?: Flag;
  filled_by?: FilledBy;
}

export type UpdateSectionRequest = Partial<CreateSectionRequest>;

export interface OptionData {
  id: string;
  option_text: string;
  option_value: string;
  order: string;
  trigger_image_upload: Flag;
}

/** Lựa chọn gửi lên: có id = sửa lựa chọn cũ (chỉ PUT), không có id = tạo mới. */
export interface OptionInput {
  id?: string;
  option_text: string;
  option_value: string;
  order: string | number;
  trigger_image_upload?: Flag;
}

/** Dạng câu hỏi đầy đủ (MT-22): data của POST/PUT câu hỏi và phần tử trong chi tiết mẫu. */
export interface QuestionData {
  question_id: string;
  section_id: string;
  question_text: string;
  type_question: QuestionType;
  placeholder: string | null;
  order: string;
  is_required: Flag;
  parent_question_id: string | null;
  /** Đã parse: mảng option_value của câu hỏi cha (MT-69). */
  show_if_answer: string[] | null;
  help_text: string | null;
  allow_image: Flag;
  options: OptionData[];
}

export interface CreateQuestionRequest {
  question_id: string;
  question_text: string;
  type_question: QuestionType;
  order: string | number;
  placeholder?: string;
  is_required?: Flag;
  parent_question_id?: string;
  /** Chuỗi JSON, VD '["YES"]'. */
  show_if_answer?: string;
  help_text?: string;
  allow_image?: Flag;
  options?: Omit<OptionInput, 'id'>[];
}

/** options (nếu gửi) là danh sách đầy đủ sau khi sửa (upsert + xoá phần còn lại). */
export interface UpdateQuestionRequest {
  question_text?: string;
  type_question?: QuestionType;
  placeholder?: string | null;
  order?: string | number;
  is_required?: Flag;
  parent_question_id?: string | null;
  show_if_answer?: string | null;
  help_text?: string | null;
  allow_image?: Flag;
  options?: OptionInput[];
}

export interface TemplateSectionDetail extends Omit<SectionData, 'template_id'> {
  questions: QuestionData[];
}

/** GET /api/v1/templates/:id — toàn bộ cây biểu mẫu. */
export interface TemplateDetailData extends TemplateData {
  sections: TemplateSectionDetail[];
}
```

  `form-tree.ts`:

```ts
import type { QuestionData } from './contracts/templates.js';

export interface QuestionNode {
  question: QuestionData;
  children: QuestionNode[];
}

/** Giá trị trả lời dùng để xét hiển thị: radio/text → chuỗi, checkbox → mảng. */
export type AnswerValue = string | readonly string[] | null | undefined;

/** Dựng cây theo parent_question_id; anh em sắp theo order (số) tăng dần, ổn định. */
export function buildQuestionTree(questions: readonly QuestionData[]): QuestionNode[] {
  const nodes = new Map(questions.map((q) => [q.question_id, { question: q, children: [] as QuestionNode[] }]));
  const roots: QuestionNode[] = [];
  for (const q of questions) {
    const node = nodes.get(q.question_id)!;
    const parent = q.parent_question_id ? nodes.get(q.parent_question_id) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sortNodes = (list: QuestionNode[]): QuestionNode[] => {
    list.sort((a, b) => Number(a.question.order) - Number(b.question.order));
    list.forEach((n) => sortNodes(n.children));
    return list;
  };
  return sortNodes(roots);
}

/**
 * Câu hỏi có hiện hay không, chỉ xét điều kiện của chính nó (MT-69).
 * Người gọi duyệt cây từ gốc và dừng ở nút bị ẩn, nên câu hỏi con của câu bị ẩn cũng ẩn theo.
 */
export function isQuestionVisible(
  question: Pick<QuestionData, 'parent_question_id' | 'show_if_answer'>,
  answers: Readonly<Record<string, AnswerValue>>,
): boolean {
  if (!question.parent_question_id || !question.show_if_answer) return true;
  const answer = answers[question.parent_question_id];
  const values = typeof answer === 'string' ? (answer ? [answer] : []) : (answer ?? []);
  return values.some((value) => question.show_if_answer!.includes(value));
}

/** Chuỗi show_if_answer hợp lệ: JSON mảng chuỗi khác rỗng, có ít nhất 1 phần tử. */
export function isValidShowIfAnswer(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((v) => typeof v === 'string' && v.trim() !== '')
    );
  } catch {
    return false;
  }
}
```

  `index.ts` export `./contracts/templates.js` và `./form-tree.js`.
- [ ] **Step 3:** `pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared build && pnpm typecheck && pnpm lint`; chạy prettier trên file mới. Kết quả mong đợi: PASS.
- [ ] **Step 4:** Commit `feat(shared): hợp đồng mẫu phiếu và tiện ích cây câu hỏi`.

---

### Task G3-2: API mẫu phiếu (11 API) và `@RequirePermission`

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (4 model theo spec mục 2), `apps/api/prisma/seed.ts` (quyền `manage_templates` + mẫu `TMPL_DEV_SAMPLE`), `apps/api/test/db/helpers.ts` (`resetData`)
- Create: `apps/api/src/permissions/require-permission.decorator.ts`; Modify: `apps/api/src/permissions/permissions.guard.ts` (+ spec), `endpoint-sync.ts`
- Create: `apps/api/src/templates/` (`templates.controller.ts`, `sections.controller.ts`, `questions.controller.ts`, `templates.service.ts`, `sections.service.ts`, `questions.service.ts` (+ spec mỗi service), `templates.repository.ts`, `template-mapping.ts` (+ spec), `dto/*.ts`, `templates.module.ts`)
- Create: `apps/api/test/db/templates.db-spec.ts`

**Interfaces:**
- **Consumes:**
  - `PermissionsGuard`, `PermissionCache`, `syncEndpoints` (G2-3);
  - `Paginated`, `notFound()`, `conflict()` (G2-2/G2-4);
  - các kiểu trong `contracts/templates.ts`, `isValidShowIfAnswer`, `CODE_PATTERN` (G3-1).
- **Produces:**
  - `RequirePermission(name: string)`;
  - `PermissionsGuard` tính quyền cần có = quyền khai báo bằng decorator ∪ quyền gắn qua `permissions_endpoints`. Admin luôn qua; danh sách rỗng → qua; có quyền giao nhau → qua; không có → 3101;
  - `syncEndpoints` upsert thêm `permissions` và `permissions_endpoints` cho các quyền khai báo bằng decorator.

- [ ] **Step 1: Schema.** Thêm 4 model `templates`, `template_sections`, `questions`, `question_options` theo spec mục 2:
  - cột `order` giữ tên `order`;
  - `show_if_answer` và `condition_rules` kiểu `Json?`;
  - `questions` có `@@index([parent_question_id])`;
  - enum `template_sections_filled_by`, `questions_type_question`.
  
  Chạy `db:push`, cập nhật `resetData`.
- [ ] **Step 2: Test trước.**
  - `template-mapping.spec.ts`: Boolean ↔ Flag; int ↔ string; JSON `show_if_answer`; sắp xếp section và câu hỏi.
  - Service:
    - mỗi nhánh mã lỗi trong spec mục 3.2–3.4;
    - quy tắc kiểu câu hỏi ↔ lựa chọn;
    - `option_value` trùng nhau;
    - cha khác mẫu hoặc trỏ tới chính nó;
    - `show_if_answer` không thuộc lựa chọn của cha;
    - upsert lựa chọn: sửa, tạo, xoá phần còn lại; `id` lạ → 2003;
    - xoá câu hỏi còn câu hỏi con → 2003/409.
  - `PermissionsGuard`: decorator yêu cầu `manage_templates`; vai trò có quyền → qua; không có → 3101; admin → qua; CSDL chưa có endpoint vẫn áp dụng quyền khai báo trong decorator.
- [ ] **Step 3: Cài đặt.**
  - Ba controller:
    - `@Controller('templates')`: `POST /`, `GET all`, `GET :id`, `PUT :id`, `DELETE :id`, `POST :template_id/sections`;
    - `@Controller('templates/sections')`: `PUT :id`, `DELETE :id`, `POST :section_id/questions`;
    - `@Controller('templates/questions')`: `PUT :id`, `DELETE :id`.
  - **Thứ tự route:** `GET all` phải khai báo trước `GET :id`. Các route `sections/...`/`questions/...` không được bị `:id` của `templates` bắt nhầm; kiểm tra bằng test tích hợp.
  - Route ghi gắn `@RequirePermission('manage_templates')`.
  - Seed thêm mẫu `TMPL_DEV_SAMPLE` (tên "Phiếu khám mẫu (dữ liệu dev)"), gồm:
    - section 1 "Thông tin chung" (`filled_by` patient): câu `Q_DEV_HAS_ITCH` (radio, YES/NO) và câu con `Q_DEV_ITCH_LEVEL` (number, `show_if_answer` `["YES"]`);
    - section 2 "Khám lâm sàng" (doctor): `Q_DEV_NOTE` (text).
- [ ] **Step 4: Test tích hợp** `templates.db-spec.ts`:
  - đủ 11 API cùng các nhánh lỗi;
  - CASCADE khi xoá mẫu và section;
  - `GET /templates/:id` trả đúng cây và mọi trường là string;
  - bác sĩ (tạo bằng create-staff) gọi POST → 3101; admin cấp `manage_templates` cho vai trò doctor bằng `POST /role_permissions` → bác sĩ gọi được;
  - `GET /templates/all` có `total`, lọc `is_active`.
- [ ] **Step 5:** Chạy toàn bộ kiểm tra của API. Commit `feat(api): mẫu phiếu khám động (templates, sections, questions) và RequirePermission`.

---

### Task G3-3: Web — danh sách mẫu phiếu và trình thiết kế

**Files:** `apps/web/src/admin/templates-api.ts`, `apps/web/src/pages/admin/TemplatesPage.tsx` (+ test), `apps/web/src/pages/admin/TemplateBuilderPage.tsx` (+ test), `apps/web/src/pages/admin/templates/*` (SectionList, QuestionDrawer, OptionsEditor, FormPreview), `apps/web/src/routes.tsx`.

- [ ] **Step 1: Test trước** (mock `fetch`).
  - `TemplatesPage`: phân trang (`getPage`), lọc trạng thái, tạo/sửa (Modal dùng chung), xoá.
  - `TemplateBuilderPage`:
    - hiển thị section theo order và câu hỏi dạng cây;
    - thêm section;
    - thêm câu hỏi radio có 2 lựa chọn: gửi đúng body, `order` là chuỗi;
    - chọn câu hỏi cha và giá trị kích hoạt → body có `parent_question_id` và `show_if_answer` = `'["YES"]'`;
    - sửa câu hỏi: gửi `options` đầy đủ, có `id` với lựa chọn cũ;
    - xoá câu hỏi bị 2003 thì hiển thị `describeError`;
    - "Xem trước": chọn YES thì câu con hiện, chọn NO thì ẩn (dùng `buildQuestionTree`/`isQuestionVisible`).
- [ ] **Step 2: Cài đặt** theo spec mục 4. Route `/admin/templates` và `/admin/templates/:code`.
- [ ] **Step 3:** Chạy test, build, lint, typecheck của Web. Commit `feat(web): quản lý mẫu phiếu và trình thiết kế phiếu khám`.
