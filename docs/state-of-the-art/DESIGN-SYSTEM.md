# aha! Register Design System

> Last updated: 2026-03-17
> Status: ACTIVE

Centralized design tokens and visual standards for the aha! Register app.
All values live in `src/theme/index.ts`. No hardcoded colors, font sizes, or radii in component files.

---

## Color System (Material Design 3 Roles)

### Core Roles

| Role | Token | Hex | Contrast (on white) | Usage |
|------|-------|-----|---------------------|-------|
| Primary | `primary` | `#2D5A27` | 8.2:1 | Main actions, FAB, active tabs, CTA |
| Primary Container | `primaryContainer` | `rgba(45,90,39,0.12)` | — | Pill indicators, CTA backgrounds |
| Secondary | `secondary` | `#5C6B5A` | 4.6:1 | Tags, filters, less prominent UI |
| Secondary Container | `secondaryContainer` | `rgba(92,107,90,0.12)` | — | Filter chip backgrounds |
| Tertiary / AI | `tertiary` | `#5C6BC0` | 4.6:1 | AI-assisted actions, processing indicators |
| Tertiary Container | `tertiaryContainer` | `rgba(92,107,192,0.12)` | — | AI section backgrounds |

### Surface Hierarchy

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#FFFFFF` | Screen backgrounds |
| `surface` | `#F7F5F0` | Section backgrounds, stat cards |
| `surfaceContainer` | `#F0EDE7` | Card backgrounds |
| `surfaceContainerHigh` | `#E8E5DF` | Elevated cards, bottom sheets |

### Status Colors

| Token | Hex | Contrast | Usage |
|-------|-----|----------|-------|
| `statusSyncing` | `#1976D2` | 5.5:1 | Active sync indicator |
| `statusOffline` | `#757575` | 4.6:1 | Offline mode |
| `statusSuccess` | `#2E7D32` | 5.9:1 | Sync complete, hash verified |
| `statusWarning` | `#E65100` | 5.0:1 | Attention needed, pending sync |
| `statusError` | `#C53030` | 5.6:1 | Failures |

### AI Color System

AI-generated metadata is visually distinguished from human-entered data using the tertiary indigo color. This ensures users always know which fields were AI-suggested vs manually entered.

| Token | Value | Usage |
|-------|-------|-------|
| `ai` / `aiText` | `#5C6BC0` | AI badge text, "AI-suggested" labels |
| `aiLight` | `#E8EAF6` | AI badge backgrounds |
| `aiSurface` | `rgba(92,107,192,0.06)` | Background for AI-filled fields |
| `aiBorder` | `rgba(92,107,192,0.25)` | Border for AI-filled fields |
| `aiConfidenceHigh` | `#2E7D32` | 90-100% confidence |
| `aiConfidenceMedium` | `#E65100` | 40-89% confidence |
| `aiConfidenceLow` | `#C53030` | Below 40% confidence |

**Rule:** Indigo (`ai*`) = AI-generated, potentially unverified. Green (`primary`) = human action, verified. Never mix these roles.

### Color Rules

- **Green = tappable.** All interactive elements use `primary`.
- **Indigo = AI.** All AI-generated content uses `tertiary` / `ai*` tokens.
- **Gray = informational.** Labels, metadata use `textSecondary` / `textTertiary`.
- **Red = destructive.** Delete, error actions use `error`.
- **Amber = attention.** Pending sync, warnings use `statusWarning`.

---

## Typography

System fonts only. San Francisco on iOS, Roboto on Android. No custom font families.

### Size Scale

| Token | px | Usage |
|-------|----|-------|
| `xs` | 10 | Micro labels, counters, dimension sub-labels |
| `sm` | 12 | Field labels, badges, captions |
| `base` | 14 | Body text, form values, descriptions |
| `md` | 15 | Input text, secondary body |
| `lg` | 17 | Card titles, button labels |
| `xl` | 20 | Section headings, large buttons |
| `xxl` | 24 | Screen titles, hero numbers |
| `title` | 30 | Onboarding headlines |

### Weight Scale

| Token | Value | Usage |
|-------|-------|-------|
| `regular` | 400 | Body text |
| `medium` | 500 | Subtle emphasis |
| `semibold` | 600 | Labels, section titles, buttons |
| `bold` | 700 | Headings |
| `extrabold` | 800 | Hero elements |

---

## Spacing Scale

| Token | px | Usage |
|-------|----|-------|
| `xs` | 4 | Tight gaps, icon margins |
| `sm` | 8 | Chip gaps, small padding |
| `md` | 12 | List item padding, field gaps |
| `lg` | 16 | Card internal padding, section gaps |
| `xl` | 20 | Screen horizontal padding |
| `xxl` | 24 | Large section gaps |
| `xxxl` | 32 | Major section separators |

---

## Border Radius Scale

| Token | px | Usage |
|-------|----|-------|
| `sm` | 6 | Small badges, tags |
| `md` | 10 | Inputs, cards, buttons |
| `lg` | 16 | Larger cards, image containers |
| `xl` | 20 | Chips, pills, rounded buttons |
| `full` | 999 | Fully rounded elements — pills, dots, badges. **Canonical token.** |
| `pill` | 9999 | Legacy alias for `full`. Prefer `radii.full` in new code. |

