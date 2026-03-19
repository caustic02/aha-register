# aha! Register Design System

> Last updated: 2026-03-18
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

### Form Section Icons

| Section | Lucide Icon | Export Name |
|---------|------------|-------------|
| Identification | `Tag` | `TagIcon` |
| Physical description | `Ruler` | `RulerIcon` |
| Classification | `Layers` | `LayersIcon` |
| Condition | `ShieldCheck` | `ConditionIcon` |

### Document Icons

| Concept | Lucide Icon | Export Name |
|---------|------------|-------------|
| Document scan | `FileText` | `DocumentScanIcon` |
| Scan action | `ScanLine` | `ScanIcon` |

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

### VocabularyPicker

`src/components/VocabularyPicker.tsx` — search-and-select for Getty AAT controlled vocabulary terms.

**Tokens used:**
| Element | Token |
|---------|-------|
| Selected chips | `primaryLight` bg, `primary` text, `radii.sm` |
| Search input | `surface` bg, `border` stroke, `radii.md`, `body` text |
| Dropdown | `surfaceContainer` bg, `border` stroke, `radii.md` |
| Dropdown item label | `body`, `colors.text` |
| Dropdown parent text | `caption`, `colors.textTertiary` |
| AAT URI badge | `surface` bg, `mono` font, 10px, `textTertiary` |
| Custom term option | `bodySmall`, `primary` text |
| Quick-select chips | `surface` bg, `border` stroke; selected: `primaryLight` bg, `primary` border |

**Used in:** ReviewCardScreen (Object Type, Medium, Technique, Style/Period fields).

### SkeletonLoader

`src/components/SkeletonLoader.tsx` — pulse-animated loading placeholders for list and card states.

**Implementation:**
- Pulse driven by `Animated.Value` looping between opacity 0.4 → 1.0 via `Animated.loop` + `Animated.sequence` (Animated API, no third-party dependency)
- `accessibilityElementsHidden={true}` + `importantForAccessibility="no-hide-descendants"` on the root `Animated.View` — entire skeleton is invisible to screen readers
- Two variants:
  - `SkeletonCard` — renders a thumbnail placeholder + two text-line placeholders (title + subtitle). Used in grid/card contexts.
  - `SkeletonList` — renders a configurable number of `SkeletonCard`s stacked vertically via a `count` prop (default: 5). Used in list contexts while data loads.

**Usage:** Replace `ActivityIndicator` spinners for local DB loads. Do not use for network-progress indication.

### ExportStepperModal

`src/components/ExportStepperModal.tsx` — 3-step bottom-sheet modal for exporting objects.

**Accepts `ExportSource` union:**
```ts
type ExportSource =
  | { mode: 'object'; data: ExportableObject }
  | { mode: 'batch'; objectIds: string[]; title: string }
  | { mode: 'collection'; collectionId: string; collectionName: string }
```

**Step 1 — Format selection:**
- Three `FormatCard` options: PDF (`ExportIcon`), JSON (`DocumentScanIcon`), CSV (`ListViewIcon`) — lucide icons, `colors.primary`, 22dp
- JSON and CSV are disabled (`accessibilityState={{ disabled: true }}`) when source mode is not `'object'` (batch/collection only support PDF)
- Selecting a format advances to step 2

**Step 2 — Scope review:**
- Queries `privacy_tier` and `legal_hold` from SQLite for all objects in scope
- Displays: format badge, object count, privacy tier breakdown (public/confidential/anonymous counts)
- **Privacy tier warning:** shown when `anonymousCount > 0` — amber warning box noting location data will be stripped
- **Legal hold warning:** shown when `legalHoldCount > 0` — red warning box requiring authorized use acknowledgement
- Back button returns to step 1; "Export as…" button proceeds to step 3

**Step 3 — Progress / Success / Error:**
- Loading: `ActivityIndicator` with `accessibilityLabel` for screen readers
- Success: `CheckIcon` in green circle + "Export Complete" + Done button; calls `onExportComplete` callback
- Error: error message + Cancel + Retry buttons

