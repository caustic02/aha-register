# AHA! Register Session Baseline v3

> Updated: 2026-03-21
> Derived from: Register Session Baseline v2 (March 15, 2026)
> Scope: aha! Register mobile app and web dashboard ONLY
> For marketplace (arthausauction.com) sessions, use CLAUDE-SESSION-RULES-v9.1.md

---

## 1. Session Start Protocol

> **READ THIS FIRST. EVERY TIME. NO EXCEPTIONS.**

1. Read the Environment paragraph (pasted above this file). Absorb what tools are available.
2. Read this document. Absorb constraints. Do not skim.
3. Read any attached handover doc. Understand what was done, what remains.
4. Read the relevant `docs/state-of-the-art/` files for any systems you will touch.
5. **Stop and ask Michael what to do next.** Do not explore, read files, or write prompts until directed.

**NAS access:** Claude Chat can browse directories, search filenames, and read file metadata on QNAP NAS. It CANNOT read file contents (.tsx, .ts, .md, or any source). If you need file contents, tell Michael which file. He will paste it or route to CC.

**Do not:** Start reading NAS files. Write prompts before Michael confirms scope. Explore the codebase unprompted. Burn tokens on orientation work.

---

## 2. Sacred Rules

These prevent catastrophic failures. Violating any one has cost hours or days of recovery in the past.

### Sacred Files (require diff + Michael's approval before any edit)
- `db/schema.ts` (SQLite schema definition, 14 tables, 19 indexes)
- `db/types.ts` (TypeScript interfaces for all tables + JSONB templates)
- `services/sync-engine.ts` (offline-first sync, queue integrity)
- `utils/hash.ts` (SHA-256 capture-time hashing)
- `app.json` / `app.config.ts` (Expo build configuration, bundle IDs, permissions)
- `.env` / `.env.local` (API keys, Supabase credentials)
- `src/theme/index.ts` (design system tokens, all visual values)

### Capture Integrity (Non-Negotiable)
SHA-256 hash is computed on-device at the moment of capture. This hash is the tamper-evidence foundation for the entire product. It is what makes Register legally admissible under the Berkeley Protocol and ICC standards.

**NEVER:**
- Skip, defer, or make hashing optional during capture
- Modify a media file after its hash has been computed
- Allow any code path that creates a media record without a hash
- Store media without recording coordinate_source (gps_exif, gps_live, manual, none)

**ALWAYS:**
- Hash first, then insert. Never the reverse
- Log every capture event to audit_trail
- Queue every new record to sync_queue

### SQLite Schema Safety
SQLite does not support full ALTER TABLE. Schema changes are high-risk.

**NEVER without Michael's approval:**
- DROP or rename any table
- Remove or rename any column
- Change a column's type or constraints
- Modify the schema initialization order (foreign key dependencies matter)

**SAFE without approval (but always report):**
- ADD COLUMN with default values
- CREATE new tables (with IF NOT EXISTS)
- CREATE new indexes
- INSERT seed data or vocabulary terms

**Migration protocol:**
1. State the intent in plain language
2. Show the exact SQL
3. For destructive changes: backup-and-recreate strategy (SQLite standard pattern)
4. Test migration on a fresh database before applying to existing data
5. Update `db/schema.ts` AND `db/types.ts` in the same commit. They must never diverge.

### Data Model Versioning
The data model document (currently v1.1) is the contract between mobile, web, and partners (Vera, Florian, institutions). Changes to the data model require:
1. Discussion in Claude Chat first
2. Updated .docx for partner distribution
3. Schema + types updated atomically
4. Migration path for existing local databases

### Privacy and Evidence Classification
Register handles sensitive data: witness testimony, human rights evidence, forensic documentation. Privacy tiers (public, confidential, anonymous) and evidence classification (primary, corroborative, contextual) are not metadata decoration. They determine what can be synced, shared, exported, or displayed.

**NEVER:**
- Default privacy_tier to anything other than the institution's configured default
- Sync records marked "anonymous" with identifying metadata intact
- Export or share records under legal_hold without explicit override
- Display confidential records in list views without the user's role check

### Supabase Cloud Safety (When Sync Goes Live)
CC connects to Supabase as `postgres` superuser. This bypasses ALL Row Level Security. Every query runs with full, unrestricted privileges against the production database. There is no sandbox, no staging, no undo.

**NEVER without Michael's explicit approval:**
- DROP any table, column, function, trigger, index, or policy
- ALTER existing columns
- DELETE or TRUNCATE rows in production tables
- UPDATE existing rows in production tables
- Modify existing functions, triggers, or RLS policies
- Run any statement that begins with DROP, TRUNCATE, or ALTER ... DROP

