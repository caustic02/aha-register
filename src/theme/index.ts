/**
 * aha! Register — Design System Tokens
 *
 * SINGLE SOURCE OF TRUTH for all visual values.
 * Every component imports from here. No hardcoded colors, font sizes,
 * spacing, or radii in component files. If a value isn't here, it doesn't exist.
 *
 * Updated: 2026-03-17
 * Spec: docs/state-of-the-art/DESIGN-SYSTEM.md
 */

import { Platform } from 'react-native';

// ── Colors ────────────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  primary: '#2D5A27',
  primaryDark: '#1E3D1A',
  primaryLight: '#E8F0E7',
  primarySurface: '#F2F7F1',

  // Text hierarchy (on white/off-white backgrounds)
  text: '#1A1A1A',
  textSecondary: '#5C5C5C',
  textTertiary: '#767676',
  textInverse: '#FFFFFF',

  // Surfaces
  background: '#FFFFFF',
  surface: '#F7F5F0',
  surfaceElevated: '#FFFFFF',

  // Borders
  border: '#E5E2DB',
  borderFocused: '#2D5A27',

  // Semantic
  error: '#C53030',
  errorLight: '#FEE2E2',
  warning: '#B45309',
  warningLight: '#FEF3C7',
  success: '#0F766E',
  successLight: '#CCFBF1',
  info: '#1D4ED8',
  infoLight: '#DBEAFE',

  // AI accent (marks all AI-generated content distinctively)
  ai: '#A16207',
  aiLight: '#FEF9C3',
  aiSurface: '#FFFBEB',

  // CTA (primary action card)
  ctaSurface: 'rgba(45, 90, 39, 0.08)',
  ctaBorder: 'rgba(45, 90, 39, 0.20)',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  overlayDark: 'rgba(0, 0, 0, 0.7)',
  skeleton: '#E5E2DB',
  skeletonHighlight: '#F7F5F0',
  transparent: 'transparent',
  camera: '#111111',

  // ── Legacy aliases (keep until all components are migrated) ──
  accent: '#2D5A27',
  accentLight: '#E8F0E6',
  accentDark: '#1A3A16',
  textPrimary: '#1A1A1A',
  textMuted: '#767676',
  borderLight: '#F0F0EC',
  danger: '#C53030',
  dangerLight: '#FEE2E2',
  chipActive: '#2D5A27',
  chipInactive: '#F4F4F0',
} as const;

// ── Typography ────────────────────────────────────────────────────────────────

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const typography = {
  // Semantic styles (use these in new components)
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

  // ── Legacy aliases (keep until all components are migrated) ──
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
  sm: 6,
  md: 10,
  lg: 16,
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
  focusRingColor: '#2D5A27',
  focusRingWidth: 2,
  focusRingOffset: 2,
} as const;

// ── Layout Constants ──────────────────────────────────────────────────────────

export const layout = {
  screenPadding: 20,
  cardPadding: 16,
  /** @deprecated Use touch.minTarget instead */
  minTouchTarget: 48,
} as const;
