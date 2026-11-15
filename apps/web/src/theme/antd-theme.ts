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
