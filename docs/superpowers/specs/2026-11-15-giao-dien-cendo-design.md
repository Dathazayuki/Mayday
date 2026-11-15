# Thiết kế: Giao diện web theo phong cách Cendo, màu xanh dương (đợt 1)

- **Ngày:** 2026-11-15
- **Trạng thái:** người dùng duyệt hướng qua mockup ("khá là vừa mắt… nên triển khai theo hướng này") và duyệt thiết kế ("tôi oke hết bạn cứ triển khai thẳng nhé").
- **Nguồn:**
  - Hệ thiết kế Cendo đang chạy: `C:\Users\Admin\Desktop\CENDO-Idea_Manage\final-design\cendo-design-system.html` (tokens, nút, bảng, tab, badge, modal), `apps/web/tailwind.config.js`, `apps/web/src/components/layout/Sidebar.tsx`.
  - Tiền lệ "bố cục Cendo, bảng màu riêng": `CENDO-Idea_Manage\design_COH.md` (màu là lớp duy nhất được thay; mọi hex ở MỘT file token).
  - Mockup đã duyệt: `.superpowers/brainstorm/1923-1794713301/content/visual-style.html` (phương án màu A).
- **Phạm vi:** chỉ `apps/web` (bác sĩ + quản trị). Mobile làm sau với cùng bộ màu.
- **Ngoài phạm vi (đợt 2):** tab trạng thái có số đếm và chế độ xem dạng cột kiểu Trello cho màn quy trình. Đợt 2 làm sau khi chuyển sang CSDL thật của nhóm DB, vì các cột phải theo trạng thái thật của CSDL đó.

## 1. Nguyên tắc

1. **Chỉ đổi phần nhìn.** Không đổi hành vi, luồng, lời gọi API hay dữ liệu. Test hiện có phải xanh; chỉ sửa test bám vào cấu trúc DOM cũ (VD `Card` làm tiêu đề trang).
2. **Giữ antd 6**, không thêm Tailwind. Mọi tuỳ biến đi qua `ConfigProvider theme` (token toàn cục + token component) và một file CSS nhỏ cho phần antd không có token.
3. **Một nguồn sự thật cho màu:** mọi giá trị hex/rgba chỉ nằm trong `apps/web/src/theme/tokens.ts`. Theme antd và biến CSS đều sinh từ file này. Component và trang chỉ dùng tên token/biến CSS/class.
4. **Chữ giao diện tiếng Việt, comment tiếng Việt**, theo quy ước codebase.

## 2. Token (giá trị chính xác)

### 2.1 Màu

| Token | Giá trị | Dùng cho |
|---|---|---|
| `primary` | `#1677FF` | nút chính, mục menu đang chọn, tab đang chọn, focus, link |
| `primaryHover` | `#0958D9` | hover nút chính (đậm hơn, như Cendo) |
| `primaryActive` | `#003EB3` | nhấn nút chính |
| `primaryWeak` | `rgba(22,119,255,0.12)` | nền mục menu đang chọn, nền badge "đang", dòng đang chọn |
| `bg` | `#EBEEF2` | nền trang |
| `surface` | `#FFFFFF` | sidebar, thanh trên, thẻ, bảng, modal |
| `ink` | `#20242A` | chữ chính |
| `ink2` | `#565D64` | chữ phụ, nhãn |
| `ink3` | `#8B9299` | chữ mờ, tiêu đề cột bảng, tiêu đề nhóm menu |
| `line` | `#E1E5EA` | viền, đường chia |
| `line2` | `#EDF0F3` | kẻ mảnh giữa các dòng bảng, hover menu |
| `rowHover` | `#F7F9FB` | hover dòng bảng |
| `green` / `greenWeak` | `#4E9A5A` / `rgba(78,154,90,0.15)` | hoàn tất, hoạt động |
| `amber` / `amberWeak` | `#9C6B15` / `rgba(181,121,31,0.15)` | chờ xử lý, cần chú ý |
| `red` / `redWeak` | `#B8433A` / `rgba(184,67,58,0.12)` | lỗi, huỷ, bắt buộc, nguy hiểm |
| `slate` / `slateWeak` | `#3B4045` / `rgba(59,64,69,0.10)` | trung tính đậm |

