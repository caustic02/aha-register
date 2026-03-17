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
  // ── M3 Primary (main actions, FAB, active tabs) ────────────────────────────
  primary: '#2D5A27',             // 8.2:1 on white
  primaryDark: '#1E3D1A',
  primaryLight: '#E8F0E7',
  primarySurface: '#F2F7F1',
  primaryContainer: 'rgba(45, 90, 39, 0.12)', // pill indicators, CTA backgrounds

  // ── M3 Secondary (tags, filters, less prominent UI) ────────────────────────
  secondary: '#5C6B5A',          // muted green-gray, 4.6:1 on white
  secondaryContainer: 'rgba(92, 107, 90, 0.12)',

  // ── M3 Tertiary / AI (AI-assisted actions, distinct from primary) ──────────
  tertiary: '#5C6BC0',           // deep indigo, 4.6:1 on white
  tertiaryContainer: 'rgba(92, 107, 192, 0.12)',

  // ── Text hierarchy (on white/off-white backgrounds) ────────────────────────
  text: '#1A1A1A',               // 16.1:1 on white
  textSecondary: '#5C5C5C',      // 5.9:1 on white
  textTertiary: '#767676',       // 4.5:1 on white (minimum AA)
  textInverse: '#FFFFFF',

  // ── Surfaces (M3 hierarchy) ────────────────────────────────────────────────
  background: '#FFFFFF',
  surface: '#F7F5F0',
  surfaceContainer: '#F0EDE7',        // slightly darker, card backgrounds
  surfaceContainerHigh: '#E8E5DF',    // elevated cards, bottom sheets
  surfaceElevated: '#FFFFFF',

  // ── Borders ────────────────────────────────────────────────────────────────
  border: '#E5E2DB',
  borderFocused: '#2D5A27',

  // ── Semantic ───────────────────────────────────────────────────────────────
  error: '#C53030',              // 5.6:1 on white
  errorLight: '#FEE2E2',
  warning: '#B45309',            // 4.7:1 on white
  warningLight: '#FEF3C7',
  success: '#0F766E',            // 5.1:1 on white
  successLight: '#CCFBF1',
  info: '#1D4ED8',               // 5.3:1 on white
  infoLight: '#DBEAFE',

  // ── Status (sync, connectivity) ────────────────────────────────────────────
  statusSyncing: '#1976D2',      // blue, 5.5:1 on white
  statusOffline: '#757575',      // gray, 4.6:1 on white
  statusSuccess: '#2E7D32',      // green, 5.9:1 on white
  statusWarning: '#E65100',      // deep amber, 5.0:1 on white
  statusError: '#C53030',        // same as error

  // ── AI accent (marks all AI-generated content distinctively) ────────────────
  // Uses tertiary indigo to visually distinguish AI from human data
  ai: '#5C6BC0',                 // = tertiary, 4.6:1 on white
  aiLight: '#E8EAF6',            // indigo tint
  aiSurface: 'rgba(92, 107, 192, 0.06)',   // 6% opacity, field backgrounds
  aiBorder: 'rgba(92, 107, 192, 0.25)',    // 25% opacity, field borders
  aiText: '#5C6BC0',             // full strength for labels

  // ── AI Confidence scale ────────────────────────────────────────────────────
  aiConfidenceHigh: '#2E7D32',   // green, 5.9:1 on white
  aiConfidenceMedium: '#E65100', // deep amber, 5.0:1 on white
  aiConfidenceLow: '#C53030',    // red, 5.6:1 on white

  // ── CTA (primary action card) ──────────────────────────────────────────────
  ctaSurface: 'rgba(45, 90, 39, 0.08)',  // = primaryContainer lighter
  ctaBorder: 'rgba(45, 90, 39, 0.20)',

  // ── Utility ────────────────────────────────────────────────────────────────
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

// ── Tab Bar (Material Design 3 spec) ─────────────────────────────────────────

export const tabBar = {
  height: 64,
  iconSize: 24,
  activeStrokeWidth: 2.5,
  inactiveStrokeWidth: 1.5,
  labelSize: 11,
  indicatorWidth: 64,
  indicatorHeight: 32,
  indicatorRadius: 16,
  activeColor: '#2D5A27',        // colors.primary
  inactiveColor: '#767676',      // colors.textMuted
  backgroundColor: '#F7F5F0',    // colors.surface
  indicatorColor: 'rgba(45, 90, 39, 0.12)', // primary @ 12% opacity
  borderColor: '#E5E2DB',        // colors.border
} as const;

// ── Layout Constants ──────────────────────────────────────────────────────────

export const layout = {
  screenPadding: 20,
  cardPadding: 16,
  /** @deprecated Use touch.minTarget instead */
  minTouchTarget: 48,
} as const;
