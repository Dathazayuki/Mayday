# Giao diện web theo phong cách Cendo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi toàn bộ phần nhìn của `apps/web` sang bố cục/phong cách Cendo với màu chủ đạo xanh dương `#1677FF`, không đổi hành vi.

**Architecture:** Một file token (`src/theme/tokens.ts`) là nguồn duy nhất của màu/phông/bo góc/bóng; từ đó sinh theme antd (`ConfigProvider`) và biến CSS `--dm-*`. Khung app mới (`AppShell` = `Sidebar` + `Page`) thay `AppLayout`; mọi trang dùng `Page` + `Panel` + `StatusBadge`. CSS tự viết chỉ dùng `var(--dm-*)`.

**Tech Stack:** React 19.3, antd 6.7, react-router 7, Vite 8, Vitest 4 + Testing Library, `@fontsource/be-vietnam-pro` + `@fontsource/sora`.

**Spec:** `docs/superpowers/specs/2026-11-15-giao-dien-cendo-design.md` (đọc mục liên quan trước khi làm mỗi task).

## Global Constraints

- Mọi giá trị hex/rgba CHỈ nằm trong `apps/web/src/theme/tokens.ts` (file test được miễn). Style tự viết dùng `var(--dm-*)`.
- Phụ thuộc mới DUY NHẤT: `@fontsource/be-vietnam-pro` và `@fontsource/sora` (bản `^5.3.0`) trong `apps/web`. Không thêm Tailwind, không thêm thư viện CSS-in-JS.
- Giữ antd 6; tuỳ biến qua `ConfigProvider theme` + file CSS. Không dùng API antd đã deprecated (VD `Drawer width`, `List`, `Tag` `bordered`… — kiểm tra kiểu trong `node_modules/antd` trước khi dùng prop).
- Không đổi hành vi, luồng, lời gọi API, dữ liệu. Test hiện có giữ nguyên khẳng định; chỉ sửa test bám vào cấu trúc DOM cũ, và ghi rõ trong báo cáo test nào sửa, vì sao.
- Chữ giao diện và comment tiếng Việt. Đặt tên file: component `PascalCase.tsx`, còn lại `kebab-case.ts`.
- Màu chủ đạo `#1677FF`; nền trang `#EBEEF2`; phông `'Be Vietnam Pro'` cho UI, `'Sora'` CHỈ cho số liệu (class `.num`).
- Lệnh kiểm tra (chạy ở thư mục gốc repo `C:\Users\Admin\Desktop\DR-May-day`): `pnpm --filter @drmayday/web test`, `pnpm --filter @drmayday/web lint`, `pnpm --filter @drmayday/web typecheck`, `pnpm --filter @drmayday/web build`, `pnpm format:check` (sửa bằng `pnpm exec prettier --write <file>`).
- Commit: kiểu `feat(web): …`/`refactor(web): …` tiếng Việt, kết thúc bằng dòng trống + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Dev server web (`pnpm dev:web`, cổng 5173) và API (cổng 3000) đang chạy cho người dùng xem: KHÔNG tắt chúng, không chạy thêm server trên 5173/3000.

---

## Task 1: Nền tảng theme (token, theme antd, biến CSS, phông, StatusBadge)

**Files:**
- Create: `apps/web/src/theme/tokens.ts`, `apps/web/src/theme/css-variables.ts`, `apps/web/src/theme/antd-theme.ts`, `apps/web/src/theme/global.css`, `apps/web/src/theme/StatusBadge.tsx`
- Test: `apps/web/src/theme/theme.test.ts`, `apps/web/src/theme/StatusBadge.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/package.json` (thêm 2 phông)

**Interfaces:**
- Produces: `colors`, `fonts`, `radius`, `shadows` (tokens.ts); `cssVariables(): Record<string,string>`, `cssVariablesBlock(): string`, `injectCssVariables(doc?: Document): void` (css-variables.ts); `appTheme: ThemeConfig` (antd-theme.ts); `StatusBadge({ tone?: StatusTone; children })`, `type StatusTone = 'neutral' | 'primary' | 'green' | 'amber' | 'red' | 'slate'` (StatusBadge.tsx); class CSS `.num`, `.dm-badge`, `.dm-badge--<tone>`; biến CSS `--dm-<token-kebab>` (VD `--dm-primary-weak`, `--dm-ink2`, `--dm-row-hover`, `--dm-font-num`, `--dm-radius-md`, `--dm-shadow-soft`).

- [ ] **Step 1: Cài phông**

Run: `pnpm --filter @drmayday/web add @fontsource/be-vietnam-pro@^5.3.0 @fontsource/sora@^5.3.0`
Expected: `apps/web/package.json` có 2 dependency mới; `pnpm-lock.yaml` cập nhật.

- [ ] **Step 2: Viết test thất bại** — `apps/web/src/theme/theme.test.ts`