### 2.2 Chữ, bo góc, bóng

- **Phông:** `sans` = `'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` (toàn UI); `num` = `'Sora', 'Be Vietnam Pro', system-ui, sans-serif` (CHỈ số liệu: mã hồ sơ/mã bệnh nhân, số đếm, điểm số).
- Phông tự host bằng `@fontsource/be-vietnam-pro` (400, 500, 600, 700) và `@fontsource/sora` (500, 600, 700), import ở `main.tsx`. Không tải từ Google Fonts (dữ liệu y tế, có thể chạy trong mạng nội bộ). Đây là **hai phụ thuộc mới duy nhất** của đợt này.
- Cỡ chữ gốc antd giữ `14`.
- **Bo góc:** `xs` 6 (nút nhỏ trong bảng), `sm` 10 (mặc định: nút, ô nhập), `md` 16 (thẻ, panel), `lg` 22 (modal).
- **Bóng:** `soft` = `0 1px 2px rgba(20,24,30,0.05), 0 8px 24px rgba(20,24,30,0.07)` (thẻ); `card` = `0 10px 34px rgba(20,24,30,0.10)` (dropdown, popover); `pop` = `0 20px 60px rgba(20,24,30,0.22)` (modal).

## 3. Cấu trúc mã

| File | Trách nhiệm |
|---|---|
| `src/theme/tokens.ts` | Hằng số token mục 2 (nguồn duy nhất của hex/rgba). |
| `src/theme/antd-theme.ts` | `appTheme: ThemeConfig` sinh từ tokens: token toàn cục + token component (mục 4). |
| `src/theme/css-variables.ts` | Sinh khối `:root { --dm-*: … }` từ tokens; `App` gắn khối này bằng một thẻ `<style>`. `global.css` và style tự viết chỉ dùng `var(--dm-*)`, không lặp hex. |
| `src/theme/global.css` | Reset nhẹ, nền `body`, class tiện ích (`.num`), phần antd không có token (chữ hoa + giãn chữ ở tiêu đề cột bảng). Chỉ dùng `var(--dm-*)`, không hex. |
| `src/theme/StatusBadge.tsx` | Badge dạng viên thuốc theo "tông" (`neutral`, `primary`, `green`, `amber`, `red`, `slate`): nền weak + chữ đậm cùng họ, 11px, đậm 600. Thay mọi `Tag color=...` mang nghĩa trạng thái. |
| `src/layout/AppShell.tsx` | Thay `AppLayout`: lưới `230px 1fr`, cao 100vh; sidebar cuộn riêng; cột phải là `<Outlet/>` bọc trong provider công cụ thanh trên. |
| `src/layout/Sidebar.tsx` | Sidebar kiểu Cendo (mục 5.1). |
| `src/layout/Page.tsx` | Khung một trang: thanh trên (tiêu đề, phụ đề, nút quay lại, thao tác, công cụ chung) + vùng nội dung cuộn (mục 5.2). |
| `src/layout/HeaderTools.tsx` | Chuông thông báo (`NotificationBell` hiện có) + avatar mở menu tài khoản (hồ sơ, đổi mật khẩu, đăng xuất — giữ đúng hành vi hiện tại của `AppLayout`). |
| `src/layout/Panel.tsx` | Thẻ trắng nội dung: bo 16, viền `line`, bóng `soft`; có `title?`, `extra?`. Thay các `Card` làm khung nội dung. |
| `src/layout/menu.ts` | Thêm `icon` cho mỗi mục (icon outlined của `@ant-design/icons`, nét mảnh giống Feather của Cendo). |

`AppLayout.tsx` bị xoá sau khi `AppShell` thay thế; `routes.tsx` dùng `AppShell`.

## 4. Theme antd (giá trị chính xác)