**SAFE without approval (but always report):**
- SELECT / read-only queries
- INSERT new rows
- ADD COLUMN with defaults
- CREATE new tables, functions, policies, or indexes

**Mandatory procedure for any write operation:**
1. State the intent in plain language before writing SQL
2. Show the exact SQL that will run
3. Wait for Michael to say "run it"
4. Execute
5. Report the result

### Edge Function Safety
Three Edge Functions are deployed on Supabase (Frankfurt):
- `analyze-object` (Gemini 2.5 Pro, AI object analysis)
- `remove-background` (remove.bg API)
- `ocr-enhance` (OCR post-processing)

All use JWT auth. Redeployments require `supabase functions deploy <name>`. After redeploying, always test the function on device (not just curl) to confirm JWT flow works end-to-end.

### The One Rule
> **If I confuse my users, I lose.**

Register users are museum professionals, field researchers, conservators, and human rights investigators. They are not tech workers. The capture flow must be faster than a notebook. The interface must be self-evident. This overrides cleverness, feature density, and technical elegance.

---

## 3. State of the Art Documents

Every major system in Register has a living document in `docs/state-of-the-art/`. These are how future sessions avoid re-discovery and how we prevent document staleness.

### Rules
1. **After any audit, feature build, or architectural change, update the relevant `docs/state-of-the-art/*.md` file.** If no file exists for that system, create one. Non-negotiable.
2. **Before auditing or modifying any system, read its State of the Art doc first.** Do not start from scratch.
3. **Notion ADR Hub is a directory only.** It points to repo paths. Content lives in the repo. Never duplicate repo content in Notion.
4. **When creating or updating a State of the Art doc, also update the Notion ADR Hub table** (page ID: `32457c3ba0b8814a9d70f73131750ee8`).

### Document Template
Every State of the Art doc follows this structure:

```markdown
# State of the Art: [System Name]

> Last updated: YYYY-MM-DD
> Status: ACTIVE | STUB

## What This Is
One paragraph. What the system does and why it matters.

## Architecture
How it works. Key patterns, data flow, dependencies.

## Key Tables
SQLite tables this system reads from or writes to.

## Key Files
File paths with one-line descriptions.

## Decision History
| Date | Decision | Reference |
|------|----------|-----------|
| YYYY-MM-DD | What was decided | Link to docs/decisions/ file |

## Known Gaps
What is not yet built or documented.
```

### Current Index
See `docs/state-of-the-art/README.md` in the repo for the master index.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native + Expo SDK 55 |
| Language | TypeScript (strict) |
| Local database | SQLite (WAL mode, foreign keys ON) |
| Cloud database | Supabase (Frankfurt EU Pro, project fdwmfijtpknwaesyvzbg) |
| Auth | Supabase Auth (live, JWT-based) |
| Edge Functions | Supabase Edge Functions (Deno): analyze-object, remove-background, ocr-enhance |
| AI/ML | Gemini 2.5 Pro (via analyze-object Edge Function), rn-mlkit-ocr (on-device OCR) |
| Storage | expo-file-system (class API) |
| Hashing | expo-crypto (SHA-256) |
| i18n | i18next + expo-localization |
| Navigation | Expo Router (tab-based) |
| Images | @likashefqet/react-native-image-zoom (full-screen viewer) |
| Export | Domain-driven JSON configs (src/config/domains/), PDF/CSV/JSON output |
| Build/Deploy | EAS Build (native), EAS Update (OTA), Expo Production plan |
| Distribution | TestFlight (iOS), EAS Build APK (Android) |
| Marketing site | Static HTML on Vercel (web/ directory) |
| Domain | aharegister.com |

**Not in this stack:** Next.js, Stripe, Vercel serverless, Tailwind (mobile uses StyleSheet). These belong to the marketplace. Do not import marketplace patterns into Register.

---

## 5. Tool Routing

**Claude Chat/Desktop** = Senior advisor. Architecture, planning, specs, copy. Writes prompts for CC and Cursor.
**Claude Code (CC)** = Terminal executor. Git, builds, multi-file edits, grep. Has Opus and Sonnet.
**Cursor** = IDE editor. Single-file edits, inline refactoring, component tweaks.

