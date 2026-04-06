/**
 * aha! Register — Design System Tokens
 *
 * SINGLE SOURCE OF TRUTH for all visual values.
 * Every component imports from here. No hardcoded colors, font sizes,
 * spacing, or radii in component files. If a value isn't here, it doesn't exist.
 *
 * Updated: 2026-03-29
 * Palette: Dark mode / Green accent
 * Spec: docs/state-of-the-art/DESIGN-SYSTEM.md
 */

import { Platform } from 'react-native';

// ── Brand ────────────────────────────────────────────────────────────────────

export const brand = {
  colors: {
    primary: '#1E2D3D',      // navy — buttons, headers, tab bar, primary actions
    accent: '#2D5A27',        // primary interactive green (canonical)
    background: '#0A0A0A',    // near-black — screen backgrounds
    surface: '#1E1E1E',       // dark gray — card backgrounds
    secondaryText: '#A0A0A0', // muted text on dark
    text: '#E8E8E8',          // light text on dark
    textOnPrimary: '#1A1A1A', // dark text for light surfaces
    border: '#2A2A2A',        // subtle dark border
    danger: '#A32D2D',        // errors, destructive actions
  },
  radii: {
    button: 8,
    chip: 6,
    card: 12,
    input: 6,
    icon: 14,
  },
} as const;

// ── Colors ────────────────────────────────────────────────────────────────────

export const colors = {
  // ── Primary (main actions, headers, tab bar) ─────────────────────────────
  primary: brand.colors.primary,
  primaryDark: '#131E29',
  primaryLight: '#1A2E18',
  primarySurface: '#152414',
  primaryContainer: 'rgba(30, 45, 61, 0.10)',

  // ── Accent (active tab, trust badges, verified indicators) ────────────────
  // accent = primary interactive color (buttons, links, active states). Must be green.
  // Dark mode uses a lighter green (#4E9A47) for WCAG AA contrast on dark backgrounds.
  accent: '#4E9A47',
  accentLight: '#1A2E18',
  accentDark: '#1F3F1C',
  accentText: '#FFFFFF',
  heroGreen: '#4E9A47', // alias — canonical interactive green is `accent`

  // ── Secondary (tags, filters, less prominent UI) ─────────────────────────
  secondary: brand.colors.secondaryText,
  secondaryContainer: 'rgba(107, 123, 141, 0.10)',

  // ── Tertiary / AI (AI-assisted actions, distinct from primary) ────────────
  tertiary: '#5C6BC0',
  tertiaryContainer: 'rgba(92, 107, 192, 0.12)',

  // ── Text hierarchy ───────────────────────────────────────────────────────
  text: brand.colors.text,
  textSecondary: brand.colors.secondaryText,
  textTertiary: '#666666',
  textInverse: brand.colors.textOnPrimary,

  // ── Surfaces ─────────────────────────────────────────────────────────────
  background: brand.colors.background,
  surface: brand.colors.surface,
  surfaceSecondary: '#1A1A1A',
  surfaceContainer: '#1A1A1A',
  surfaceContainerHigh: '#2A2A2A',
  surfaceElevated: '#252525',

  // ── Borders ──────────────────────────────────────────────────────────────
  border: brand.colors.border,
  borderFocused: '#2D5A27',

  // ── Semantic ─────────────────────────────────────────────────────────────
  error: brand.colors.danger,
  errorLight: '#3D1515',
  warning: '#B45309',
  warningLight: '#3D2A08',
  success: '#0F766E',
  successLight: '#0D2D2A',
  info: '#1D4ED8',
  infoLight: '#0D1B3D',

  // ── Status (sync, connectivity) ──────────────────────────────────────────
  statusSyncing: '#1976D2',
  statusOffline: '#757575',
  statusSuccess: '#2E7D32',
  statusWarning: '#E65100',
  statusError: brand.colors.danger,

  // ── AI accent ────────────────────────────────────────────────────────────
  ai: '#A16207',
  aiLight: '#3D2A08',
  aiSurface: '#2D1F06',
  aiBorder: 'rgba(161, 98, 7, 0.25)',
  aiText: '#A16207',

  // ── AI Confidence scale ──────────────────────────────────────────────────
  aiConfidenceHigh: '#2E7D32',
  aiConfidenceMedium: '#E65100',
  aiConfidenceLow: brand.colors.danger,

  // ── CTA (primary action card) ────────────────────────────────────────────
  ctaSurface: 'rgba(30, 45, 61, 0.06)',
  ctaBorder: 'rgba(30, 45, 61, 0.18)',

  // ── Home V2 palette ────────────────────────────────────────────────────
  surfaceMuted: '#141414',
  amber: '#D4A017', // AI Review / warning-adjacent UI only (pencil icon); not the primary accent
  borderCard: '#2A2A2A',
  purpleLight: '#1A1520',
  purple: '#5B21B6',
  greenLight: '#0D2D1A',
  greenDark: '#065F46',
  brownDark: '#92400E', // AI Review muted label text; not primary accent
  blueDark: '#1E40AF',

  // ── Header ──────────────────────────────────────────────────────────────
  headerBg: '#0A0A0A',
  headerBackground: '#0A0A0A',
  headerText: '#E8E8E8',

  // ── Utility ──────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.85)',
  overlayMedium: 'rgba(0, 0, 0, 0.4)',
  overlayDarkest: 'rgba(0, 0, 0, 0.95)',
  skeleton: '#2A2A2A',
  skeletonHighlight: '#333333',
  transparent: 'transparent',
  camera: '#111111',
  cameraBg: '#0D0D0D',

  // ── Camera / viewfinder overlays (must work on arbitrary scene content) ──
  cameraOverlay: 'rgba(0, 0, 0, 0.6)',
  cameraOverlayLight: 'rgba(0, 0, 0, 0.45)',
  cameraButtonBg: 'rgba(255, 255, 255, 0.15)',
  cameraPillBg: 'rgba(255, 255, 255, 0.12)',
  cameraGrid: 'rgba(255, 255, 255, 0.3)',
  cameraLevelFlat: 'rgba(45, 90, 39, 0.85)',
  cameraLevelTilted: 'rgba(255, 255, 255, 0.5)',
  cameraCountBg: 'rgba(0, 0, 0, 0.55)',
  cameraTextBright: 'rgba(255, 255, 255, 0.8)',
  cameraTextDim: 'rgba(255, 255, 255, 0.7)',
  cameraTextMuted: 'rgba(255, 255, 255, 0.45)',
  cameraSidebarBg: 'rgba(0, 0, 0, 0.85)',
  cameraSidebarItem: 'rgba(255, 255, 255, 0.08)',
  cameraSidebarItemActive: 'rgba(255, 255, 255, 0.18)',
  cameraBadgeOptional: 'rgba(255, 255, 255, 0.3)',
  cameraThumbOverlay: 'rgba(0, 0, 0, 0.35)',
  cameraProgressBg: 'rgba(255, 255, 255, 0.2)',
  labelOverlay: 'rgba(255, 255, 255, 0.92)',
  headerBlur: 'rgba(10, 10, 10, 0.75)',

  // ── Card / Input / Icon ──────────────────────────────────────────────────
  cardBackground: '#1E1E1E',
  inputBackground: '#1A1A1A',
  inputBorder: '#2A2A2A',
  inputText: '#E8E8E8',
  placeholderText: '#666666',
  iconDefault: '#A0A0A0',
  iconActive: '#4E9A47',
  tabBarBackground: '#0A0A0A',
  tabBarBorder: '#2A2A2A',
  tabBarIndicator: 'rgba(255, 255, 255, 0.08)',
  statusBarStyle: 'light-content',

  // ── Semantic aliases ────────────────────────────────────────────────────
  dangerBackground: '#3D1515',
  warningBackground: '#3D2A08',

  // ── Legacy aliases (all now derive from brand) ──
  textPrimary: brand.colors.text,
  textMuted: '#666666',
  borderLight: '#2A2A2A',
  danger: brand.colors.danger,
  dangerLight: '#3D1515',
  chipActive: brand.colors.primary,
  chipInactive: brand.colors.surface,
} as const;