- **Toàn cục:** `colorPrimary` = primary, `colorPrimaryHover` = primaryHover, `colorPrimaryActive` = primaryActive, `colorSuccess` = green, `colorWarning` = amber, `colorError` = red, `colorInfo` = primary, `colorText` = ink, `colorTextSecondary` = ink2, `colorTextTertiary` = ink3, `colorBorder` = line, `colorBorderSecondary` = line2, `colorBgLayout` = bg, `colorBgContainer` = surface, `fontFamily` = sans, `fontSize` 14, `borderRadius` 10, `borderRadiusSM` 6, `borderRadiusLG` 16, `controlHeight` 38, `boxShadow` = card, `boxShadowSecondary` = card.
- **Button:** `fontWeight` 600, `primaryShadow` none, `defaultShadow` none, `dangerShadow` none.
- **Table:** `headerBg` = surface, `headerColor` = ink3, `headerSplitColor` transparent, `borderColor` = line2, `rowHoverBg` = rowHover, `rowSelectedBg` = primaryWeak, `cellPaddingBlock` 11, `cellPaddingInline` 16. Trong `global.css`: `th` cỡ 11px, đậm 600, chữ hoa, giãn chữ `0.05em`, viền dưới `line`.
- **Tabs:** `inkBarColor` = primary, `itemColor` = ink2, `itemSelectedColor` = ink, `itemHoverColor` = ink, `titleFontSize` 14.
- **Card:** `headerFontSize` 16, `headerBg` transparent (bo/bóng do `Panel` đặt).
- **Modal:** `borderRadiusLG` 22, `titleFontSize` 17, bóng `pop`.
- **Drawer, Dropdown, Popover, Select, Input, DatePicker:** dùng token toàn cục; không tuỳ biến thêm trừ khi cần để khớp bảng 2.
- Không bật thuật toán dark mode.

## 5. Khung ứng dụng

### 5.1 Sidebar

- Nền `surface`, viền phải `line`, đệm `18px 12px`.
- Đầu: `Dr` + `MayDay` (phần "MayDay" màu primary), 19px đậm 700; dòng phụ "Khám & điều trị mày đay" 11px `ink3`.
- Mục "Tổng quan" đứng riêng đầu danh sách, rồi các nhóm của `NAV_GROUPS` theo **đúng luật hiện hành** (`adminOnly` → chỉ khi `useIsAdmin() === true`; `staffOnly` → ẩn khi `useIsPatient() === true`).
- Tiêu đề nhóm: 10px, đậm 600, chữ hoa, giãn chữ `0.08em`, màu `ink3`.
- Mục menu là `NavLink`: icon 18px + chữ 13.5px đậm 500 màu `ink2`, đệm `9px 10px`, bo 10, viền trái 3px trong suốt; hover nền `line2` chữ `ink`; **đang chọn**: viền trái primary, nền primaryWeak, chữ `ink` đậm 600. Luật "đang chọn" giữ như hiện tại: khớp đúng đường dẫn hoặc là trang con (`/medical-records/5` sáng "Bệnh án"); "Tổng quan" chỉ sáng ở `/`.
- Đáy: khối người dùng (viền trên `line`): avatar tròn 32px chữ cái đầu (nền `ink`, chữ trắng) + họ tên 12.5px đậm 600 + dòng phụ 11px `ink3` là tên vai trò nếu dữ liệu đăng nhập có sẵn, nếu không có thì bỏ dòng phụ (không gọi thêm API chỉ để lấy tên vai trò).
- **Màn hẹp (< 992px):** sidebar ẩn; thanh trên của `Page` hiện nút menu mở sidebar trong `Drawer` trái (cùng nội dung). Bấm một mục thì đóng drawer.

### 5.2 Page

- Props: `title: ReactNode` (bắt buộc), `subtitle?: ReactNode`, `back?: { to: string; label: string }`, `actions?: ReactNode`, `children`.
- Thanh trên: cao tối thiểu 64px, nền `surface`, viền dưới `line`, đệm ngang 24px. Trái: (nút "‹ {back.label}" dạng link `ink2` nếu có) + tiêu đề 20px đậm 700 + phụ đề 12.5px `ink2` dưới tiêu đề. Phải: `actions`, rồi công cụ chung.
- Công cụ chung (chuông + avatar) do `AppShell` cung cấp qua React context; `Page` render ra nếu có. Ngoài shell (test trang đơn lẻ) context rỗng nên không render — trang không phụ thuộc thông báo/xác thực chỉ vì có thanh trên.
- Vùng nội dung: cuộn dọc, đệm `20px 24px`, các khối cách nhau 16px.
- **Mọi trang trong shell dùng `Page`** (kể cả Tổng quan/ComingSoon và NotFound). Tiêu đề trước đây nằm ở `Card title` chuyển lên `Page title`.