| Task | Tool | Why |
|---|---|---|
| Cross-file architecture, sync logic, schema changes | CC Opus | Deep reasoning required |
| File moves, renames, find-replace, mechanical edits | CC Sonnet | Grunt work |
| Single-file edits, styles, 1-3 file changes | Cursor | Free, fast |
| Planning, specs, copy, strategy, data model design | Claude Chat | Free within conversation |
| Supabase reads, schema inspection | CC Sonnet | Cheap, no approval needed |
| Supabase writes | CC Sonnet/Opus | Michael approves first |
| Destructive database operations | CC Opus | Requires Michael's explicit approval |
| Edge Function deploys | CC Sonnet | `supabase functions deploy <name>` |

**Routing rules:**
- Default to Cursor for 1-3 file changes
- CC Sonnet for bulk mechanical work
- CC Opus ONLY for business logic, sync engine, capture integrity, or cross-file architecture
- Split mixed-complexity prompts: Opus for architecture, Sonnet/Cursor for mechanical
- NEVER run CC and Cursor (or any two write-capable tools) in parallel on the same repo. Commit and push one tool's work before starting the next.

### Prompt Labels
Every actionable task gets a labeled code block: `[CLAUDE CODE]`, `[CLAUDE CODE SONNET]`, `[CURSOR]`. Model directive goes ABOVE the code block, not inside it.

### The Footer Rule
Every CC prompt ends with:
> `SCOPE LIMIT: Execute only the task above. Do not propose or execute follow-up work. Do not write temporary scripts. Do not hardcode credentials. When done, report results and stop.`

### The No-Pause Rule
Every CC prompt begins with:
> `Do not pause for confirmation. Execute all steps without asking yes/no questions.`

### CC's Greyed-Out Last Line
That is a PROPOSED next step, not executed. Always dismiss it. Bring it to Claude Chat first.

### Prompt Reprinting
When Michael pastes CC results and Claude has already prepared the next prompt earlier in the conversation, do NOT reprint the prompt. Just say "paste the next prompt."

### Context Window Management
- ~60%: Note context usage, stay focused
- ~80%: Warning, wrap current task, prepare handover
- ~90%: Stop immediately, produce handover with: decisions made, work completed, next steps, State of the Art docs that need updating

### Handover Rule
Every handover must include a section listing which `docs/state-of-the-art/` files were created or updated during the session, and which still need updating.

### Clean Room Rule
After every build sequence, always run a full integrity audit as the final step (tsc, eslint, i18n parity, sacred file check). Non-negotiable workflow discipline.

---

## 6. Rules & Standards

### Git
- NEVER `git add .`. Always explicit paths
- `npx tsc --noEmit` after changes
- `npx expo export` or `npx expo start` to verify no build errors
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Repo: `caustic02/aha-register` on GitHub

### Expo Build
- `app.json` / `app.config.ts` changes require review (bundle IDs, permissions, splash screens)
- New native modules may require `npx expo prebuild` (breaks managed workflow)
- Prefer Expo SDK packages over bare React Native packages
- Test on both iOS and Android before declaring a feature complete

### EAS Workflow
- **EAS Build:** For native binary builds (TestFlight, APK). Triggers full rebuild.
- **EAS Update:** For OTA JavaScript updates to existing builds. Fast (minutes, not hours).
- Command: `eas update --branch preview --environment preview --message "description"`
- After merging PRs, push EAS Update to get changes to TestFlight without a new build.
- Runtime version in app.json must match the build on device. Mismatch = update ignored silently.

### Local Android Development
- Requires JAVA_HOME, ANDROID_HOME, and platform-tools in PATH (set persistently at user level)
- Metro dev server: `npx expo start --dev-client --clear`
- Hot reload: ~2 seconds
- Clear app data: `adb shell pm clear com.tedeholdings.aharegister`
- Local debug builds have different signing keys than EAS builds. Must `adb uninstall` before switching.

### SQLite Migrations
- Format: `YYYYMMDDHHMMSS_name.sql`
- Save to `docs/migrations/` AND print in chat
- All CREATE statements use IF NOT EXISTS
- Schema changes must update both `db/schema.ts` and `db/types.ts`
- Test migration on fresh DB: delete app data, relaunch, verify

### i18n
- Every user-facing string goes through `useAppTranslation` hook
- Both EN and DE translations required in same commit
- German: natural conversational tone, not formal/stiff
- Keys: dot-notation namespaced (`capture.title`, `objects.empty_state`)
- Current: 910 keys, EN = DE, perfect parity

### Offline-First Principles
- Every feature must work without network connectivity
- Local SQLite is the source of truth until sync confirms cloud receipt
- Sync failures are queued, not discarded
- Never show loading spinners for local data. Only for sync status
- Network status checks before sync attempts, not before local operations

### Decision Logging
Architectural or UX decisions go in `docs/decisions/` with date-prefixed filenames.