// ── Light palette ────────────────────────────────────────────────────────────

export const lightColors: Record<keyof typeof colors, string> = {
  primary: '#1E2D3D',
  primaryDark: '#0F1924',
  primaryLight: '#E8F5E4',
  primarySurface: '#F0F7EF',
  primaryContainer: 'rgba(30, 45, 61, 0.06)',
  accent: '#2D5A27',
  accentLight: '#E8F5E4',
  accentDark: '#1F3F1C',
  accentText: '#FFFFFF',
  heroGreen: '#2D5A27',
  secondary: '#6B7280',
  secondaryContainer: 'rgba(107, 123, 141, 0.10)',
  tertiary: '#5C6BC0',
  tertiaryContainer: 'rgba(92, 107, 192, 0.12)',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#F0F0F0',
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F5F4',
  surfaceContainer: '#F5F5F4',
  surfaceContainerHigh: '#EDEDEC',
  surfaceElevated: '#FFFFFF',
  border: '#E5E7EB',
  borderFocused: '#2D5A27',
  error: '#DC2626',
  errorLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  success: '#059669',
  successLight: '#ECFDF5',
  info: '#2563EB',
  infoLight: '#EFF6FF',
  statusSyncing: '#1976D2',
  statusOffline: '#9CA3AF',
  statusSuccess: '#16A34A',
  statusWarning: '#EA580C',
  statusError: '#DC2626',
  ai: '#B45309',
  aiLight: '#FFFBEB',
  aiSurface: '#FEF9C3',
  aiBorder: 'rgba(161, 98, 7, 0.20)',
  aiText: '#B45309',
  aiConfidenceHigh: '#16A34A',
  aiConfidenceMedium: '#EA580C',
  aiConfidenceLow: '#DC2626',
  ctaSurface: 'rgba(30, 45, 61, 0.04)',
  ctaBorder: 'rgba(30, 45, 61, 0.12)',
  surfaceMuted: '#F5F5F4',
  amber: '#D97706',
  borderCard: '#E5E7EB',
  purpleLight: '#F5F3FF',
  purple: '#7C3AED',
  greenLight: '#ECFDF5',
  greenDark: '#047857',
  brownDark: '#B45309',
  blueDark: '#2563EB',
  headerBg: '#FFFFFF',
  headerBackground: '#FFFFFF',
  headerText: '#1A1A1A',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  overlayDark: 'rgba(0, 0, 0, 0.7)',
  overlayMedium: 'rgba(0, 0, 0, 0.4)',
  overlayDarkest: 'rgba(0, 0, 0, 0.95)',
  skeleton: '#E5E7EB',
  skeletonHighlight: '#D1D5DB',
  transparent: 'transparent',
  camera: '#111111',
  cameraBg: '#0D0D0D',
  cameraOverlay: 'rgba(0, 0, 0, 0.6)',
  cameraOverlayLight: 'rgba(0, 0, 0, 0.45)',
  cameraButtonBg: 'rgba(255, 255, 255, 0.15)',
  cameraPillBg: 'rgba(255, 255, 255, 0.12)',
  cameraGrid: 'rgba(255, 255, 255, 0.3)',
  cameraLevelFlat: 'rgba(45, 90, 39, 0.85)',
  cameraLevelTilted: 'rgba(255, 255, 255, 0.5)',
  cameraCountBg: 'rgba(0, 0, 0, 0.55)',
  cameraTextBright: 'rgba(255, 255, 255, 0.8)',
  cameraTextDim: 'rgba(255, 255, 255, 0.7)',
  cameraTextMuted: 'rgba(255, 255, 255, 0.45)',
  cameraSidebarBg: 'rgba(0, 0, 0, 0.85)',
  cameraSidebarItem: 'rgba(255, 255, 255, 0.08)',
  cameraSidebarItemActive: 'rgba(255, 255, 255, 0.18)',
  cameraBadgeOptional: 'rgba(255, 255, 255, 0.3)',
  cameraThumbOverlay: 'rgba(0, 0, 0, 0.35)',
  cameraProgressBg: 'rgba(255, 255, 255, 0.2)',
  labelOverlay: 'rgba(255, 255, 255, 0.92)',
  headerBlur: 'rgba(250, 250, 248, 0.75)',
  cardBackground: '#FFFFFF',
  inputBackground: '#FFFFFF',
  inputBorder: '#E5E7EB',
  inputText: '#1A1A1A',
  placeholderText: '#9CA3AF',
  iconDefault: '#6B7280',
  iconActive: '#2D5A27',
  tabBarBackground: '#FAFAF8',
  tabBarBorder: '#E5E7EB',
  tabBarIndicator: 'rgba(30, 45, 61, 0.08)',
  statusBarStyle: 'dark-content',
  dangerBackground: '#FEF2F2',
  warningBackground: '#FFFBEB',
  textPrimary: '#1A1A1A',
  textMuted: '#9CA3AF',
  borderLight: '#E5E7EB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  chipActive: '#1E2D3D',
  chipInactive: '#F3F4F6',
};

