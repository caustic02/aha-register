# Decision: Design System Architecture

> Date: 2026-03-17
> Status: LOCKED
> Author: Michael Tauschinger-Dempsey + Claude Chat
> Scope: aha! Register mobile app

## Decision

Build a custom, zero-dependency design system with 12 atomic components, governed by a single theme file. No external UI library. Every screen is an assembly of these components. No screen defines its own visual values.

## Context

Register's first builds were functional but visually disjointed. Components used inconsistent spacing, ad-hoc colors, and varying touch target sizes. The root cause: no enforced design system layer between the theme tokens and the screens.

The April Berlin demo requires 12 screens that all look like they came from the same product. Building screens without a component library means each screen is a one-off that breaks in unique ways. The SVG logo incident (where a hardcoded SVG width pushed the entire layout off-screen) is the canonical example: without a constrained component API, anything can break anything.

## Alternatives Considered

### 1. React Native Paper (Material Design)
Rejected. Material Design looks like Google. Register serves EU museum institutions. They need to see a purpose-built professional tool, not a Google app with a green theme.

### 2. Gluestack / NativeBase
Rejected. Heavy dependency. Brings a massive component tree we'd use 10% of. Copy-paste model still requires understanding their token system. Styling overrides fight the library. And it looks like every other startup app built with Gluestack.

### 3. NativeWind (Tailwind for RN)
Rejected. Adds a build step (Tailwind compiler). Class-based styling doesn't compose well with React Native's StyleSheet system. And the real issue: it doesn't prevent inconsistency. You can still write `className="p-3"` in one place and `className="p-4"` in another.

### 4. Custom component library (CHOSEN)
12 components in `src/components/ui/`. Each is a single file. Each imports from `src/theme/index.ts`. Total control. Zero vendor lock-in. Every value traced to one source. If a component doesn't exist, it gets built before the screen that needs it.

## Design Decisions

### Colors
- Forest green primary (`#2D5A27`) from existing brand
- Warm cream surface (`#F7F5F0`) from existing screenshots
- Dedicated AI accent color (warm gold `#A16207`) that marks all AI-generated content. When Gemini fills a field, the user sees a distinct visual signal. This is not decoration; it is trust infrastructure
- Full semantic color set (error, warning, success, info) with light/dark pairs for backgrounds

### Typography
- System fonts only. No custom font loading. Native feel, zero bundle cost
- 5 scale steps: h1-h4 headings, body, bodySmall, label (uppercase), mono (technical), caption
- 16px minimum body text (prevents iOS auto-zoom on input focus)
- Uppercase labels with letter-spacing for section headers (matches existing settings screen pattern)

### Touch Targets
- 48dp minimum on every interactive element. Non-negotiable
- When visual size is smaller (e.g., a 40dp chip), hitSlop extends the touch area to 48dp
- This meets EN 301 549 (EU Accessibility Act) and WCAG 2.2 requirements

### Spacing
- 8-point grid. Every margin, padding, and gap is a multiple of 4 or 8
- Named scale: xs(4), sm(8), md(12), lg(16), xl(24), 2xl(32), 3xl(48), 4xl(64)

### No Dark Mode (for now)
- Light theme confirmed for field use (outdoor, mixed lighting)
- Token structure supports adding dark mode later via theme switching
- Not in scope for April demo

### No Animations (except ConfidenceBar)
- Press feedback is opacity change only (0.85). No spring, no bounce, no scale
- ConfidenceBar animates its fill on appearance (the "wow" moment of AI results)
- All animations respect `prefers-reduced-motion`

## Component Inventory

| # | Component | Purpose | Key Props |
|---|---|---|---|
| 1 | Button | Primary CTA, secondary, ghost | label, variant, size, loading |
| 2 | TextInput | Form input with label + error | label, value, error |
| 3 | Card | Content container | variant (flat/elevated) |
| 4 | SectionHeader | Uppercase section labels | title, action |
| 5 | Badge | Status pills, counts | label, variant (semantic) |
| 6 | MetadataRow | Label:value display | label, value, aiGenerated |
| 7 | ChipGroup | Select/filter chips | options, selected, onSelect |
| 8 | IconButton | Icon-only actions | icon, accessibilityLabel |
| 9 | ConfidenceBar | AI confidence display | confidence (0-100) |
| 10 | EmptyState | No-data screens | icon, title, message, action |
| 11 | ListItem | Object/collection rows | title, subtitle, thumbnail |
| 12 | Divider | Section separators | inset |

## Build Order

1. Update `src/theme/index.ts` with complete token set (this decision doc is the spec)
2. Build each component in order (Button first, it's used everywhere)
3. Test each component on Android emulator before building the next
4. Update `docs/state-of-the-art/DESIGN-SYSTEM.md` with any adjustments
5. Only after all 12 components pass visual inspection: begin screen compositions

## Consequences

- Every CC and Cursor prompt for UI work must start with "Read DESIGN-SYSTEM.md. Import all values from src/theme/index.ts. Do NOT hardcode colors, font sizes, spacing, or radii."
- When a screen needs something that doesn't exist as a component, build the component first
- The Settings screen, New Collection screen, and other existing screens will be refactored to use the new components (this is part of the demo build, not a separate task)
- HTML prototypes from Claude Chat are flow/content references only, never pixel-perfect targets

## References

- State of the Art doc: docs/state-of-the-art/DESIGN-SYSTEM.md
- EU Accessibility Act: EN 301 549
- WCAG 2.1 Level AA: https://www.w3.org/WAI/WCAG21/quickref/
- Architecture Planning: REGISTER-ARCHITECTURE-PLANNING-2026-03-16.md