```ts
import { appTheme } from './antd-theme';
import { cssVariables, cssVariablesBlock, injectCssVariables } from './css-variables';
import { colors, fonts, radius, shadows } from './tokens';

describe('theme', () => {
  it('theme antd lấy màu, phông, bo góc từ tokens', () => {
    expect(appTheme.token).toMatchObject({
      colorPrimary: '#1677FF',
      colorPrimaryHover: '#0958D9',
      colorBgLayout: '#EBEEF2',
      colorText: '#20242A',
      colorTextTertiary: '#8B9299',
      colorBorder: '#E1E5EA',
      fontFamily: fonts.sans,
      fontSize: 14,
      borderRadius: 10,
      borderRadiusSM: 6,
      borderRadiusLG: 16,
      controlHeight: 38,
    });
    expect(appTheme.components?.Table).toMatchObject({
      headerBg: colors.surface,
      headerColor: colors.ink3,
      headerSplitColor: 'transparent',
      rowHoverBg: colors.rowHover,
      rowSelectedBg: colors.primaryWeak,
      cellPaddingBlock: 11,
      cellPaddingInline: 16,
    });
    expect(appTheme.components?.Button).toMatchObject({ fontWeight: 600, primaryShadow: 'none' });
    expect(appTheme.components?.Tabs).toMatchObject({ inkBarColor: colors.primary });
    expect(appTheme.components?.Modal).toMatchObject({
      borderRadiusLG: radius.lg,
      titleFontSize: 17,
      boxShadow: shadows.pop,
    });
  });

  it('sinh biến CSS --dm-* cho mọi token', () => {
    const vars = cssVariables();
    expect(vars['--dm-primary']).toBe('#1677FF');
    expect(vars['--dm-primary-weak']).toBe('rgba(22,119,255,0.12)');
    expect(vars['--dm-ink2']).toBe('#565D64');
    expect(vars['--dm-row-hover']).toBe('#F7F9FB');
    expect(vars['--dm-font-num']).toBe(fonts.num);
    expect(vars['--dm-radius-md']).toBe('16px');
    expect(vars['--dm-shadow-soft']).toBe(shadows.soft);
    expect(Object.keys(vars)).toHaveLength(
      Object.keys(colors).length +
        Object.keys(fonts).length +
        Object.keys(radius).length +
        Object.keys(shadows).length,
    );
    expect(cssVariablesBlock()).toMatch(/^:root \{\n {2}--dm-primary: #1677FF;\n/);
  });

  it('gắn khối biến CSS vào <head> đúng một lần', () => {
    injectCssVariables(document);
    injectCssVariables(document);
    const styles = document.head.querySelectorAll('style[data-dm="tokens"]');
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toContain('--dm-bg: #EBEEF2;');
  });
});
```

`apps/web/src/theme/StatusBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('hiện chữ và gắn class theo tông', () => {
    render(<StatusBadge tone="amber">Chờ tiếp nhận</StatusBadge>);
    const badge = screen.getByText('Chờ tiếp nhận');
    expect(badge).toHaveClass('dm-badge', 'dm-badge--amber');
  });

  it('mặc định là tông trung tính', () => {
    render(<StatusBadge>Nháp</StatusBadge>);
    expect(screen.getByText('Nháp')).toHaveClass('dm-badge--neutral');
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @drmayday/web test -- src/theme`
Expected: FAIL (không tìm thấy module `./antd-theme`, `./StatusBadge`…).

- [ ] **Step 4: Viết `tokens.ts`**

```ts
/**
 * Token giao diện — NGUỒN DUY NHẤT của mã màu, phông, bo góc, bóng (spec giao diện Cendo, mục 2).
 * Theme antd (antd-theme.ts) và biến CSS --dm-* (css-variables.ts) đều sinh từ đây; nơi khác không viết hex.
 */
export const colors = {
  primary: '#1677FF',
  primaryHover: '#0958D9',
  primaryActive: '#003EB3',
  primaryWeak: 'rgba(22,119,255,0.12)',
  bg: '#EBEEF2',
  surface: '#FFFFFF',
  ink: '#20242A',
  ink2: '#565D64',
  ink3: '#8B9299',
  line: '#E1E5EA',
  line2: '#EDF0F3',
  rowHover: '#F7F9FB',
  green: '#4E9A5A',
  greenWeak: 'rgba(78,154,90,0.15)',
  amber: '#9C6B15',
  amberWeak: 'rgba(181,121,31,0.15)',
  red: '#B8433A',
  redWeak: 'rgba(184,67,58,0.12)',
  slate: '#3B4045',
  slateWeak: 'rgba(59,64,69,0.10)',
} as const;

export const fonts = {
  sans: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  /** CHỈ cho số liệu: mã hồ sơ, số đếm, điểm số. */
  num: "'Sora', 'Be Vietnam Pro', system-ui, sans-serif",
} as const;

export const radius = { xs: 6, sm: 10, md: 16, lg: 22 } as const;

export const shadows = {
  soft: '0 1px 2px rgba(20,24,30,0.05), 0 8px 24px rgba(20,24,30,0.07)',
  card: '0 10px 34px rgba(20,24,30,0.10)',
  pop: '0 20px 60px rgba(20,24,30,0.22)',
} as const;
```

- [ ] **Step 5: Viết `css-variables.ts`**

```ts
import { colors, fonts, radius, shadows } from './tokens';

/** primaryWeak → primary-weak, rowHover → row-hover (chữ số giữ nguyên: ink2 → ink2). */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/** Biến CSS --dm-* sinh từ tokens, để CSS tự viết dùng var(--dm-*) thay vì lặp mã màu. */
export function cssVariables(): Record<string, string> {
  return Object.fromEntries([
    ...Object.entries(colors).map(([key, value]) => [`--dm-${kebab(key)}`, value]),
    ...Object.entries(fonts).map(([key, value]) => [`--dm-font-${key}`, value]),
    ...Object.entries(radius).map(([key, value]) => [`--dm-radius-${key}`, `${value}px`]),
    ...Object.entries(shadows).map(([key, value]) => [`--dm-shadow-${key}`, value]),
  ]);
}

export function cssVariablesBlock(): string {
  const lines = Object.entries(cssVariables()).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

/** Gắn khối biến vào <head> một lần (gọi ở main.tsx trước khi render). */
export function injectCssVariables(doc: Document = document): void {
  if (doc.head.querySelector('style[data-dm="tokens"]')) return;
  const style = doc.createElement('style');
  style.dataset.dm = 'tokens';
  style.textContent = cssVariablesBlock();
  doc.head.append(style);
}
```

- [ ] **Step 6: Viết `antd-theme.ts`**

