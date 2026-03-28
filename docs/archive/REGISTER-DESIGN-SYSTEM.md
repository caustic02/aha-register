# aha! Register Design System

Centralized design tokens and visual standards for the aha! Register app.
All values live in `src/theme/index.ts`. No hardcoded colors, font sizes, or radii in component files.

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `accent` | `#2D5A27` | Forest green. Brand color, tappable elements, primary buttons, links, active chips. |
| `accentLight` | `#E8F0E6` | Green tint. Badges, highlights, selected-row backgrounds. |
| `accentDark` | `#1A3A16` | Pressed state for accent elements. |
| `background` | `#FAFAF8` | Warm off-white. All screen backgrounds. |
| `surface` | `#FFFFFF` | Cards, inputs, modals, bottom sheets. |
| `textPrimary` | `#1A1A1A` | Headings, primary content, body text. |
| `textSecondary` | `#6B6B6B` | Descriptions, secondary labels, field labels. |
| `textMuted` | `#999999` | Placeholders, metadata, timestamps, disabled text. |
| `border` | `#E8E8E4` | Input borders, dividers, section separators. |
| `borderLight` | `#F0F0EC` | Subtle card borders, input backgrounds, faint tints. |
| `danger` | `#C53030` | Delete actions, errors, destructive buttons. |
| `dangerLight` | `#FEE2E2` | Danger badge backgrounds, error highlights. |
| `warning` | `#D4A017` | Alerts, flash-on indicator, attention badges. |
| `warningLight` | `#FFF8E6` | Warning backgrounds. |
| `camera` | `#111111` | Camera screen background. |
| `chipActive` | `#2D5A27` | Selected filter chip background (= accent). |
| `chipInactive` | `#F4F4F0` | Unselected chip background. |
| `white` | `#FFFFFF` | Text on accent/dark backgrounds, switch thumbs. |
| `black` | `#000000` | Camera viewfinder background. |
| `overlay` | `rgba(0,0,0,0.5)` | Modal overlays, bottom sheet scrims. |
| `overlayLight` | `rgba(0,0,0,0.3)` | Lighter overlays (camera controls). |
| `overlayDark` | `rgba(0,0,0,0.7)` | Dark overlays (fullscreen gallery). |

### Color Rules

- **Green = tappable.** All interactive elements (buttons, links, chips, switches) use `accent`.
- **Gray = informational.** Labels, metadata, and disabled states use `textSecondary` or `textMuted`.
- **Red = destructive.** Delete, error, and warning-destructive actions use `danger`.
- **Gold = attention.** Non-destructive alerts and indicators use `warning`.

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
| `lg` | 14 | Larger cards, image containers |
| `xl` | 20 | Chips, pills, rounded buttons |
| `pill` | 9999 | Fully rounded elements (FABs, dots) |

---

## Layout Constants

| Token | px | Usage |
|-------|----|-------|
| `screenPadding` | 20 | Horizontal padding for all screens |
| `cardPadding` | 16 | Internal card/section padding |
| `minTouchTarget` | 44 | Minimum tap target (Apple HIG) |

### Touch Target Rule

All interactive elements (buttons, chips, list rows, icons) must have a minimum touch target of **44pt**. Use `hitSlop` for small visual elements that need a larger tap area.

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

| Tab | Lucide Icon | Export Name |
|-----|------------|-------------|
| Objects | `Archive` | `ObjectsTabIcon` |
| Collections | `FolderOpen` | `CollectionsTabIcon` |
| Capture | `Camera` | `CaptureTabIcon` |
| Settings | `Settings` | `SettingsTabIcon` |

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

### Badges
Small rounded indicators. Use `accent` bg + white text for counts, `accentLight` bg + accent text for labels.

### Action Bars
Fixed bottom bars for batch actions. `surface` background, `accent` primary buttons, `danger` destructive buttons.

### Cards
`surface` background, `borderLight` stroke, `md` radius, `cardPadding` internal padding.

---

## PDF Export Strategy

PDF reports are generated via **HTML-to-PDF using expo-print**:
1. Build an HTML string with inline CSS
2. Call `Print.printToFileAsync({ html })`
3. Share via `expo-sharing`

This approach avoids programmatic PDF generation libraries. The HTML template uses the same color palette and typography scale defined here.

---

## File Structure

```
src/theme/
  index.ts    — colors, typography, spacing, radii, layout
  icons.ts    — semantic icon re-exports from lucide-react-native
```

All components import from `../theme` or `../../theme` (relative paths).
