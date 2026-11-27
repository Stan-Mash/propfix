// PropFix V2 — Daylight Glass Design System
// Header dark ink: #0B1320 | Background: #F6F7F9 | Cards: white / #E4E7EC hairline

export const colors = {
  // Dark ink (header, hero cards, primary actions)
  ink: '#0B1320',
  inkElevated: '#142034',
  inkBorder: '#1E2B42',

  // Brand blue (active tabs, links, primary buttons)
  primary: '#1E3A5F',
  primaryMid: '#1D4ED8',
  primaryLight: '#DBEAFE',
  primaryXLight: '#EFF6FF',

  // Surfaces
  background: '#F6F7F9',
  inputBg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F5F9',
  surfaceHover: '#F8FAFC',

  // Borders
  border: '#E4E7EC',
  borderStrong: '#C9CDD6',

  // Text
  text: '#0B1320',
  textSecondary: '#3D4A5C',
  textMuted: '#64748B',

  // Semantic — strict status meaning only
  success: '#065F46',
  successMid: '#059669',
  successBg: '#D1FAE5',
  successBorder: '#6EE7B7',

  warning: '#78350F',
  warningMid: '#B45309',
  warningBg: '#FEF3C7',
  warningBorder: '#F59E0B',

  danger: '#7F1D1D',
  dangerMid: '#B91C1C',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FCA5A5',

  info: '#1E40AF',
  infoBg: '#DBEAFE',
  infoBorder: '#93C5FD',

  purple: '#6B21A8',
  purpleMid: '#7C3AED',
  purpleBg: '#F3E8FF',
  purpleBorder: '#C4B5FD',

  amber: '#B45309',
  amberBg: '#FFFBEB',
};

export const shadow = {
  sm: {
    shadowColor: '#0B1320',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0B1320',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
};

// Standard card: white, 1px hairline, minimal shadow
export const card = {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#E4E7EC',
  marginBottom: 12,
  shadowColor: '#0B1320',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 4,
  elevation: 2,
};

export const accent = {
  Emergency: '#B91C1C',
  Urgent: '#B45309',
  Routine: '#1D4ED8',
  done: '#059669',
  info: '#1D4ED8',
  neutral: '#94A3B8',
};

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