```ts
import type { ThemeConfig } from 'antd';
import { colors, fonts, radius, shadows } from './tokens';

/** Theme antd theo spec giao diện Cendo mục 4 (mọi giá trị lấy từ tokens). */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: colors.primary,
    colorPrimaryHover: colors.primaryHover,
    colorPrimaryActive: colors.primaryActive,
    colorSuccess: colors.green,
    colorWarning: colors.amber,
    colorError: colors.red,
    colorInfo: colors.primary,
    colorText: colors.ink,
    colorTextSecondary: colors.ink2,
    colorTextTertiary: colors.ink3,
    colorBorder: colors.line,
    colorBorderSecondary: colors.line2,
    colorBgLayout: colors.bg,
    colorBgContainer: colors.surface,
    fontFamily: fonts.sans,
    fontSize: 14,
    borderRadius: radius.sm,
    borderRadiusSM: radius.xs,
    borderRadiusLG: radius.md,
    controlHeight: 38,
    boxShadow: shadows.card,
    boxShadowSecondary: shadows.card,
  },
  components: {
    Button: { fontWeight: 600, primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
    Table: {
      headerBg: colors.surface,
      headerColor: colors.ink3,
      headerSplitColor: 'transparent',
      borderColor: colors.line2,
      rowHoverBg: colors.rowHover,
      rowSelectedBg: colors.primaryWeak,
      cellPaddingBlock: 11,
      cellPaddingInline: 16,
    },
    Tabs: {
      inkBarColor: colors.primary,
      itemColor: colors.ink2,
      itemSelectedColor: colors.ink,
      itemHoverColor: colors.ink,
      titleFontSize: 14,
    },
    Card: { headerFontSize: 16, headerBg: 'transparent' },
    Modal: { borderRadiusLG: radius.lg, titleFontSize: 17, boxShadow: shadows.pop },
  },
};
```

Nếu `tsc` báo một token component không tồn tại trong kiểu của antd 6.7, tra `node_modules/antd/es/<component>/style/*.d.ts` và báo lại trong mục concerns — KHÔNG tự bỏ token mà không ghi.

- [ ] **Step 7: Viết `StatusBadge.tsx` và `global.css`**

```tsx
import type { ReactNode } from 'react';

export type StatusTone = 'neutral' | 'primary' | 'green' | 'amber' | 'red' | 'slate';

/** Nhãn trạng thái dạng viên thuốc kiểu Cendo: nền nhạt + chữ đậm cùng họ; màu chỉ là tín hiệu, luôn kèm chữ. */
export function StatusBadge({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  return <span className={`dm-badge dm-badge--${tone}`}>{children}</span>;
}
```

`global.css`:

```css
/* Nền tảng giao diện: chỉ dùng biến --dm-* sinh từ theme/tokens.ts, không viết mã màu ở đây. */
html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  background: var(--dm-bg);
  color: var(--dm-ink);
  font-family: var(--dm-font-sans);
  -webkit-font-smoothing: antialiased;
}

/* Số liệu (mã hồ sơ, số đếm, điểm số) dùng phông Sora, chữ số đều cột. */
.num {
  font-family: var(--dm-font-num);
  font-variant-numeric: tabular-nums;
}

/* Tiêu đề cột bảng kiểu Cendo: chữ nhỏ viết hoa, giãn chữ (antd không có token cho phần này). */
.ant-table-wrapper .ant-table-thead > tr > th {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--dm-line);
}

.dm-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
}
.dm-badge--neutral {
  background: var(--dm-line);
  color: var(--dm-ink2);
}
.dm-badge--primary {
  background: var(--dm-primary-weak);
  color: var(--dm-primary);
}
.dm-badge--green {
  background: var(--dm-green-weak);
  color: var(--dm-green);
}
.dm-badge--amber {
  background: var(--dm-amber-weak);
  color: var(--dm-amber);
}
.dm-badge--red {
  background: var(--dm-red-weak);
  color: var(--dm-red);
}
.dm-badge--slate {
  background: var(--dm-slate-weak);
  color: var(--dm-slate);
}
```

- [ ] **Step 8: Nối vào app**

`apps/web/src/main.tsx`:

```tsx
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import './theme/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { injectCssVariables } from './theme/css-variables';

injectCssVariables();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`apps/web/src/App.tsx`: `import { appTheme } from './theme/antd-theme';` và đổi `<ConfigProvider locale={viVN}>` thành `<ConfigProvider locale={viVN} theme={appTheme}>`.

- [ ] **Step 9: Chạy test + lint + typecheck + build**

Run: `pnpm --filter @drmayday/web test` rồi `lint`, `typecheck`, `build` (xem Global Constraints)
Expected: toàn bộ PASS; build không cảnh báo thiếu file phông.

- [ ] **Step 10: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/theme apps/web/src/App.tsx apps/web/src/main.tsx
git commit -m "feat(web): nền tảng theme kiểu Cendo (token, theme antd, biến CSS, phông, StatusBadge)"
```

---

## Task 2: Khung ứng dụng (AppShell, Sidebar, Page, Panel, HeaderTools)

**Files:**
- Create: `apps/web/src/layout/shell-context.ts`, `apps/web/src/layout/initials.ts`, `apps/web/src/layout/Sidebar.tsx`, `apps/web/src/layout/HeaderTools.tsx`, `apps/web/src/layout/Page.tsx`, `apps/web/src/layout/Panel.tsx`, `apps/web/src/layout/AppShell.tsx`, `apps/web/src/layout/layout.css`
- Test: `apps/web/src/layout/initials.test.ts`, `apps/web/src/layout/Page.test.tsx`, `apps/web/src/layout/AppShell.test.tsx`
- Modify: `apps/web/src/layout/menu.ts` (thêm `icon`), `apps/web/src/routes.tsx` (dùng `AppShell`), `apps/web/src/main.tsx` (import `./layout/layout.css`), `apps/web/src/pages/ComingSoonPage.tsx`, `apps/web/src/pages/NotFoundPage.tsx`
- Delete: `apps/web/src/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: `StatusBadge` không dùng ở task này; dùng biến CSS `--dm-*` của Task 1.
- Produces:
  - `Page(props: { title: ReactNode; subtitle?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode; children?: ReactNode })`
  - `Panel(props: CardProps & { flush?: boolean })` — bọc antd `Card`, class `dm-panel`; `flush` bỏ đệm thân để bảng sát mép.
  - `PanelToolbar({ children })` — hàng lọc trong `Panel flush` (đệm `12px 16px`, viền dưới `line`, flex wrap gap 12).
  - `ShellContext` / `useShell(): { tools: ReactNode; openNav: () => void } | null`
  - `initials(name?: string): string`
  - `NavItem.icon: ComponentType` trong `menu.ts`.

- [ ] **Step 1: Viết test thất bại**

`apps/web/src/layout/initials.test.ts`:

```ts
import { initials } from './initials';