/** Dark colors (same as `colors`, aliased for clarity) */
export const darkColors = colors;

/** Named palette exports matching the light/dark convention */
export const lightPalette = lightColors;
export const darkPalette = darkColors;

/** Type for theme color palette — keys from colors, values are strings */
export type ColorPalette = Record<keyof typeof colors, string>;

// ── Typography ────────────────────────────────────────────────────────────────

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },

  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },

  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },

  mono: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    fontFamily: monoFamily,
  },

  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },

  // ── Legacy aliases ──
  size: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    title: 30,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
} as const;

// ── Spacing (8pt grid) ───────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,

  // ── Legacy aliases ──
  xxl: 24,
  xxxl: 32,
} as const;

// ── Border Radii ──────────────────────────────────────────────────────────────

export const radii = {
  sm: brand.radii.chip,
  md: brand.radii.button,
  lg: brand.radii.card,
  full: 999,

  // ── Legacy aliases ──
  xl: 20,
  pill: 9999,
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// ── Touch Targets ─────────────────────────────────────────────────────────────

export const touch = {
  minTarget: 48,
  minTargetSmall: 44,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

// ── Accessibility ─────────────────────────────────────────────────────────────

export const a11y = {
  minContrastNormal: 4.5,
  minContrastLarge: 3.0,
  focusRingColor: brand.colors.primary,
  focusRingWidth: 2,
  focusRingOffset: 2,
} as const;

// ── Tab Bar ─────────────────────────────────────────────────────────────────

export const tabBar = {
  height: 64,
  iconSize: 24,
  activeStrokeWidth: 2.5,
  inactiveStrokeWidth: 1.5,
  labelSize: 11,
  indicatorWidth: 64,
  indicatorHeight: 32,
  indicatorRadius: 16,
  // Color fields removed — use colors.tabBarBackground, colors.accent, etc.
  // from useTheme() in tab bar components for proper light/dark support.
} as const;

// ── Layout Constants ──────────────────────────────────────────────────────────

export const layout = {
  screenPadding: 20,
  cardPadding: 16,
  /** @deprecated Use touch.minTarget instead */
  minTouchTarget: 48,
} as const;