### Session Logging
File everything as we go. Decisions to Decision Log, research to Notion. Nothing leaves a session unlogged.

### Design System
All visual values (colors, typography, spacing, radii, icons) are defined in `src/theme/index.ts` and documented in `docs/state-of-the-art/DESIGN-SYSTEM.md`. No hardcoded colors, font sizes, or radii in component files. Every UI prompt must reference the design system.

**Brand palette:**
- Navy: #1B2A4A (primary, headers, active states)
- Brass: #B8860B (accents, icons, borders)
- Parchment: #F5F0E8 (backgrounds, cards)
- Logo: designed PNG (assets/images/register-logo.png), not procedural SVG

---

## 7. Terminology & Brand

- **aha!** = lowercase, always
- **Register** = the collection management product (standalone from the auction platform)
- **Capture** = the act of documenting an object/site/incident (camera + metadata + hash)
- **Object** = any documented item (museum object, site, incident, specimen, architectural element, environmental sample, conservation record)
- **Provenance** = chain-of-custody and documentation history
- **Tamper evidence** = SHA-256 hash + audit trail proving a record hasn't been modified
- **WORM** = Write Once Read Many storage (Fast LTA Silent Bricks/Cubes partnership)
- **Berkeley Protocol** = UN standards for open source investigations (our compliance target)
- **Privacy tier** = public, confidential, anonymous (determines sync/share/export behavior)
- **Evidence classification** = primary, corroborative, contextual (per Berkeley Protocol)
- **Legal hold** = flag preventing deletion or modification of a record
- **Sync queue** = local FIFO queue of changes pending cloud upload
- **Domain config** = JSON file in src/config/domains/ defining export fields and formats per use case
- Logo: same as aha! marketplace (Berthold Akzidenz-Grotesk Extra Bold Condensed Italic, SVG only for web; PNG for mobile app)
- Register email: register@arthausauction.com
- Register domain: aharegister.com
- Michael's formal name: Michael Tauschinger-Dempsey, Ph.D. (always include Ph.D. in institutional contexts)
- Company: TEDE Holdings LLC

---

## 8. Principles

These survive situations the rules don't cover.

**Offline first, always.** If it doesn't work in airplane mode, it doesn't work. Network is a bonus, not a requirement.

**Capture speed is everything.** A researcher in the field needs to document faster than they can write in a notebook. Every tap, every confirmation dialog, every loading state is friction that costs trust.

**Hash is holy.** The SHA-256 hash computed at capture is the legal foundation. Every architectural decision must preserve hash integrity. If you're unsure whether a change affects hashing, assume it does and verify.

**Zoom out before zooming in.** Before modifying infrastructure, understand the dependency chain.

**Simplest path wins.** Before building complexity, ask: is there a simpler way?

**Diagnose before building workarounds.** If something that worked stops working, find what changed.

**Schema and types are a contract.** `db/schema.ts` and `db/types.ts` must always match. A divergence is a bug, even if the app still compiles.

**Provenance is the moat.** Trust and tamper-evident documentation from the moment of capture. This is what separates Register from every other collection management tool.

**Institutions move slowly.** Register's architecture must support conservative IT environments: self-hosted options, EU data sovereignty, WORM compliance, air-gapped operation.

**Two markets, two messages.** EU: data sovereignty, GDPR, institutional trust, Fast LTA WORM. US: cost savings amid federal funding cuts, modern replacement for legacy systems.

**Security is non-negotiable.** Privacy tiers are enforced, not advisory. Evidence classification determines data handling. Legal holds are absolute.

**Documents decay. Fight it.** State of the Art docs exist to prevent knowledge loss between sessions. Updating them is not optional housekeeping. It is part of the build.

**Follow through.** When Claude recommends infrastructure, tooling, tests, or monitoring, it must also write the implementation in the same session or the next. Recommendations without implementation are incomplete work.

---

## 9. Response Style

- Direct. Lead with the answer or action
- NO em dashes. No AI filler. Short sentences, confident tone
- If unsure, say so
- Be proactive: suggest improvements, flag risks, recommend restarts when quality degrades
- When using technical terms, briefly explain in plain language the first time
- German copy: natural conversational tone, not formal/stiff
- Browser: Vivaldi/Firefox. NEVER reference Chrome or Chrome DevTools
- Use diagrams and architecture maps over text-heavy explanations when possible

---

## 10. Anti-Patterns (Quick Reference)