describe('initials', () => {
  it.each([
    ['Nguyễn Văn An', 'NA'],
    ['  Trần   Thu Hà ', 'TH'],
    ['Admin', 'A'],
    ['', '?'],
    [undefined, '?'],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
```

`apps/web/src/layout/Page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { Page } from './Page';
import { ShellContext } from './shell-context';

function renderPage(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Page', () => {
  it('hiện tiêu đề, phụ đề, nút quay lại, thao tác và nội dung', () => {
    renderPage(
      <Page
        title="Bệnh án #5"
        subtitle="Mày đay mạn"
        back={{ to: '/medical-records', label: 'Bệnh án' }}
        actions={<button type="button">Chốt bệnh án</button>}
      >
        <p>Nội dung</p>
      </Page>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Bệnh án #5' })).toBeInTheDocument();
    expect(screen.getByText('Mày đay mạn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bệnh án/ })).toHaveAttribute('href', '/medical-records');
    expect(screen.getByRole('button', { name: 'Chốt bệnh án' })).toBeInTheDocument();
    expect(screen.getByText('Nội dung')).toBeInTheDocument();
  });

  it('ngoài shell thì không có công cụ chung và nút mở menu', () => {
    renderPage(<Page title="Người dùng" />);
    expect(screen.queryByRole('button', { name: 'Mở menu' })).not.toBeInTheDocument();
  });

  it('trong shell thì hiện công cụ chung và nút mở menu gọi openNav', async () => {
    const openNav = vi.fn();
    renderPage(
      <ShellContext.Provider value={{ tools: <span>công cụ</span>, openNav }}>
        <Page title="Người dùng" />
      </ShellContext.Provider>,
    );
    expect(screen.getByText('công cụ')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu' }));
    expect(openNav).toHaveBeenCalledOnce();
  });
});
```

`apps/web/src/layout/AppShell.test.tsx` (dùng `renderApp`, `seedSession`, `okResponse`, `jsonResponse` từ `../test/helpers`; GET `/roles` trả mảng → admin; `/notifications` trả `{ data: [], total: 0 }`; `/profile` trả hồ sơ nhân viên — xem dạng hồ sơ trong `src/pages/ProfilePage.test.tsx` để lấy fixture nhân viên đúng kiểu):

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { AppShell } from './AppShell';
import { Page } from './Page';
import { jsonResponse, okResponse, renderApp, seedSession } from '../test/helpers';

function stubApi({ admin }: { admin: boolean }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/notifications'))
        return Promise.resolve(jsonResponse(200, { code: '1000', message: 'OK', data: [], total: 0 }));
      if (url.endsWith('/roles'))
        return Promise.resolve(admin ? okResponse([]) : jsonResponse(403, { code: '3102', message: 'x' }));
      return Promise.resolve(okResponse({}));
    }),
  );
}

function renderShell(path: string) {
  return renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Page title="Trang chủ thử" />} />
        <Route path="/medical-records/:id" element={<Page title="Bệnh án #5" />} />
      </Route>
    </Routes>,
    path,
  );
}

describe('AppShell', () => {
  it('sidebar có thương hiệu, Tổng quan, nhóm Khám và điều trị, tên người dùng', async () => {
    seedSession();
    stubApi({ admin: false });
    renderShell('/');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: /Tổng quan/ })).toHaveClass('active');
    expect(within(nav).getByText('Khám và điều trị')).toBeInTheDocument();
    expect(within(nav).getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(within(nav).queryByText('Quản trị hệ thống')).not.toBeInTheDocument();
  });

  it('trang con làm sáng mục cha, Tổng quan không sáng', async () => {
    seedSession();
    stubApi({ admin: false });
    renderShell('/medical-records/5');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: /Bệnh án/ })).toHaveClass('active');
    expect(within(nav).getByRole('link', { name: /Tổng quan/ })).not.toHaveClass('active');
  });

  it('admin thấy nhóm Quản trị hệ thống', async () => {
    seedSession();
    stubApi({ admin: true });
    renderShell('/');
    expect(await screen.findByText('Quản trị hệ thống')).toBeInTheDocument();
  });

  it('nút Mở menu mở sidebar trong drawer; chọn mục thì đóng', async () => {
    seedSession();
    stubApi({ admin: false });
    renderShell('/');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mở menu' }));
    expect(await screen.findAllByRole('navigation', { name: 'Điều hướng chính' })).toHaveLength(2);
    const drawerNav = screen.getAllByRole('navigation', { name: 'Điều hướng chính' })[1]!;
    await user.click(within(drawerNav).getByRole('link', { name: /Bệnh án/ }));
    expect(await screen.findByRole('heading', { name: 'Bệnh án #5' })).toBeInTheDocument();
  });
});
```

Nếu fixture `/profile` của nhân viên cần trường cụ thể để `useIsPatient()` trả `false`, chỉnh `stubApi` cho đúng; ghi lại trong báo cáo.

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @drmayday/web test -- src/layout`
Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Viết `initials.ts`, `shell-context.ts`, thêm icon vào `menu.ts`**

```ts
/** Chữ cái đầu cho avatar: chữ đầu của từ đầu + từ cuối ("Nguyễn Văn An" → "NA"), như avatar của Cendo. */
export function initials(name?: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}
```

```ts
import { createContext, useContext, type ReactNode } from 'react';

/** Thứ AppShell cấp cho Page: công cụ chung ở thanh trên và hàm mở sidebar ở màn hẹp. */
export interface ShellContextValue {
  tools: ReactNode;
  openNav: () => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

/** null khi Page nằm ngoài shell (VD test một trang đơn lẻ). */
export function useShell(): ShellContextValue | null {
  return useContext(ShellContext);
}
```

`menu.ts`: thêm `icon: ComponentType;` vào `NavItem` (comment: "Icon outlined nét mảnh, giống bộ Feather của Cendo.") và gán: Bệnh nhân `TeamOutlined`, Bệnh án `FileTextOutlined`, Người dùng `UserOutlined`, Vai trò và quyền hạn `SafetyCertificateOutlined`, Cơ sở vật chất `BankOutlined`, Mẫu phiếu khám `FormOutlined` (import từ `@ant-design/icons`).

- [ ] **Step 4: Viết `Sidebar.tsx`**

```tsx
import { HomeOutlined } from '@ant-design/icons';
import type { ComponentType } from 'react';
import { NavLink } from 'react-router';
import { useIsAdmin } from '../admin/use-is-admin';
import { useAuth } from '../auth/useAuth';
import { useIsPatient } from '../profile/use-is-patient';
import { initials } from './initials';
import { NAV_GROUPS } from './menu';

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: ComponentType;
  end?: boolean;
  onNavigate?: () => void;
}) {
  // NavLink tự gắn class "active"; không có `end` thì trang con (/medical-records/5) cũng sáng mục cha.
  return (
    <NavLink to={to} end={end} className="dm-nav" onClick={onNavigate}>
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
}

/** Sidebar kiểu Cendo. `onNavigate`: Drawer ở màn hẹp tự đóng sau khi chọn mục. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const isPatient = useIsPatient();
  // Chỉ ẩn nhóm nhân viên khi chắc chắn là bệnh nhân; API vẫn kiểm tra quyền.
  const groups = NAV_GROUPS.filter(
    (group) => (!group.adminOnly || isAdmin === true) && (!group.staffOnly || isPatient !== true),
  );

  return (
    <nav className="dm-sidebar" aria-label="Điều hướng chính">
      <div className="dm-sidebar__brand">
        Dr<span>MayDay</span>
      </div>
      <div className="dm-sidebar__sub">Khám &amp; điều trị mày đay</div>
      <SidebarLink to="/" end label="Tổng quan" icon={HomeOutlined} onNavigate={onNavigate} />
      {groups.map((group) => (
        <div key={group.label}>
          <div className="dm-sidebar__group">{group.label}</div>
          {group.items.map((item) => (
            <SidebarLink
              key={item.key}
              to={item.key}
              label={item.label}
              icon={item.icon}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
      <div className="dm-sidebar__me">
        <span className="dm-avatar" aria-hidden="true">
          {initials(user?.full_name)}
        </span>
        <span className="dm-sidebar__name">{user?.full_name}</span>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Viết `HeaderTools.tsx`** — chuyển nguyên hành vi menu người dùng của `AppLayout` (mục, điều hướng, `loggingOut`) sang đây:

```tsx
import { KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { initials } from './initials';
import { NotificationBell } from './NotificationBell';

/** Công cụ chung ở thanh trên mọi trang: chuông thông báo + avatar mở menu tài khoản. */
export function HeaderTools() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const userMenu: MenuProps = {
    items: [
      { key: '/profile', icon: <UserOutlined />, label: 'Hồ sơ cá nhân' },
      { key: '/change-password', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', disabled: loggingOut },
    ],
    onClick: ({ key }) => {
      if (key !== 'logout') return navigate(key);
      // logout luôn xoá phiên nên shell sẽ bị gỡ; không cần đặt lại cờ.
      setLoggingOut(true);
      void logout();
    },
  };

  return (
    <div className="dm-header-tools">
      <NotificationBell />
      <Dropdown menu={userMenu} trigger={['click']}>
        <Button
          type="text"
          shape="circle"
          className="dm-avatar-button"
          aria-label={`Tài khoản: ${user?.full_name ?? ''}`}
          loading={loggingOut}
          icon={loggingOut ? undefined : <span className="dm-avatar">{initials(user?.full_name)}</span>}
        />
      </Dropdown>
    </div>
  );
}
```

(Test có sẵn trong `routes.test.tsx` tìm nút theo tên `/Nguyễn Văn An/` và kiểm tra class `ant-btn-loading` — `aria-label` ở trên giữ cho các test đó đúng.)

- [ ] **Step 6: Viết `Page.tsx` và `Panel.tsx`**

```tsx
import { LeftOutlined, MenuOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useShell } from './shell-context';

export interface PageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Màn con: link quay về màn cha (VD "‹ Bệnh án"). */
  back?: { to: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}

/** Khung một trang: thanh trên (tiêu đề, thao tác, công cụ chung của shell) + vùng nội dung cuộn. */
export function Page({ title, subtitle, back, actions, children }: PageProps) {
  const shell = useShell();
  return (
    <div className="dm-page">
      <header className="dm-page__top">
        {shell && (
          <Button
            className="dm-page__menu"
            type="text"
            icon={<MenuOutlined />}
            aria-label="Mở menu"
            onClick={shell.openNav}
          />
        )}
        {back && (
          <Link className="dm-page__back" to={back.to}>
            <LeftOutlined /> {back.label}
          </Link>
        )}
        <div className="dm-page__heading">
          <h1 className="dm-page__title">{title}</h1>
          {subtitle && <div className="dm-page__subtitle">{subtitle}</div>}
        </div>
        <div className="dm-page__actions">
          {actions}
          {shell?.tools}
        </div>
      </header>
      <div className="dm-page__body">{children}</div>
    </div>
  );
}
```

```tsx
import { Card, type CardProps } from 'antd';
import type { ReactNode } from 'react';

/** Thẻ nội dung kiểu Cendo (bo 16, viền nhạt, bóng mềm). `flush`: bỏ đệm thân để bảng sát mép thẻ. */
export function Panel({ flush, className, ...props }: CardProps & { flush?: boolean }) {
  const classes = ['dm-panel', flush && 'dm-panel--flush', className].filter(Boolean).join(' ');
  return <Card {...props} className={classes} />;
}

/** Hàng bộ lọc/tìm kiếm ở đầu một Panel flush. */
export function PanelToolbar({ children }: { children: ReactNode }) {
  return <div className="dm-panel__toolbar">{children}</div>;
}
```

- [ ] **Step 7: Viết `AppShell.tsx`, `layout.css`, sửa `routes.tsx`, xoá `AppLayout.tsx`**

```tsx
import { Drawer } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import { HeaderTools } from './HeaderTools';
import { ShellContext, type ShellContextValue } from './shell-context';
import { Sidebar } from './Sidebar';

/** Khung app kiểu Cendo: sidebar cố định bên trái, mỗi trang tự dựng thanh trên bằng <Page>. */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const shell = useMemo<ShellContextValue>(
    () => ({ tools: <HeaderTools />, openNav: () => setNavOpen(true) }),
    [],
  );

  return (
    <div className="dm-shell">
      <aside className="dm-shell__sidebar">
        <Sidebar />
      </aside>
      <div className="dm-shell__main">
        <ShellContext.Provider value={shell}>
          <Outlet />
        </ShellContext.Provider>
      </div>
      {/* Màn hẹp (< 992px): sidebar ẩn bằng CSS, mở trong drawer từ nút "Mở menu" của Page. */}
      <Drawer
        placement="left"
        open={navOpen}
        onClose={() => setNavOpen(false)}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </Drawer>
    </div>
  );
}
```

Đặt chiều rộng drawer 260px bằng prop KHÔNG deprecated của antd 6.7 (tra kiểu `DrawerProps`; nếu `size` nhận số thì dùng `size={260}`).

`layout.css` (import trong `main.tsx` ngay sau `./theme/global.css`):

```css
/* Khung app kiểu Cendo — chỉ dùng biến --dm-* (theme/tokens.ts). */
.dm-shell {
  display: grid;
  grid-template-columns: 230px 1fr;
  height: 100vh;
  overflow: hidden;
  background: var(--dm-bg);
}
.dm-shell__sidebar {
  min-height: 0;
  overflow-y: auto;
  background: var(--dm-surface);
  border-right: 1px solid var(--dm-line);
}
.dm-shell__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.dm-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 18px 12px;
}
.dm-sidebar__brand {
  padding: 0 8px;
  font-size: 19px;
  font-weight: 700;
  color: var(--dm-ink);
}
.dm-sidebar__brand span {
  color: var(--dm-primary);
}
.dm-sidebar__sub {
  margin-bottom: 14px;
  padding: 0 8px;
  font-size: 11px;
  color: var(--dm-ink3);
}
.dm-sidebar__group {
  padding: 14px 10px 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--dm-ink3);
}
.dm-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-left: 3px solid transparent;
  border-radius: var(--dm-radius-sm);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--dm-ink2);
  transition:
    background 120ms,
    color 120ms;
}
.dm-nav .anticon {
  font-size: 18px;
}
.dm-nav:hover {
  background: var(--dm-line2);
  color: var(--dm-ink);
}
.dm-nav.active {
  border-left-color: var(--dm-primary);
  background: var(--dm-primary-weak);
  color: var(--dm-ink);
  font-weight: 600;
}
.dm-sidebar__me {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding: 10px;
  border-top: 1px solid var(--dm-line);
}
.dm-sidebar__name {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dm-avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--dm-ink);
  color: var(--dm-surface);
  font-size: 12px;
  font-weight: 600;
}
.dm-header-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dm-avatar-button.ant-btn {
  width: 36px;
  height: 36px;
  padding: 0;
}

.dm-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
.dm-page__top {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  padding: 10px 24px;
  background: var(--dm-surface);
  border-bottom: 1px solid var(--dm-line);
}
.dm-page__menu.ant-btn {
  display: none;
}
.dm-page__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--dm-ink2);
  font-weight: 500;
  white-space: nowrap;
}
.dm-page__back:hover {
  color: var(--dm-ink);
}
.dm-page__heading {
  min-width: 0;
}
.dm-page__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--dm-ink);
}
.dm-page__subtitle {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--dm-ink2);
}
.dm-page__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.dm-page__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding: 20px 24px;
  overflow-y: auto;
}