**Export routing:**
| Source mode | Format | Service called |
|-------------|--------|---------------|
| `object` | PDF | `exportAsPDF` → `shareExport` (expo-sharing) |
| `object` | JSON | `exportAsJSON` → `shareExport` |
| `object` | CSV | `exportAsCSV` → `shareExport` |
| `batch` | PDF | `exportBatchToPDF` → `sharePDF` |
| `collection` | PDF | `exportCollectionToPDF` → `sharePDF` |

**Entry points:** `ObjectDetailScreen`, `ObjectListScreen` (batch select mode), `CollectionDetailScreen` (collection export + batch select mode).

### Capture Mode Toggle

Segmented pill control above the camera shutter button, toggling Quick/Full capture modes.

| Element | Token |
|---------|-------|
| Pill container | `rgba(0,0,0,0.55)` bg, `radii.full`, 2dp padding |
| Active segment | `colors.primary` bg, `radii.full` |
| Active text/icon | `colors.white`, `typography.caption`, `weight.semibold` |
| Inactive text/icon | `colors.textTertiary` |
| Icons | `QuickModeIcon` (Zap), `FullModeIcon` (ClipboardList) — 14dp |

Persistence: `AsyncStorage` key `capture.mode`. Default: `'quick'`.

### Thumbnail Strip

Horizontal `ScrollView` showing captured photos (camera screen: session thumbnails; home screen: inbox thumbnails).

| Element | Token |
|---------|-------|
| Thumbnail | 52×52, `radii.sm`, 1dp border |
| Camera border | `colors.overlayLight` |
| Inbox border | `colors.border` |
| Amber dot (inbox) | 8dp circle, `colors.statusWarning`, top-right offset -2dp |
| Count badge | `rgba(0,0,0,0.55)` bg, white text, `radii.full` |

### Review Banner

Amber banner on ObjectDetailScreen for `needs_review`/`in_review` objects.

| Element | Token |
|---------|-------|
| Background | `colors.warningLight` |
| Border | 1dp, `colors.warning` |
| Radius | `radii.md` |
| Icon | `WarningIcon`, `colors.statusWarning` |
| Title | `typography.bodyMedium`, `colors.statusWarning` |
| Description | `typography.bodySmall`, `colors.textSecondary` |
| CTA | `Button` variant `primary`, full width |

### IsolationCompareScreen

Full-screen modal for background removal comparison. **Justified exception** to the light theme: uses a near-black background (`rgba(0,0,0,0.95)`) for clear image viewing against both original and transparent-background derivatives.

| Element | Token |
|---------|-------|
| Background | `rgba(0,0,0,0.95)` (dark exception) |
| Header text | `colors.white`, `typography.h4` |
| Processing overlay | `rgba(0,0,0,0.5)`, animated pulse 0.3↔0.6 opacity |
| Processing label | `colors.overlay` bg, `colors.white` text, `radii.full` |
| Segmented toggle (inactive) | `colors.overlay` bg, `colors.textTertiary` text |
| Segmented toggle (active) | `colors.white` bg, `colors.text` text |
| Crossfade | `Animated.timing`, 200ms (0ms when `reduceMotion`) |
| Isolate icon | `IsolateIcon` (Scissors from lucide), 22dp |

### Document Card (C2)

Displayed in the Documents section on ObjectDetailScreen. One card per raw scan.

| Element | Token |
|---------|-------|
| Card row | `minHeight: touch.minTarget`, `gap: spacing.md`, `borderBottomWidth: hairline` |
| Thumbnail | 56×56, `radii.sm`, `colors.surface` bg |
| OCR text preview | `typography.bodySmall`, `colors.text`, 2 lines max |
| No-text fallback | `typography.bodySmall`, `colors.textTertiary`, italic |
| OCR confidence | `AIFieldBadge` (reuses confidence coloring) |
| Source badge | `Badge variant="neutral" size="sm"` — "On-device" or "Cloud" |
| Chevron | `ForwardIcon`, 16dp, `colors.textTertiary` |

