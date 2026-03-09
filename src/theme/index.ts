/**
 * aha! Register — Centralized Design System
 *
 * All visual tokens live here. Components import from '@theme' or '../theme'.
 * No hex colors, magic-number font sizes, or ad-hoc radii in component files.
 */

// ── Colors ────────────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  accent: '#2D5A27',
  accentLight: '#E8F0E6',
  accentDark: '#1A3A16',

  // Backgrounds
  background: '#FAFAF8',
  surface: '#FFFFFF',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#999999',

  // Borders
  border: '#E8E8E4',
  borderLight: '#F0F0EC',

  // Semantic
  danger: '#C53030',
  dangerLight: '#FEE2E2',
  warning: '#D4A017',
  warningLight: '#FFF8E6',

  // Special
  camera: '#111111',
  chipActive: '#2D5A27',
  chipInactive: '#F4F4F0',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.3)',
  overlayDark: 'rgba(0,0,0,0.7)',
} as const;

// ── Typography ────────────────────────────────────────────────────────────────

export const typography = {
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
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

// ── Spacing ───────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ── Border Radii ──────────────────────────────────────────────────────────────

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 9999,
} as const;

// ── Layout Constants ──────────────────────────────────────────────────────────

export const layout = {
  screenPadding: 20,
  cardPadding: 16,
  minTouchTarget: 44,
} as const;
