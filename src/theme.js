export const colors = {
  // Brand
  primary: '#1E3A5F',
  primaryMid: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryXLight: '#EFF6FF',

  // Surfaces
  background: '#F1F5F9',
  inputBg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  surfaceHover: '#F8FAFC',

  // Borders
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  // Text
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',

  // Semantic
  success: '#065F46',
  successMid: '#16A34A',
  successBg: '#D1FAE5',
  successBorder: '#6EE7B7',

  warning: '#92400E',
  warningMid: '#B45309',
  warningBg: '#FEF3C7',
  warningBorder: '#F59E0B',

  danger: '#991B1B',
  dangerMid: '#DC2626',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FCA5A5',

  info: '#1E40AF',
  infoBg: '#DBEAFE',
  infoBorder: '#93C5FD',

  purple: '#6B21A8',
  purpleMid: '#7C3AED',
  purpleBg: '#F3E8FF',
  purpleBorder: '#C4B5FD',

  amber: '#D97706',
  amberBg: '#FFFBEB',
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
};

// Standard card: white surface, uniform hairline border, soft shadow. No coloured borders;
// status is shown with an 8px dot (see StatusDot) or one badge in the card header.
export const card = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  marginBottom: 14,
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
};

// Status dot colours
export const accent = {
  Emergency: '#DC2626',
  Urgent: '#D97706',
  Routine: '#2563EB',
  done: '#059669',
  info: '#2563EB',
  neutral: '#94A3B8',
};

// Enterprise: tight radius, dense layouts
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
