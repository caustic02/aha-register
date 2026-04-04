# aha! Register -- Architecture Planning Document

> Date: March 16, 2026
> Scope: Phase 1 architecture decisions, gap analysis, screen inventory for April Berlin demo
> PDF version: Same content, formatted for upload to any Claude session
> Next: Ingest Vera/Florian communications, then begin build sequence

---

## 1. On-Device Image Segmentation Research

Vera needs Google Photos-style "tap to select object, remove background" functionality.

### Option A: react-native-executorch (Software Mansion)

Best React Native option. Provides `useImageSegmentation` hook with DeepLab V3 (semantic segmentation). SAM (Segment Anything Model) on roadmap with dedicated `useSegmentation` hook. Runs entirely on-device via Meta's ExecuTorch runtime. Uses CoreML on iOS, XNNPACK/Vulkan on Android.

**Problem:** Latest version requires Expo SDK 54. Register is on SDK 52. Also requires New Architecture. Both upgradable but not trivially. This is Phase 4/5 material.

### Option B: Platform-native APIs (custom native modules)

- **Google ML Kit Subject Segmentation** (beta): isolates people, pets, objects from background. On-device, Android only via Play Services.
- **Apple Vision VNGenerateForegroundInstanceMaskRequest**: isolates foreground objects, iOS 17+.
- Both need custom Expo native modules. Significant native work.

### Option C: Cloud-based via Gemini API (RECOMMENDED for MVP)

Send captured photo to Gemini (already planned for metadata extraction). Add segmentation request to same API call. Mask comes back as data, app renders overlay. User taps to confirm object boundary. No native modules. Works identically on both platforms.

**DECISION: Option C for April demo and Phase 1-2. On-device segmentation moves to Phase 4-5.**

Practical flow for Vera: capture photo > AI analyzes > user sees suggested object boundary overlaid > taps to confirm or adjust > background removal server-side > result stored with object record.

---

## 2. EU Accessibility Act Compliance

The EAA has been in effect since June 28, 2025. Native mobile apps must meet EN 301 549 requirements (WCAG 2.1 Level AA). Register serves EU institutional market. Compliance is mandatory.

### Concrete Requirements

| Requirement | Standard | Impact |
|---|---|---|
| Touch targets | 44x44pt iOS, 48x48dp Android, WCAG 2.2 min 24x24px | Every button, icon, list item, toggle |
| Color contrast | 4.5:1 normal text, 3:1 large text (18px+) | Verify every pairing in theme |
| Screen readers | VoiceOver (iOS), TalkBack (Android) | accessibilityLabel on every interactive element |
| Text scaling | Support system dynamic type | No fixed pixel sizes ignoring system settings |
| Focus order | Logical tab/focus sequence | Every screen needs focus management |
| Motion | prefers-reduced-motion | All animations need fallback |
| Keyboard nav | All functions without mouse | External keyboard full navigation |

### Prerequisite

Before building any screens, update `src/theme/index.ts` with:
- `minTouchTarget` constant (48dp minimum)
- Verified contrast ratios for every color pairing
- Font sizes in scalable units
- Document in `docs/state-of-the-art/DESIGN-SYSTEM.md`

---

## 3. Phase 1 Gap Analysis: Spec vs Current Build

Phase 1 goal: "Capture one object, see AI magic, save it."

### Built (9 items)

- Supabase EU Frankfurt
- Expo project + Expo Router navigation
- Camera capture (single photo)
- EXIF extraction (GPS, timestamp, device)
- SHA-256 capture-time hash
- SQLite schema (14 tables, 19 indexes)
- i18n (EN/DE, 256 keys)
- Offline-first sync queue
- Auth (email, Supabase)

### Partial (3 items)

| Feature | Status | Gap |
|---|---|---|
| Object CRUD | Basic | Needs full metadata schema fields |
| Search and browse | Search bar exists | No filters by category/status/artist |
| Settings screen | Basic | Needs domain selector, AI toggle |

### Not Started (10 items)

| Feature | Priority for April Demo |
|---|---|
| Gemini 2.5 Pro metadata extraction | CRITICAL: the "wow" moment |
| Claude API provenance parsing | Medium: can stub for demo |
| Image gallery (multi-image, labeled, zoomable) | High: visual impact |
| Artist profiles (create, link) | Medium |
| Provenance entries (timeline, manual) | Medium: stub for demo |
| Condition report (grade + notes + photos) | Medium |
| Valuation fields | Low for demo |
| Provenance hash chain (port from marketplace) | Low for demo |
| Privacy/trust onboarding screen | HIGH: EU requirement, brand statement |
| AI toggle (org-level) | HIGH: EU requirement |