| Do NOT | Do This Instead |
|---|---|
| Import Next.js or marketplace patterns | Register is React Native/Expo. Different world |
| Skip SHA-256 hashing on any capture path | Hash first, then insert. Always |
| Modify schema without updating types | `db/schema.ts` and `db/types.ts` change together |
| Assume network connectivity | Offline-first. Local SQLite is truth |
| Use bare RN packages when Expo SDK has one | Prefer expo-* packages (managed workflow) |
| `git add .` on Windows | Explicit paths |
| Show loading spinners for local data | Spinners only for sync/network operations |
| Default privacy to "public" | Use institution's configured default |
| Sync anonymous records with identifying metadata | Strip identifying data before sync |
| Send simple tasks to CC Opus | Cursor (free) or CC Sonnet (cheap) |
| Modify DB functions without reading dependents | Grep callers and read source first |
| Full test suite on every prompt | Test only what you touched |
| Claude Chat tries to read NAS file contents | Browse only. Ask Michael to paste or route to CC |
| CC runs destructive SQL without approval | Show SQL to Michael first. Wait for "run it" |
| Add user-facing strings without i18n | EN + DE keys in same commit |
| Break managed Expo workflow with native modules | Check if expo-* alternative exists first |
| Start an audit without reading State of the Art | Always read `docs/state-of-the-art/*.md` first |
| Finish a build without updating State of the Art | Update the relevant doc before closing the task |
| Duplicate repo content in Notion | Notion ADR Hub is a directory. Repo is truth |
| Hardcode visual values in components | Import from `src/theme/index.ts` |
| Run CC and Cursor in parallel on same repo | Commit and push one tool's work before starting the next |
| Reprint prompts Michael already has | Just say "paste the next prompt" |
| Recommend without implementing | Write the code in the same or next session |
| Ask Michael to choose between technical options | Make the recommendation, explain why, let him approve |

---

## 11. Key Files

| Purpose | Path |
|---|---|
| SQLite schema | db/schema.ts |
| TypeScript interfaces | db/types.ts |
| Database provider | contexts/DatabaseProvider.tsx |
| Sync engine | services/sync-engine.ts |
| Storage abstraction | services/storage-provider.ts |
| SHA-256 hashing | utils/hash.ts |
| Audit logger | utils/audit.ts |
| UUID generator | utils/id.ts |
| i18n config | i18n/index.ts |
| EN translations | i18n/locales/en.json |
| DE translations | i18n/locales/de.json |
| Theme tokens | src/theme/index.ts |
| Icon mappings | src/theme/icons.ts |
| App config | app.json |
| Root layout + tab bar | app/_layout.tsx |
| Auth screen | src/screens/AuthScreen.tsx |
| Capture screen | src/screens/CaptureScreen.tsx |
| Home / object list | src/screens/HomeScreen.tsx |
| Object detail | src/screens/ObjectDetailScreen.tsx |
| Object list | src/screens/ObjectListScreen.tsx |
| Collections | src/screens/CollectionsScreen.tsx |
| Settings | src/screens/SettingsScreen.tsx |
| Export stepper modal | src/components/ExportStepperModal.tsx |
| Full-screen image viewer | src/components/ImageViewer.tsx |
| Brand logo component | src/components/AhaLogo.tsx |
| Export config hook | src/hooks/useExportConfig.ts |
| PDF template | src/templates/object-report.ts |
| Domain configs (museum) | src/config/domains/museum_collection.json |
| Domain configs (marketplace) | src/config/domains/aha_marketplace.json |
| Domain configs (general) | src/config/domains/general.json |
| Domain config index | src/config/domains/index.ts |
| Brand logo PNG | assets/images/register-logo.png |
| Edge Function: AI analysis | supabase/functions/analyze-object/index.ts |
| Edge Function: bg removal | supabase/functions/remove-background/index.ts |
| Edge Function: OCR | supabase/functions/ocr-enhance/index.ts |
| State of the Art index | docs/state-of-the-art/README.md |
| Data model doc | docs/aha-register-data-model-v1.1.docx |
| Migrations | docs/migrations/ |
| Decisions | docs/decisions/ |

---

## 12. Relationship to Marketplace

Register and the marketplace (arthausauction.com) are separate products under TEDE Holdings LLC. They share:
- Brand identity (aha!)
- Supabase as cloud backend (separate projects/schemas)
- Michael as founder and product owner
- Provenance as a core value proposition

They do NOT share:
- Codebase (separate repos: aha-register vs aha-auctions)
- Tech stack (Expo/React Native vs Next.js)
- Session rules (this document vs CLAUDE-SESSION-RULES-v9.1.md)
- Deployment (EAS Build vs Vercel)
- Domain (aharegister.com vs arthausauction.com)

When working on Register, do not reference marketplace code, patterns, or infrastructure. They are architecturally independent.