### Scan Document Button (C2)

Secondary-style action button in the Documents section.

| Element | Token |
|---------|-------|
| Border | 1dp, `colors.primary` |
| Radius | `radii.md` |
| Icon | `ScanIcon` (ScanLine), `colors.primary` |
| Label | `typography.bodyMedium`, `colors.primary` |
| Height | `touch.minTarget` (48dp) |
| Disabled state | `opacity: 0.5` |
| Loading state | `ActivityIndicator` replaces icon |

### Camera Document Scan Button (C5)

Replaces the spacer in the camera bottom controls row (right side of shutter).

| Element | Token |
|---------|-------|
| Size | 52×52 (matches library button) |
| Background | `colors.overlay` |
| Border | 1dp, `colors.overlayLight` |
| Radius | `radii.lg` |
| Icon | `ScanIcon` (ScanLine), 22dp, `colors.white` |

Layout: Library (left) | Shutter (center) | Document Scan (right). Visible in both Quick and Full modes.

### Bottom Sheets
Via `@gorhom/bottom-sheet`. Background: `colors.surface`. Handle indicator: `colors.border`, 36dp wide. Snap points vary by content (e.g., FilterSheet: 40%, 80%). Backdrop: 40% opacity overlay.

### Badges
Small rounded indicators. Use `accent` bg + white text for counts, `accentLight` bg + accent text for labels.

### Action Bars
Fixed bottom bars for batch actions. `surface` background, `accent` primary buttons, `danger` destructive buttons.

### Cards
`surface` background, `borderLight` stroke, `md` radius, `cardPadding` internal padding.

### FormSection

`src/components/FormSection.tsx` — collapsible section wrapper for form fields.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Section heading text |
| `icon` | `React.ComponentType<{ size, color }>` | Lucide icon rendered left of title |
| `expanded` | `boolean` | Controlled open/close state |
| `onToggle` | `() => void` | Called when header is pressed |
| `aiFieldCount` | `number` (optional) | Shows an AI count badge on the header |
| `children` | `ReactNode` | Form fields rendered inside the section |

**Behaviour:**
- Header `Pressable`: `accessibilityRole="button"`, `accessibilityState={{ expanded }}`.
- Chevron rotates 0° → 180° via `Animated.timing` (200ms, native driver).
- Content expands/collapses via `LayoutAnimation.configureNext(easeInEaseOut)`.
- Both animations are skipped when `AccessibilityInfo.isReduceMotionEnabled()` returns true.
- `rotateAnim` initialised with `useState(() => new Animated.Value(...))` (not `useRef().current`).
- LayoutAnimation on Android requires `UIManager.setLayoutAnimationEnabledExperimental?.(true)` — called at module level.

**Tokens used:**
| Element | Token |
|---------|-------|
| Header min-height | `touch.minTarget` (48dp) |
| Title | `typography.size.lg`, `weight.semibold`, `colors.text` |
| Icon | `colors.textSecondary`, 18dp |
| Chevron | `colors.textTertiary`, 20dp |
| AI count badge | `colors.aiLight` bg, `colors.ai` text, `radii.full` |
| Bottom border | `colors.border`, 1dp |
| Content padding | `spacing.lg` horizontal, `spacing.lg` bottom |

**Used in:** `ReviewCardScreen` (4 sections: Identification, Physical, Classification, Condition).

### AIFieldBadge

`src/components/AIFieldBadge.tsx` — inline confidence pill shown next to field labels for AI-prefilled values.

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `visible` | `boolean` | When false, renders null |
| `confidence` | `number` (optional) | 0–100 integer; shown as `n%` when > 0 |