.dm-panel.ant-card {
  border-color: var(--dm-line);
  box-shadow: var(--dm-shadow-soft);
}
.dm-panel--flush.ant-card > .ant-card-body {
  padding: 0;
}
.dm-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dm-line);
}

@media (max-width: 991px) {
  .dm-shell {
    grid-template-columns: 1fr;
  }
  .dm-shell__sidebar {
    display: none;
  }
  .dm-page__menu.ant-btn {
    display: inline-flex;
  }
  .dm-page__top,
  .dm-page__body {
    padding-inline: 16px;
  }
}
```

`routes.tsx`: thay import/sử dụng `AppLayout` bằng `AppShell` (`import { AppShell } from './layout/AppShell';`, `<Route element={<AppShell />}>`). Xoá `apps/web/src/layout/AppLayout.tsx`.

- [ ] **Step 8: ComingSoonPage và NotFoundPage dùng Page**

```tsx
import { Result } from 'antd';
import { Page } from '../layout/Page';
import { Panel } from '../layout/Panel';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Page title={title}>
      <Panel>
        <Result status="info" title="Chức năng đang được phát triển." />
      </Panel>
    </Page>
  );
}
```

```tsx
import { Button, Result } from 'antd';
import { Link } from 'react-router';
import { Page } from '../layout/Page';
import { Panel } from '../layout/Panel';