---

## 4. Screen Inventory for April Berlin Demo

12 screens total. Goal: capture an object, AI returns metadata, see it in professional collection view.

| Screen | Status | Flow |
|---|---|---|
| Splash | Exists (polish) | Onboarding |
| Onboarding (3 slides) | Redesign | Onboarding |
| Trust/privacy screen | NEW | Onboarding |
| Sign in | Exists (polish) | Onboarding |
| Home dashboard | NEW (replaces object list) | Tab: Home |
| Capture tab | Redesign | Tab: Capture |
| Settings | Expand (AI toggle, domain) | Tab: Settings |
| Camera view | Enhance (guides) | Capture flow |
| AI processing screen | NEW | Capture flow |
| Review card (metadata) | NEW (redesign post-capture) | Capture flow |
| Object detail | NEW (full metadata view) | From Home/List |
| Object list (with filters) | Redesign | From Home |

### Cut from April demo (Phase 2+)

- Capture mode selection (single photo only)
- QR scanner
- Multi-angle guided capture
- Batch capture mode
- Location management hierarchy
- Edition tracking
- Certificate PDF generation
- Field selection / domain selector in onboarding
- Privacy dashboard (org-level analytics)

---

## 5. Architecture Decisions to Lock

### 1. AI processing: synchronous with progress screen

User captures, sees "Analyzing..." with 3-5 second progress animation, lands on review card with pre-filled metadata. Confidence scores appear in real time. Async batch processing is Phase 2.

### 2. Capture flow: single path, no mode selector

One mode for April: single photo. Tap capture > camera > photo > AI processing > review card. 3 taps from camera to saved object. Mode selection is Phase 2.

### 3. Object isolation: cloud-based via Gemini

No on-device segmentation for MVP. AI processing includes "Isolating object..." as progress step. Manual crop as fallback. On-device ML moves to Phase 4-5.

### 4. Design system: accessibility-first prerequisite

Update `src/theme/index.ts` before building screens. Minimum touch targets (48dp), verified contrast ratios, scalable font sizes. Document in `docs/state-of-the-art/DESIGN-SYSTEM.md`.

### 5. Light theme confirmed

Light theme for field use. Dark prototype variants are visual reference only.

---

## 6. Recommended Build Order

| # | Task | Priority | Depends On |
|---|---|---|---|
| 1 | Design system update (a11y) | Prerequisite | Nothing |
| 2 | Gemini API integration (Edge Fn) | Critical | #1 |
| 3 | AI processing screen | Critical | #2 |
| 4 | Review card (post-capture) | Critical | #3 |
| 5 | Object detail screen | Critical | #4 |
| 6 | Home dashboard | Critical | #5 |
| 7 | Trust/privacy onboarding | High | #1 |
| 8 | Object list with search/filter | High | #5 |
| 9 | Settings expansion | Medium | #1 |
| 10 | Onboarding redesign | Medium | #7 |
| 11 | Camera enhancements | Medium | #1 |
| 12 | Polish + a11y audit | Final | All above |

Items 1-6 are the core demo. Items 7-12 are nice-to-have for Berlin but not blockers.

---

## 7. Workflow: Responsibility Split

| Role | Responsibility |
|---|---|
| Vera / Florian (Institutional Partners) | Stakeholder conversations and presentations; museum/institutional contact introductions; field testing and usability feedback; domain expertise (museum workflows, Daphne fields); Berlin demo logistics; process documentation |
| Michael (Product/Dev) | Feature intake from partner feedback; architecture decisions; development (CC + Cursor); AI pipeline integration; design system and UX; technical documentation |
| Claude Chat (Architect) | Research and analysis; architecture planning and specs; CC/Cursor prompt generation; documentation maintenance; gap analysis |
| Claude Code (Executor) | Multi-file builds; git operations; database migrations; testing |

**Communication flow:** Vera/Florian talk to institutions, report feature requests and process requirements. Michael ingests into Feature Spec and prioritizes. Claude Chat turns priorities into architecture decisions and build prompts. Claude Code executes.

---

## Key References

| Item | Location |
|---|---|
| Feature Spec | Notion: "aha! Register -- Competitive Landscape & Feature Spec" |
| Repo | caustic02/aha-register |
| Prototype | aha-nextjs.vercel.app/demo/register |
| Session Rules | CLAUDE-SESSION-RULES-REGISTER-v2.md |
| Design tokens | src/theme/index.ts |
| Supabase | fdwmfijtpknwaesyvzbg (Frankfurt EU Pro) |
| EAS Build | expo.dev/accounts/aha-register/projects/aha-register |