---

## Layout Constants

| Token | px | Usage |
|-------|----|-------|
| `screenPadding` | 20 | Horizontal padding for all screens |
| `cardPadding` | 16 | Internal card/section padding |
| `minTouchTarget` | 48 | Minimum tap target (deprecated — use `touch.minTarget`) |

### Touch Target Rule

All interactive elements (buttons, chips, list rows, icons) must have a minimum touch target of **48dp** (`touch.minTarget`). Use `touch.hitSlop` (`{ top: 8, bottom: 8, left: 8, right: 8 }`) for small visual elements that need a larger tap area. `touch.minTargetSmall` (44dp) is available for constrained layouts.

---

## Icon Library

**lucide-react-native** with semantic re-exports from `src/theme/icons.ts`.

### Object Type Icons

| Concept | Lucide Icon | Export Name |
|---------|------------|-------------|
| Museum Object | `Landmark` | `MuseumObjectIcon` |
| Site | `MapPin` | `SiteIcon` |
| Incident | `ShieldAlert` | `IncidentIcon` |
| Specimen | `Microscope` | `SpecimenIcon` |
| Architectural Element | `Building2` | `ArchitecturalElementIcon` |
| Environmental Sample | `FlaskConical` | `EnvironmentalSampleIcon` |
| Conservation Record | `Wrench` | `ConservationRecordIcon` |

### Tab Icons

| Tab | Lucide Icon | Export Name | Active | Inactive |
|-----|------------|-------------|--------|----------|
| Home | `House` | `HomeTabIcon` | strokeWidth 2.5 | strokeWidth 1.5 |
| Capture | `Camera` | `CaptureTabIcon` | strokeWidth 2.5 | strokeWidth 1.5 |
| Collection | `Archive` | `CollectionTabIcon` | strokeWidth 2.5 | strokeWidth 1.5 |
| Settings | `Settings` | `SettingsTabIcon` | strokeWidth 2.5 | strokeWidth 1.5 |

### Tab Bar Spec (Material Design 3)

| Token | Value | Description |
|-------|-------|-------------|
| `tabBar.height` | 64 | Bar height (icon + label + padding) |
| `tabBar.iconSize` | 24 | Icon canvas size |
| `tabBar.labelSize` | 11 | Label font size (M3 spec) |
| `tabBar.activeColor` | `#2D5A27` | Primary green for active tab |
| `tabBar.inactiveColor` | `#767676` | Muted gray for inactive tabs |
| `tabBar.backgroundColor` | `#F7F5F0` | Surface color |
| `tabBar.indicatorColor` | `rgba(45,90,39,0.12)` | Pill indicator (primary @ 12%) |
| `tabBar.indicatorWidth` | 64 | Pill width |
| `tabBar.indicatorHeight` | 32 | Pill height |
| `tabBar.indicatorRadius` | 16 | Pill corner radius |

Active state: pill-shaped indicator behind icon, heavier stroke weight, primary color.
Inactive state: no indicator, lighter stroke weight, muted color.
Labels always visible.

### Action Icons

| Action | Lucide Icon | Export Name |
|--------|------------|-------------|
| Add | `Plus` | `AddIcon` |
| Edit | `Pencil` | `EditIcon` |
| Delete | `Trash2` | `DeleteIcon` |
| Search | `Search` | `SearchIcon` |
| Share | `Share2` | `ShareIcon` |
| Export | `FileDown` | `ExportIcon` |
| Add Photo | `ImagePlus` | `AddPhotoIcon` |
| Check | `Check` | `CheckIcon` |
| Success | `CheckCircle2` | `SuccessIcon` |
| Copy | `Copy` | `CopyIcon` |

### Navigation Icons

| Direction | Lucide Icon | Export Name |
|-----------|------------|-------------|
| Back | `ChevronLeft` | `BackIcon` |
| Forward | `ChevronRight` | `ForwardIcon` |
| Expand | `ChevronDown` | `ExpandIcon` |
| Collapse | `ChevronUp` | `CollapseIcon` |
| Close | `X` | `CloseIcon` |

### Camera Icons

| Function | Lucide Icon | Export Name |
|----------|------------|-------------|
| Flash | `Zap` | `FlashIcon` |
| Flip Camera | `SwitchCamera` | `FlipCameraIcon` |
| Shutter | `Circle` | `ShutterIcon` |
| Aspect Ratio | `Maximize` | `AspectRatioIcon` |

### Status Icons

| Status | Lucide Icon | Export Name |
|--------|------------|-------------|
| Sync | `RefreshCw` | `SyncIcon` |
| Offline | `WifiOff` | `OfflineIcon` |
| Warning | `AlertTriangle` | `WarningIcon` |
| Error | `XCircle` | `ErrorIcon` |
| Info | `Info` | `InfoIcon` |
| Sign Out | `LogOut` | `SignOutIcon` |
| User | `User` | `UserIcon` |
| View | `Eye` | `ViewIcon` |
| Primary | `Star` | `PrimaryIcon` |

