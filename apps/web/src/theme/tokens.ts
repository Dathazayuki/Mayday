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
