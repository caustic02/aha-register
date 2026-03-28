# aha! Register — Session Bootstrap v4

> Updated: 2026-03-25
> Scope: aha! Register mobile app ONLY
> This file replaces: CLAUDE-SESSION-RULES-REGISTER-v3.md, REGISTER-ENVIRONMENT.md, REGISTER-DESIGN-SYSTEM.md, REGISTER-ARCHITECTURE-PLANNING-2026-03-16.md
> Feature specs (Video Capture, Capture Guidance Protocol, Object Isolation) are separate roadmap docs. Load only when building.

---

## Environment

Michael Tauschinger-Dempsey, founder of TEDE Holdings. **aha! Register** is a React Native/Expo SDK 55 app (repo: `caustic02/aha-register`, path: `C:\ClaudeProject-Register\aha-register`).

**Tools:** Claude Chat (architect), Claude Code with Opus/Sonnet (executor), Cursor (single-file edits).
**Connected:** Supabase MCP (project `fdwmfijtpknwaesyvzbg`, Frankfurt EU Pro), Notion MCP, Gmail MCP, Google Calendar MCP, QNAP NAS MCP (metadata/directory only).
**Dev environment:** PC only, Android emulator. No EAS Build for development. EAS Build for TestFlight/production only.
**Repo is source of truth.** Notion ADR Hub is a directory pointing to repo paths.

### Edge Functions (Supabase Frankfurt)
- `analyze-object` — Gemini 2.5 Pro, AI object analysis
- `remove-background` — remove.bg API (to be replaced by SAM 3, post-April)
- `ocr-enhance` — OCR post-processing

---

## What's Built (honest inventory, March 25 2026)

**Working:**
- Supabase Auth (email)
- Camera capture (single photo, EXIF extraction, SHA-256 hash at capture)
- SQLite schema (14 tables, 19 indexes)
- i18n framework (EN/DE, 256 keys)
- Offline-first sync queue architecture
- Edge Functions deployed (analyze-object, remove-background, ocr-enhance)
- EAS Build pipeline, TestFlight active (Build 8, v0.2.0)
- Export pipeline (PDF/CSV/JSON with domain configs)
- Getty AAT vocabulary (4,757+ terms cached)

**Broken / Not Visible:**
- Design system exists in `src/theme/index.ts` but is NOT consistently applied across screens
- Tab-based navigation (Objects | Collections | Capture | Settings) is wrong UX paradigm
- Icons are too small, unintuitive, generic Lucide defaults
- No pinch-to-zoom on camera
- No image crop or review after capture
- Object detail screen is bare, does not resemble professional data sheet
- AI analysis (Gemini) is wired but the "wow moment" UX is missing
- Object isolation (remove.bg) is unreliable on museum objects
- No video capture
- No guided capture protocols

**Not Started:**
- Flat vertical scroll dashboard (replacing tab navigation)
- Museum-grade PDF output matching KSW Datenblatt format
- Object isolation via SAM 3
- Video capture + narration
- Capture guidance protocol system
- Command center / companion app
- Three-tier storage (phone → laptop → cloud)

---

## Target: April 9 Presentable Build

### Week 1 (March 25 - April 1): Rebuild the Surface
1. Kill tab bar. Single scrollable dashboard.
2. Capture CTA: big, unmissable, one tap to camera.
3. Recent objects: horizontal card scroll with status badges.
4. Quick actions cluster (export, browse, settings) inline.
5. Apply design system tokens everywhere (colors, typography, spacing, radii).
6. Fix icon sizes (24px visual minimum, 48dp touch targets).
7. Camera: add pinch-to-zoom, post-capture review screen.

### Week 2 (April 1 - 9): Make the Wow Work
1. Gemini AI analysis live after capture with progress animation.
2. Object detail screen matching KSW Datenblatt layout.
3. PDF export matching museum data sheet format.
4. Object isolation (remove.bg or SAM 3 if testable).
5. Polish: transitions, loading states, error handling, i18n parity.

### Cut (roadmap, not April 9)
- Video capture + narration (spec: VIDEO-CAPTURE-SPEC-v2.md)
- Capture guidance protocols (spec: CAPTURE-GUIDANCE-PROTOCOL-SPEC.md)
- SAM 3 migration (spec: OBJECT-ISOLATION-RESEARCH-BRIEF.md)
- 3D scanning
- Command center / companion app
- Three-tier storage

---

## Sacred Rules

### Capture Integrity
SHA-256 hash computed on-device at moment of capture. Hash first, then insert. Every media record gets a hash. Every capture logs to audit_trail and sync_queue. NEVER modify a file after hashing.

### Schema Safety
SQLite has no full ALTER TABLE. Destructive changes need Michael's approval. Safe without approval: ADD COLUMN, CREATE TABLE/INDEX, INSERT. Always update `db/schema.ts` AND `db/types.ts` in the same commit.

### Supabase Safety
CC connects as `postgres` superuser (bypasses RLS). No DROP, DELETE, TRUNCATE, or ALTER without Michael's approval. SELECT and INSERT are safe.

### Sacred Files (diff + approval before edit)
`db/schema.ts`, `db/types.ts`, `services/sync-engine.ts`, `utils/hash.ts`, `app.json`, `.env`, `src/theme/index.ts`

### The One Rule
> If I confuse my users, I lose.
Users are museum professionals, not tech workers. Faster than a notebook. Self-evident interface.