export function NotFoundPage() {
  return (
    <Page title="Không tìm thấy trang">
      <Panel>
        <Result
          status="404"
          subTitle="Đường dẫn không tồn tại hoặc đã bị gỡ."
          extra={
            <Link to="/">
              <Button type="primary">Về trang tổng quan</Button>
            </Link>
          }
        />
      </Panel>
    </Page>
  );
}
```

- [ ] **Step 9: Chạy toàn bộ test + lint + typecheck + build**

Run: lệnh ở Global Constraints.
Expected: PASS. `routes.test.tsx` (đăng nhập hiện tên, menu người dùng, đăng xuất loading, nhóm Quản trị hệ thống) phải xanh không đổi khẳng định. Nếu test nào hỏng vì chữ xuất hiện 2 lần (sidebar + tiêu đề trang), sửa truy vấn của test cho cụ thể hơn (VD `within(nav)` / `getByRole('heading')`), không đổi điều được khẳng định; ghi lại trong báo cáo.

- [ ] **Step 10: Commit**

```bash
git add -A apps/web/src/layout apps/web/src/routes.tsx apps/web/src/main.tsx apps/web/src/pages/ComingSoonPage.tsx apps/web/src/pages/NotFoundPage.tsx
git commit -m "feat(web): khung ứng dụng kiểu Cendo (sidebar, thanh trên, Page, Panel)"
```

---

## Task 3: Áp dụng lên màn quản trị, hồ sơ, đổi mật khẩu

**Files (Modify):** `apps/web/src/pages/admin/UsersPage.tsx`, `RolesPage.tsx`, `FacilitiesPage.tsx`, `TemplatesPage.tsx`, `TemplateBuilderPage.tsx`, `apps/web/src/pages/admin/templates/SectionList.tsx`, `apps/web/src/components/ItemList.tsx`, `apps/web/src/pages/ProfilePage.tsx`, `apps/web/src/pages/ChangePasswordPage.tsx`, cùng các test tương ứng chỉ khi bắt buộc.

**Interfaces:**
- Consumes: `Page`, `Panel`, `PanelToolbar` (`../../layout/Page`, `../../layout/Panel`), `StatusBadge` (`../../theme/StatusBadge`), class `.num`, biến `--dm-line`, `--dm-line2`, `--dm-ink3`.

**Quy tắc biến đổi (áp cho mọi file của task):**
1. `<Card title="X" …>…</Card>` làm khung trang → `<Page title="X" actions={…}>` bọc nội dung. Nút tạo mới / thao tác cấp trang (đang nằm trong hàng lọc hoặc `Card extra`) chuyển vào `actions`.
2. Trang danh sách: nội dung = `<Panel flush>` gồm `<PanelToolbar>` (các `Select`/`Input` lọc) + bảng. `QueryErrorAlert` đặt trong `Page` trước `Panel`.
3. Trang form (Hồ sơ, Đổi mật khẩu): `<Page title="…"><Panel style={{ maxWidth: <giữ số cũ> }}>form</Panel></Page>`.
4. `Tag` mang nghĩa trạng thái → `StatusBadge`: Người dùng `Hoạt động` = green, `Đã khoá` = neutral; Mẫu phiếu `Đang dùng` = green, `Ngừng dùng` = neutral; SectionList `Bắt buộc` = red, loại câu hỏi = primary, mã câu hỏi và người điền = neutral.
5. Cột mã/id dạng số trong bảng render `<span className="num">{value}</span>`.
6. Style inline màu cứng: `ItemList.tsx` `rgba(5, 5, 5, 0.06)` → `var(--dm-line2)`, `rgba(0, 0, 0, 0.45)` → `var(--dm-ink3)`; `SectionList.tsx` `rgba(128, 128, 128, 0.2)` → `var(--dm-line)`, `rgba(128, 128, 128, 0.3)` → `var(--dm-line)`.
7. `TemplateBuilderPage`: `Page` với `back={{ to: '/admin/templates', label: 'Mẫu phiếu khám' }}`, `title` = tên mẫu (khi chưa tải xong dùng mã mẫu từ URL), `subtitle` = mã mẫu trong `<span className="num">`, nút của `Card extra` cũ chuyển vào `actions`; khối nội dung bên trong thành `Panel`.
8. Giữ nguyên mọi `aria-label`, chữ nút, chữ thông báo, thứ tự cột.

Ví dụ hoàn chỉnh cho `RolesPage.tsx` (đọc file hiện tại trước; nếu cấu trúc khác, áp đúng quy tắc trên):

```tsx
// trước
return (
  <Card title="Vai trò và quyền hạn">
    {/* nội dung */}
  </Card>
);
// sau
return (
  <Page title="Vai trò và quyền hạn">
    <Panel>{/* nội dung giữ nguyên */}</Panel>
  </Page>
);
```

- [ ] **Step 1:** Đọc từng file, liệt kê test đang bám vào cấu trúc `Card` (VD tìm tiêu đề trong `.ant-card-head`). Chạy `pnpm --filter @drmayday/web test -- src/pages/admin src/pages/ProfilePage src/pages/ChangePasswordPage` lấy mốc (phải PASS trước khi sửa).
- [ ] **Step 2:** Áp quy tắc 1–8 cho `UsersPage`, `RolesPage`, `FacilitiesPage`, `TemplatesPage` (+ `ItemList` nếu được dùng ở đây). Chạy lại test của các màn này → PASS.
- [ ] **Step 3:** Áp cho `TemplateBuilderPage` + `templates/SectionList.tsx`. Chạy test → PASS.
- [ ] **Step 4:** Áp cho `ProfilePage`, `ChangePasswordPage`. Chạy test → PASS.
- [ ] **Step 5:** Chạy toàn bộ test + lint + typecheck + build + format:check → PASS.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages apps/web/src/components/ItemList.tsx
git commit -m "feat(web): màn quản trị, hồ sơ, đổi mật khẩu theo khung Page/Panel kiểu Cendo"
```

