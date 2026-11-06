// Palette sobre « fintech » : vert profond, neutres chauds, contrastes AA.
export const colors = {
  primary: '#0B5D3B',
  primaryPressed: '#08472D',
  primarySoft: '#E7F2EC',
  onPrimary: '#FFFFFF',
  bg: '#F6F7F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F3F1',
  text: '#0F1A14',
  textMuted: '#55655C',
  border: '#DCE3DF',
  success: '#067647',
  successSoft: '#DCFAE6',
  warning: '#93370D',
  warningSoft: '#FEF0C7',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
  info: '#1849A9',
  infoSoft: '#D1E9FF',
  gold: '#B8860B',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = {
  title: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  amount: { fontSize: 28, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
};
/** Cibles tactiles ≥ 44 pt (WCAG 2.5.5) */
export const minTouch = 48;

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textMuted, bg: colors.surfaceAlt },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  primary: { fg: colors.primary, bg: colors.primarySoft },
};
