import type { ThemeConfig } from 'antd';

// Tasarım paleti (kullanıcının verdiği değerler)
export const palette = {
  // Arka planlar & yüzeyler
  pageBg: '#F3F5F9',
  chromeBg: '#EAEDF4', // sol menü ve üst bar
  surface: '#FFFFFF',
  subtle: '#F7F8FC', // tablo başlığı, arama kutusu içi
  border: '#E1E4ED',
  // Lacivert
  navy: '#1C2541', // aktif menü, ana buton
  navyHover: '#28355C',
  heading: '#1A2036',
  body: '#4A536B',
  muted: '#6B7280',
  // Lila
  lilac: '#6B61D4', // logo, ilerleme çubuğu
  lilacIcon: '#5B50E6',
  lilacSoft: '#ECEBFA',
  // Grafik serilerinde pastel ve koyu mor tonları kullanılır.
  chartA: 'var(--lilac-chart-pastel)',
  chartB: 'var(--lilac-accent)',
};

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.lilacIcon,
    colorInfo: palette.lilacIcon,
    colorLink: palette.lilacIcon,
    colorSuccess: '#15803D',
    colorWarning: '#B45309',
    colorError: '#E05252',
    colorText: palette.heading,
    colorTextSecondary: palette.body,
    colorTextTertiary: palette.muted,
    colorBgLayout: palette.pageBg,
    colorBgContainer: palette.surface,
    colorBorder: palette.border,
    colorBorderSecondary: palette.border,
    colorSplit: palette.border,
    borderRadius: 10,
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Layout: {
      siderBg: palette.chromeBg,
      headerBg: palette.chromeBg,
      headerHeight: 72,
      headerPadding: '0 28px',
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: palette.muted,
      itemHoverBg: 'rgba(28, 37, 65, 0.06)',
      itemHoverColor: palette.navy,
      itemSelectedBg: palette.navy,
      itemSelectedColor: '#FFFFFF',
      groupTitleColor: palette.muted,
      itemBorderRadius: 12,
      itemMarginInline: 14,
      itemHeight: 46,
      iconSize: 18,
      fontSize: 15,
    },
    Button: {
      colorPrimary: palette.navy,
      colorPrimaryHover: palette.navyHover,
      colorPrimaryActive: '#141B30',
      primaryShadow: '0 6px 16px -8px rgba(28, 37, 65, 0.6)',
      fontWeight: 600,
      controlHeight: 38,
    },
    Table: {
      headerBg: palette.subtle,
      headerColor: palette.heading,
      colorText: palette.body,
      rowHoverBg: '#F7F8FC',
      borderColor: palette.border,
      headerSplitColor: 'transparent',
    },
    Card: { borderRadiusLG: 16, colorBorderSecondary: palette.border },
    Input: { controlHeight: 38 },
    Select: { controlHeight: 38 },
    DatePicker: { controlHeight: 38 },
  },
};

// Renkler, kökteki ters çevirme filtresinden sonra mor görünür.
export const invertedAppTheme: ThemeConfig = {
  ...appTheme,
  token: {
    ...appTheme.token,
    colorPrimary: '#4E6612',
    colorInfo: '#4E6612',
    colorLink: '#4E6612',
  },
};