---

## Task 4: Áp dụng lên màn lâm sàng (bệnh nhân, bệnh án, màn khám và các panel)

**Files (Modify):** `apps/web/src/clinical/status.tsx`, `apps/web/src/pages/clinical/PatientsPage.tsx`, `MedicalRecordsPage.tsx`, `MedicalRecordDetailPage.tsx`, `Uas7Panel.tsx`, `PrescriptionPanel.tsx`, `LabPanel.tsx`, `LesionPanel.tsx`, các file trong `apps/web/src/pages/clinical/patients/` có `Card`/`Tag`, `apps/web/src/components/dynamic-form/DynamicForm.tsx` (chỉ khi cần), cùng test tương ứng chỉ khi bắt buộc.

**Interfaces:**
- Consumes: như Task 3.
- Produces: `MedicalRecordStatusTag` giữ tên + props, bên trong dùng `StatusBadge`.

**Quy tắc:** Quy tắc 1, 2, 5, 8 của Task 3, cộng:
1. `clinical/status.tsx`: map tông `draft` neutral, `pending` amber, `in_progress` primary, `completed` green, `cancelled` red; render `<StatusBadge tone={…}>{MEDICAL_RECORD_STATUS_LABELS[status]}</StatusBadge>`. Bỏ import `Tag`.
2. Trạng thái xét nghiệm (`LabPanel`, nhãn từ `LAB_REQUEST_STATUS_LABELS`): `pending` amber, `in_progress` primary, `completed` green — dùng `StatusBadge` (nếu đang có `Tag`/chữ trơn hiển thị trạng thái).
3. `MedicalRecordDetailPage`: `Page` với `back={{ to: '/medical-records', label: 'Bệnh án' }}`, `title` = `Bệnh án #<id>` (id trong `.num` được phép, nhưng chữ hiển thị phải còn đúng "Bệnh án #<id>" để test cũ tìm thấy), `subtitle` = `MedicalRecordStatusTag` khi đã có dữ liệu; các `Card` khối bên trong → `Panel` giữ `title`/`extra`; Card đầu tiên (thông tin bệnh án) đổi tiêu đề thành "Thông tin bệnh án". Khi đang tải/lỗi vẫn render `Page` (tiêu đề "Bệnh án #<id>" lấy từ URL).
4. `Uas7Panel`, `PrescriptionPanel`, `LabPanel`, `LesionPanel`: `Card` ngoài cùng → `Panel` (giữ `title`, `extra`, `style`). Điểm UAS7 và số lượng hiển thị bằng `.num`. Tag mô tả tổn thương ở `LesionPanel` giữ `Tag` (không phải trạng thái).
5. `DynamicForm`: thẻ section giữ `Card size="small"` (theme lo phần nhìn) — không đổi trừ khi có màu cứng.