To change an icon app-wide, update the mapping in `src/theme/icons.ts`.

---

## Component Patterns

### Section Headers
Collapsible sections with title + filled-count badge + chevron. Used in type-specific forms.

### Form Fields
`FieldInput` component: labeled TextInput with `borderLight` background, `border` stroke, `md` radius.

### Chips
Horizontal row of selectable options. Active: `chipActive` bg + white text. Inactive: `chipInactive` bg + `textSecondary` text + `border` stroke.

### Filter Chips (Bottom Sheet)
Used in `FilterSheet` for object type and sort selections.

| State | Background | Text | Weight |
|-------|-----------|------|--------|
| Inactive | `secondaryContainer` | `secondary` | 400 |
| Active | `primaryContainer` | `primary` | 600 |

Active filter chips (shown above the list) use `primaryContainer` bg + `primary` text + CloseIcon to remove.

### Bottom Sheets
Via `@gorhom/bottom-sheet`. Background: `colors.surface`. Handle indicator: `colors.border`, 36dp wide. Snap points vary by content (e.g., FilterSheet: 40%, 80%). Backdrop: 40% opacity overlay.

### Badges
Small rounded indicators. Use `accent` bg + white text for counts, `accentLight` bg + accent text for labels.

### Action Bars
Fixed bottom bars for batch actions. `surface` background, `accent` primary buttons, `danger` destructive buttons.

### Cards
`surface` background, `borderLight` stroke, `md` radius, `cardPadding` internal padding.

### AI Field Accent Pattern

AI-generated fields use a gold accent to signal that the value was produced by Gemini and may need review.

**Tokens:**
| Token | Value | Usage |
|-------|-------|-------|
| `colors.ai` | `#A16207` (amber-700) | AI badge text, confidence percentage |
| `colors.aiLight` | `#FEF9C3` (amber-100) | AI badge background, highlighted field |
| `colors.aiSurface` | `#FFFBEB` (amber-50) | AI section card background |

**Implementation:**
1. Wrap the field in `<AIField label="..." confidence={n}>` — shows a gold `Badge variant="ai" label="AI"` + confidence `%` when `confidence > 0`.
2. Render a `<ConfidenceBar confidence={n} label="..." />` below the field for numerical indication.
3. When `confidence === 0` (manual or skipped AI), the wrapper renders nothing extra — the field looks normal.

**Usage sites:** `ReviewCardScreen` — all metadata fields prefilled from `AIAnalysisResult`.

**Rule:** Gold = AI-generated, potentially unverified. Never use `colors.ai` for non-AI content.

---

## Accessibility (a11y)

Standard: **WCAG 2.1 AA** / **EN 301 549** (EU Accessibility Act).

### Contrast Ratios (verified 2026-03-17)

| Pairing | Ratio | Passes |
|---------|-------|--------|
| `text` (#1A1A1A) on `background` (#FFFFFF) | 16.7:1 | AA |
| `textSecondary` (#5C5C5C) on `background` | 6.7:1 | AA |
| `textTertiary` (#767676) on `background` | 4.62:1 | AA |
| `textMuted` (#767676) on `background` | 4.62:1 | AA |
| `white` on `accent` (#2D5A27) | 8.1:1 | AA |
| `white` on `danger` (#C53030) | 5.5:1 | AA |

### Token: `a11y` (from `src/theme/index.ts`)

| Token | Value | Purpose |
|-------|-------|---------|
| `a11y.minContrastNormal` | 4.5 | WCAG AA for normal text |
| `a11y.minContrastLarge` | 3.0 | WCAG AA for large text (>=18px or >=14px bold) |
| `a11y.focusRingColor` | `#2D5A27` | Keyboard focus indicator |
| `a11y.focusRingWidth` | 2 | Focus ring border width |
| `a11y.focusRingOffset` | 2 | Focus ring offset from element |

### Touch Targets

- Minimum: **48dp** (`touch.minTarget`)
- Small (constrained layouts): **44dp** (`touch.minTargetSmall`)
- Use `touch.hitSlop` (`{ top: 8, bottom: 8, left: 8, right: 8 }`) for small visual elements

### Rules

1. Every `Pressable` acting as a button must have `accessibilityRole="button"` and an `accessibilityLabel`.
2. Screen titles must have `accessibilityRole="header"`.
3. Animations must check `AccessibilityInfo.isReduceMotionEnabled()` and skip/disable when true.
4. Do not use `colors.white` for text on light backgrounds — use `colors.text`, `colors.textSecondary`, or `colors.textTertiary`.

### Audit Trail

| Date | Scope | Report |
|------|-------|--------|
| 2026-03-17 | Full app (all screens) | `docs/audits/A11Y-AUDIT-2026-03-17.md` |

---

## File Structure

```
src/theme/
  index.ts    — colors, typography, spacing, radii, layout
  icons.ts    — semantic icon re-exports from lucide-react-native
```

All components import from `../theme` or `../../theme` (relative paths).