### 5.3 Panel và bảng

- `Panel` = khung nội dung của trang. Trang danh sách: một `Panel` chứa thanh lọc (đệm `12px 16px`, viền dưới `line`) + bảng sát mép panel.
- `EntityTable` giữ API; bảng hiển thị theo token mục 4. Ô mã/số dùng class `.num`.
- Nút thao tác trong bảng dùng `size="small"`.

## 6. Áp dụng lên các màn

| Màn | Việc |
|---|---|
| Đăng nhập | Thẻ trắng giữa nền `bg`, rộng tối đa 400px, bo 16, bóng `soft`; đầu thẻ là chữ `DrMayDay` như sidebar + dòng phụ; ô nhập và nút cỡ `large`, nút đăng nhập rộng hết thẻ. Giữ nguyên trường, kiểm tra và luồng (gồm quên mật khẩu). |
| Tổng quan (ComingSoon), NotFound | Dùng `Page` + `Panel`/`Empty`. |
| Hồ sơ, Đổi mật khẩu | `Page` + `Panel` (giữ `maxWidth` hiện có). |
| Người dùng, Vai trò và quyền hạn, Cơ sở vật chất, Mẫu phiếu khám | `Page` (nút tạo mới chuyển vào `actions`) + `Panel` chứa bộ lọc và bảng; `Tag` trạng thái → `StatusBadge` (Hoạt động = green, Đã khoá = neutral; Đang dùng = green, Ngừng dùng = neutral). |
| Trình thiết kế mẫu phiếu | `Page` có `back` về "Mẫu phiếu khám", tiêu đề là tên mẫu; nhãn "Bắt buộc" → `StatusBadge` red, loại câu hỏi → primary, người điền / mã câu hỏi → neutral. |
| Bệnh nhân, Bệnh án | `Page` + `Panel`; `MedicalRecordStatusTag` dùng `StatusBadge`: draft neutral, pending amber, in_progress primary, completed green, cancelled red. Mã bệnh án/bệnh nhân dùng `.num`. |
| Style inline đang có màu cứng (`components/ItemList.tsx`, `pages/admin/templates/SectionList.tsx`) | Đổi sang `var(--dm-line)` / `var(--dm-line2)` / `var(--dm-ink3)` tương ứng. |
| Màn khám bệnh án và các panel (UAS7, đơn thuốc, xét nghiệm, tổn thương, form động) | `Page` có `back` về "Bệnh án", tiêu đề "Bệnh án #id"; các khối hiện là `Card` chuyển thành `Panel`; nhãn trạng thái xét nghiệm dùng `StatusBadge` (pending amber, in_progress primary, completed green); thẻ section của form động giữ `Card size="small"` theo theme. |

## 7. Kiểm thử và nghiệm thu

- Test mới: `tokens`→`appTheme` (các token mục 4 lấy đúng giá trị mục 2); `Sidebar` (nhóm theo vai, mục đang chọn kể cả trang con, khối người dùng); `Page` (tiêu đề/phụ đề/back/actions; công cụ chung chỉ có khi trong shell); `StatusBadge` (tông → class); `AppShell` (mở/đóng drawer ở màn hẹp nếu kiểm được bằng jsdom, nếu không thì kiểm nút menu hiện khi `Grid.useBreakpoint` báo hẹp).
- Một test chặn hex: quét `apps/web/src/**/*.{ts,tsx,css}` (trừ `theme/tokens.ts` và file test) không có mẫu `#[0-9a-fA-F]{3,8}\b` hay `rgba?(` — giữ nguyên tắc 1.3.
- Toàn bộ `pnpm --filter @drmayday/web test`, `lint`, `typecheck`, `build` xanh; `pnpm format:check` sạch.
- Nghiệm thu bằng mắt trên trình duyệt thật (API + web dev): chụp lại từng màn ở mục 6, so với mockup đã duyệt.
