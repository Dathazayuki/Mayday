import { appTheme } from './antd-theme';
import { cssVariables, cssVariablesBlock, injectCssVariables } from './css-variables';
import { colors, fonts, radius, shadows } from './tokens';

describe('theme', () => {
  afterEach(() => {
    document.head.querySelector('style[data-dm="tokens"]')?.remove();
  });

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