---

## Design System (reference only — full spec in `src/theme/index.ts`)

### Colors
| Token | Hex | Rule |
|-------|-----|------|
| accent | #2D5A27 | Green = tappable (buttons, links, active chips) |
| background | #FAFAF8 | Warm off-white, all screens |
| surface | #FFFFFF | Cards, inputs, modals |
| textPrimary | #1A1A1A | Headings, body |
| textSecondary | #6B6B6B | Labels, descriptions |
| textMuted | #999999 | Placeholders, timestamps |
| border | #E8E8E4 | Dividers, input borders |
| danger | #C53030 | Destructive actions, errors |
| warning | #D4A017 | Alerts, attention |

### Typography
System fonts (SF on iOS, Roboto on Android). Scale: xs(10), sm(12), base(14), md(15), lg(17), xl(20), xxl(24), title(30).

### Touch Targets
Minimum 44pt (Apple HIG) / 48dp (Android). Use `hitSlop` for small visual elements. EU Accessibility Act requires this.

### Icons
lucide-react-native with semantic re-exports from `src/theme/icons.ts`. Minimum visual size 24px.

---

## Navigation Architecture (NEW — April 2026)

**Kill the tab bar.** Replace with flat vertical scroll dashboard.

```
┌─────────────────────────────────┐
│ aha! Register     [search] [⚙]  │  ← header: brand + icon buttons
│                                  │
│ ┌──────────────────────────────┐│
│ │  + Capture object            ││  ← hero CTA, accent green, one tap
│ │    Photo, scan, or quick note││
│ └──────────────────────────────┘│
│                                  │
│ Recent                           │
│ [card] [card] [card] →           │  ← horizontal scroll, status badges
│                                  │
│  ┌──────┐  ┌──────┐             │
│  │  12  │  │   3  │             │  ← stats grid
│  │ Obj. │  │ Coll.│             │
│  └──────┘  └──────┘             │
│                                  │
│ [Export] [Browse] [Settings]     │  ← quick actions cluster
│                                  │
│ Sync: 2 pending ↑               │  ← sync status, inline
└─────────────────────────────────┘
```

Object detail, camera, and settings are full-screen pushes from this single root. No tabs.

---

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Import Next.js patterns | Register is React Native/Expo |
| Skip SHA-256 on any capture | Hash first, then insert |
| Modify schema without types | schema.ts and types.ts change together |
| Assume network | Offline-first, SQLite is truth |
| Use bare RN packages | Prefer expo-* managed equivalents |
| `git add .` on Windows | Explicit paths |
| Hardcode colors/sizes | Import from src/theme/index.ts |
| Show spinners for local data | Spinners only for network ops |
| Default privacy to "public" | Use institution configured default |
| Run CC and Cursor in parallel | Commit/push one before starting the other |
| Ask Michael to choose technical options | Recommend, explain, let him approve |
| Recommend without implementing | Write the code in same or next session |
| Add strings without i18n | EN + DE keys in same commit |
| Start work without reading State of the Art | Read docs/state-of-the-art/*.md first |
| Finish work without updating State of the Art | Update before closing the task |
| Trigger EAS Build for dev iteration | Use Android emulator locally |

---

## Key Files

| Purpose | Path |
|---------|------|
| SQLite schema | db/schema.ts |
| TypeScript interfaces | db/types.ts |
| Sync engine | services/sync-engine.ts |
| SHA-256 hashing | utils/hash.ts |
| Theme tokens | src/theme/index.ts |
| Icon mappings | src/theme/icons.ts |
| Root layout | app/_layout.tsx |
| Home screen | src/screens/HomeScreen.tsx |
| Capture screen | src/screens/CaptureScreen.tsx |
| Object detail | src/screens/ObjectDetailScreen.tsx |
| Settings | src/screens/SettingsScreen.tsx |
| Export modal | src/components/ExportStepperModal.tsx |
| Edge: AI analysis | supabase/functions/analyze-object/index.ts |
| Edge: bg removal | supabase/functions/remove-background/index.ts |
| Edge: OCR | supabase/functions/ocr-enhance/index.ts |
| Domain configs | src/config/domains/*.json |
| State of the Art | docs/state-of-the-art/ |

---

## Session Protocol

1. Read this document.
2. Read any handover doc attached.
3. Read relevant `docs/state-of-the-art/*.md` files for systems you will touch.
4. Stop and ask Michael what to do next.

**Do not:** Explore the codebase unprompted. Write prompts before scope is confirmed. Burn tokens on orientation.

**NAS access:** Claude Chat can browse directories and metadata. Cannot read file contents. Tell Michael which file you need; he pastes or routes to CC.

**Style:** Direct. No em dashes. No AI filler. Diagrams over text walls. German copy: natural, not formal. Browser: Vivaldi/Firefox only.

---

## Roadmap Specs (load only when building)

| Feature | Spec File | Status |
|---------|-----------|--------|
| Video capture + narration | VIDEO-CAPTURE-SPEC-v2.md | Roadmap, post-April |
| Capture guidance protocols | CAPTURE-GUIDANCE-PROTOCOL-SPEC.md | Roadmap, post-April |
| Object isolation (SAM 3) | OBJECT-ISOLATION-RESEARCH-BRIEF.md | Roadmap, post-April |