**Confidence coloring:**
| Range | Token |
|-------|-------|
| ≥ 90% | `colors.aiConfidenceHigh` (green `#2E7D32`) |
| 40–89% | `colors.aiConfidenceMedium` (amber `#E65100`) |
| < 40% | `colors.aiConfidenceLow` (red `#C53030`) |

**Tokens used:**
| Element | Token |
|---------|-------|
| Pill background | `colors.aiLight` |
| Pill radius | `radii.full` |
| "AI" label | `typography.size.xs`, `weight.semibold`, `colors.ai` |
| Confidence % | `typography.size.xs`, `weight.medium`, confidence color |

**Accessibility:** `accessibilityRole="text"`, `accessibilityLabel={t('aiBadge.aiSuggested')}`.

**Used in:** `ReviewCardScreen` — next to every AI-prefilled field label.

### AI Field Accent Pattern

AI-generated fields use an indigo accent to signal that the value was produced by Gemini and may need review.

**Tokens:**
| Token | Value | Usage |
|-------|-------|-------|
| `colors.ai` | `#5C6BC0` (indigo) | AI badge text, "AI-suggested" labels |
| `colors.aiLight` | `#E8EAF6` (indigo-50) | AI badge background |
| `colors.aiSurface` | `rgba(92,107,192,0.06)` | Background for AI-filled fields |
| `colors.aiBorder` | `rgba(92,107,192,0.25)` | Border for AI-filled fields |
| `colors.aiConfidenceHigh` | `#2E7D32` | 90–100% confidence |
| `colors.aiConfidenceMedium` | `#E65100` | 40–89% confidence |
| `colors.aiConfidenceLow` | `#C53030` | Below 40% confidence |

**Implementation (B4 canonical):**
1. Render `<AIFieldBadge visible={!!confidence} confidence={confidence} />` inline next to the field label.
2. The `AIField` internal wrapper in `ReviewCardScreen` handles the `aiSurface`/`aiBorder` field highlight.
3. When `confidence === 0` (manual or skipped AI), `visible={false}` renders nothing — the field looks normal.
4. The `FormSection` `aiFieldCount` prop aggregates the count of visible badges for the section header.

**Usage sites:** `ReviewCardScreen` — all metadata fields prefilled from `AIAnalysisResult`.

**Rule:** Indigo = AI-generated, potentially unverified. Never use `colors.ai` for non-AI content.

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

## Display Label Utility

`src/utils/displayLabels.ts` — maps internal enum keys to human-readable i18n labels.

```ts
import { getDisplayLabel } from '../utils/displayLabels';

getDisplayLabel('gps_hardware', 'coordinate_source'); // → "GPS (Device)"
getDisplayLabel('draft', 'status');                    // → "Draft"
getDisplayLabel('museum_object', 'object_type');       // → "Museum Object"
getDisplayLabel('public', 'privacy_tier');             // → "Public"
getDisplayLabel('primary', 'evidence_class');          // → "Primary"
```

**Categories and i18n prefixes:**

| Category | i18n prefix | Example keys |
|----------|------------|-------------|
| `object_type` | `object_types.*` | `museum_object`, `painting`, `other` |
| `coordinate_source` | `labels.coordinate_source.*` | `gps_hardware`, `gps_exif`, `manual` |
| `status` | `labels.status.*` | `draft`, `active`, `archived`, `under_review` |
| `privacy_tier` | `privacy.*` | `public`, `confidential`, `anonymous` |
| `evidence_class` | `evidence.*` | `primary`, `corroborative`, `contextual` |

**Fallback:** If no i18n match exists, the raw key is title-cased (`gps_hardware` → `Gps Hardware`).

**Rule:** Never display raw database enum values to users. Always pass through `getDisplayLabel()` or `t()`.

---

## File Structure

```
src/theme/
  index.ts    — colors, typography, spacing, radii, layout
  icons.ts    — semantic icon re-exports from lucide-react-native
src/utils/
  displayLabels.ts — enum-to-label utility (see above)
```

All components import from `../theme` or `../../theme` (relative paths).