- [ ] **Step 1:** Lấy mốc: `pnpm --filter @drmayday/web test -- src/pages/clinical src/clinical` → PASS.
- [ ] **Step 2:** `status.tsx` + `PatientsPage` + `MedicalRecordsPage` (+ `pages/clinical/patients/*`). Test → PASS.
- [ ] **Step 3:** `MedicalRecordDetailPage` + 4 panel. Test → PASS.
- [ ] **Step 4:** Toàn bộ test + lint + typecheck + build + format:check → PASS.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/clinical apps/web/src/pages/clinical apps/web/src/components/dynamic-form
git commit -m "feat(web): màn bệnh nhân, bệnh án và màn khám theo khung Page/Panel kiểu Cendo"
```

---

## Task 5: Màn đăng nhập, chặn mã màu cứng, cập nhật tài liệu

**Files:**
- Modify: `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/layout/layout.css` (thêm class màn đăng nhập), `docs/07-tien-do.md`
- Create/Test: `apps/web/src/theme/no-hardcoded-colors.test.ts`

**Interfaces:**
- Consumes: class `dm-sidebar__brand` (chữ thương hiệu), biến `--dm-*`.

- [ ] **Step 1: Viết test chặn mã màu cứng (thất bại vì LoginPage còn `#f0f5ff`)**

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');
const ALLOWED = new Set(['theme/tokens.ts']);
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('mã màu chỉ nằm trong theme/tokens.ts', () => {
  it('không file nguồn nào khác viết hex/rgba', () => {
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path).replaceAll('\\', '/'))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => COLOR.test(readFileSync(join(SRC, file), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
```

Run: `pnpm --filter @drmayday/web test -- src/theme/no-hardcoded-colors`
Expected: FAIL liệt kê `pages/LoginPage.tsx` (và bất kỳ file nào Task 3–4 bỏ sót — sửa luôn theo quy tắc 6 của Task 3).

Nếu một chuỗi KHÔNG phải màu bị bắt nhầm (VD `#` + mã hồ sơ dạng hex trong chữ), sửa regex cho đúng thay vì thêm file vào `ALLOWED`, và ghi lại trong báo cáo.

- [ ] **Step 2: Làm lại `LoginPage` theo spec mục 6**

Giữ nguyên logic form, kiểm tra, thông báo. Thay khung:

```tsx
return (
  <div className="dm-login">
    <Panel className="dm-login__card">
      <div className="dm-login__brand dm-sidebar__brand">
        Dr<span>MayDay</span>
      </div>
      <p className="dm-login__sub">Hệ thống quản lý khám bệnh &amp; theo dõi mề đay</p>
      {/* Alert notice / error giữ nguyên */}
      <Form<LoginRequest> layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
        {/* 2 Form.Item giữ nguyên */}
        <Button type="primary" htmlType="submit" block loading={submitting}>
          Đăng nhập
        </Button>
      </Form>
    </Panel>
  </div>
);
```

Thêm vào `layout.css`:

```css
.dm-login {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 16px;
  background: var(--dm-bg);
}
.dm-login__card.ant-card {
  width: 100%;
  max-width: 400px;
}
.dm-login__brand {
  padding: 0;
  font-size: 26px;
  text-align: center;
}
.dm-login__sub {
  margin: 4px 0 20px;
  color: var(--dm-ink2);
  font-size: 13px;
  text-align: center;
}
```

Bỏ import `Card`, `Typography` nếu không còn dùng.

- [ ] **Step 3: Chạy test** — `no-hardcoded-colors` PASS; toàn bộ test + lint + typecheck + build + format:check PASS.

- [ ] **Step 4: Cập nhật `docs/07-tien-do.md`** — thêm mục "Giao diện web kiểu Cendo (đợt 1)" vào checklist: `[x]` theme + khung app + áp mọi màn web; `[ ]` đợt 2: tab trạng thái có số đếm + chế độ xem cột kiểu Trello (sau khi chuyển CSDL thật); `[ ]` mobile dùng chung bộ màu. Ghi link spec + plan.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src docs/07-tien-do.md
git commit -m "feat(web): màn đăng nhập kiểu Cendo, chặn mã màu ngoài tokens, cập nhật tiến độ"
```
