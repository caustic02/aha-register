# Integrity Audit Report -- 2026-03-17

**Branch:** `audit/a11y-full-scan`
**Commit:** `c47a013`
**Auditor:** Claude Opus 4.6 (automated)
**Date:** 2026-03-17

---

## Phase 1: Build & Distribution

### 1. Native Directory Check (`git ls-files android/ ios/`)
**Status:** PASS
**Severity:** LOW
**Details:** No native `android/` or `ios/` files are tracked in git. Both directories are generated at build time by Expo CNG (Continuous Native Generation).
**File(s):** `.gitignore` lines 41-42 correctly contain `/android` and `/ios`.
**Fix:** None required.

### 2. .gitignore Verification
**Status:** PASS
**Severity:** LOW
**Details:** `.gitignore` correctly excludes `/android`, `/ios`, `node_modules/`, `.expo/`, `.env`, `.env*.local`, `dist/`, `web-build/`, `.DS_Store`, key/cert files (`*.pem`, `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision`).
**File(s):** `C:\ClaudeProject-Register\aha-register\.gitignore`
**Fix:** None required.

### 3. EAS Configuration
**Status:** PASS
**Severity:** LOW
**Details:** `eas.json` defines three build profiles (development, preview, production). Preview profile uses APK for Android and simulator for iOS, which is appropriate for internal testing. CLI version constraint `>= 3.0.0` is set.
**File(s):** `C:\ClaudeProject-Register\aha-register\eas.json`
**Fix:** None required.

### 4. App Configuration
**Status:** PASS
**Severity:** LOW
**Details:** `app.json` is well-structured. `expo-sqlite` uses `useSQLCipher: true` for database encryption. OTA updates are enabled via `expo-updates` with `checkAutomatically: "ON_LOAD"`. Runtime version matches app version `0.1.0`. Sentry plugin is present (source maps upload disabled). `expo-secure-store` plugin registered.
**File(s):** `C:\ClaudeProject-Register\aha-register\app.json`
**Fix:** None required.

### 5. Expo Doctor
**Status:** PASS
**Severity:** LOW
**Details:** `npx expo-doctor` passed all 17 checks with no issues detected. One informational warning about missing Sentry organization/project config (will use env vars at build time).
**File(s):** N/A
**Fix:** None required.

---

## Phase 2: Dependencies

### 6. npm audit
**Status:** PASS
**Severity:** LOW
**Details:** `npm audit` reports 0 vulnerabilities.
**File(s):** N/A
**Fix:** None required.

### 7. Non-Expo Package Review
**Status:** PASS
**Severity:** LOW
**Details:** All non-expo/non-@expo packages are appropriate:

| Package | Purpose | Expo Alternative? |
|---|---|---|
| `@react-native-async-storage/async-storage` | KV storage | No -- this IS Expo's recommended AsyncStorage |
| `@react-navigation/bottom-tabs` | Tab navigation | No -- standard React Navigation |
| `@react-navigation/native` | Navigation core | No -- standard React Navigation |
| `@react-navigation/native-stack` | Stack navigation | No -- standard React Navigation |
| `@sentry/react-native` | Error monitoring | No -- official Sentry SDK |
| `@supabase/supabase-js` | Backend client | No -- official Supabase SDK |
| `i18next` | Internationalization | No -- standard i18n library |
| `lucide-react-native` | Icon library | No -- design choice |
| `qrcode` | QR code generation | No -- no expo equivalent |
| `react` | React core | No |
| `react-i18next` | React i18n bindings | No |
| `react-native` | RN core | No |
| `react-native-safe-area-context` | Safe area handling | No -- required by Expo/Navigation |
| `react-native-screens` | Native screen containers | No -- required by Expo/Navigation |
| `react-native-svg` | SVG rendering | No -- this IS Expo's recommended SVG library |

No bare React Native packages have expo-* alternatives that should be used instead.
**File(s):** `C:\ClaudeProject-Register\aha-register\package.json`
**Fix:** None required.

### 8. Dependency Tree Health
**Status:** PASS
**Severity:** LOW
**Details:** `npm ls --depth=0` reports no deduped, invalid, or missing packages.
**File(s):** N/A
**Fix:** None required.

---

## Phase 3: Sacred Files

### 9. Schema / Types Alignment
**Status:** WARNING
**Severity:** MEDIUM
**Details:**

**Tables in `schema.ts` (16 tables):**
1. `institutions` -- Interface: `Institution` -- MATCH
2. `sites` -- Interface: `Site` -- MATCH
3. `users` -- Interface: `User` -- MATCH
4. `objects` -- Interface: `RegisterObject` -- MATCH
5. `media` -- Interface: `Media` -- MATCH (including migration columns: rights_holder, license_type, license_uri, usage_restrictions)
6. `annotations` -- Interface: `Annotation` -- MATCH
7. `vocabulary_terms` -- Interface: `VocabularyTerm` -- MATCH
8. `collections` -- Interface: `Collection` -- MATCH
9. `object_collections` -- Interface: `ObjectCollection` -- MATCH
10. `locations` -- Interface: `Location` -- MATCH
11. `documents` -- Interface: `RegisterDocument` -- MATCH (including migration columns: transcription, transcription_status)
12. `app_settings` -- Interface: `AppSetting` -- MATCH
13. `audit_trail` -- Interface: `AuditTrailEntry` -- MATCH
14. `sync_queue` -- Interface: `SyncQueueItem` -- MATCH
15. `persons` -- Interface: `Person` -- MATCH
16. `object_persons` -- Interface: `ObjectPerson` -- MATCH

**Issues found:**

1. **`media.sha256_hash` is nullable in schema** (line 84: `sha256_hash TEXT` with no NOT NULL). While code always computes the hash before insert, the schema does not enforce this. A direct SQL insert or future code path could omit the hash, breaking the tamper-evident chain.

2. **`documents.sha256_hash` is nullable in schema** (line 159: same issue). No document creation code path was found, so this is not currently exercised.

3. **`SyncStatus` type vs `Person.sync_status`:** The `SyncStatus` type (`'pending' | 'syncing' | 'failed'`) is used for `sync_queue.status`. The `Person.sync_status` field uses an inline union (`'pending' | 'synced' | 'error' | 'conflict'`), which correctly matches the CHECK constraint in schema.ts. These are intentionally different types for different tables -- no mismatch.

**File(s):**
- `C:\ClaudeProject-Register\aha-register\src\db\schema.ts` lines 84, 159
- `C:\ClaudeProject-Register\aha-register\src\db\types.ts` lines 189-209, 269-284
**Fix:** Add `NOT NULL` constraint to `media.sha256_hash` in a future migration. Consider adding a NOT NULL migration for `documents.sha256_hash` when document upload is implemented.

### 10. Secrets in Source
**Status:** PASS
**Severity:** CRITICAL (if failed)
**Details:**
- **`sk-`, `sk_live`, `sk_test`:** No matches in `src/` (.ts, .tsx files).
- **`eyJhb`, `supabase.*key`, `GEMINI`:** No matches in `src/` (.ts, .tsx files).
- **`.env` files in git history:** `git log --all --full-history --diff-filter=A -- "*.env" ".env*" ".env.local"` returned no results. No .env files have ever been committed.
- **Note:** `app/` and `lib/` directories do not exist in this project.

**File(s):** N/A
**Fix:** None required.

### 11. SHA-256 Capture Pipeline
**Status:** PASS
**Severity:** CRITICAL (if failed)
**Details:**

Two code paths create media records. Both compute SHA-256 BEFORE the database insert:

**Path 1: `createDraftObject()`** (`src/services/draftObject.ts`)
- Line 44: File copied to app storage
- Line 47: `const sha256 = await computeSHA256(destUri)` -- hash computed on copied file
- Line 86-102: INSERT INTO media with sha256 in values array
- Verdict: CORRECT -- hash before insert, inside transaction

**Path 2: `addMediaToObject()`** (`src/services/mediaService.ts`)
- Line 51: File copied to app storage
- Line 54: `const sha256 = await computeSHA256(destUri)` -- hash computed on copied file
- Line 76-96: INSERT INTO media with sha256 in values array
- Verdict: CORRECT -- hash before insert, inside transaction

**Hash implementation** (`src/utils/hash.ts`):
- Reads file as base64, decodes to raw bytes, then hashes with `Crypto.digest(SHA256, bytes)`
- Returns hex string -- correct implementation

**No code path skips hashing.** Both paths are wrapped in `db.withTransactionAsync()`, ensuring atomicity.

**File(s):**
- `C:\ClaudeProject-Register\aha-register\src\services\draftObject.ts` lines 44-102
- `C:\ClaudeProject-Register\aha-register\src\services\mediaService.ts` lines 51-96
- `C:\ClaudeProject-Register\aha-register\src\utils\hash.ts` lines 1-30
**Fix:** None required.

### 12. Edge Function JWT Verification
**Status:** PASS
**Severity:** CRITICAL (if failed)
**Details:**
- `supabase/functions/analyze-object/index.ts` lines 94-106: Creates a Supabase client with the request's Authorization header, calls `supabase.auth.getUser()`, and returns 401 if auth fails.
- `supabase/config.toml` line 4: `verify_jwt = true` -- Supabase will also enforce JWT at the gateway level.
- `--no-verify-jwt` search: Only found in documentation (`docs/state-of-the-art/AI-INTEGRATION.md`) where it explicitly states the function is deployed **without** this flag. No scripts or configs use it.

**File(s):**
- `C:\ClaudeProject-Register\aha-register\supabase\functions\analyze-object\index.ts` lines 93-106
- `C:\ClaudeProject-Register\aha-register\supabase\config.toml` line 4
**Fix:** None required.

---

## Phase 4: UI & Theme Compliance

### 13. Hardcoded Hex Colors
**Status:** PASS
**Severity:** LOW
**Details:** No hardcoded hex colors found in `src/screens/` or `src/components/` (.tsx files). All color values reference the `colors` theme tokens.
**File(s):** N/A
**Fix:** None required.

### 14. Hardcoded fontSize
**Status:** WARNING
**Severity:** MEDIUM
**Details:** 7 instances of hardcoded `fontSize:` values found outside the theme system:

| File | Line | Value | Context |
|---|---|---|---|
| `src/screens/CaptureScreen.tsx` | 905 | `fontSize: 64` | Checkmark emoji size |
| `src/screens/AIProcessingScreen.tsx` | 309 | `fontSize: 14` | Step label text |
| `src/screens/DevShowcase.tsx` | 225 | `fontSize: 20` | Showcase header |
| `src/screens/CollectionsScreen.tsx` | 228 | `fontSize: 48` | Empty state icon |
| `src/components/ImageGallery.tsx` | 178 | `fontSize: 48` | Empty state icon |
| `src/components/ui/Badge.tsx` | 66 | `fontSize: 12` | Badge text |
| `src/components/ui/TextInput.tsx` | 127 | `fontSize: 16` | Input text |

The Badge and TextInput values match theme tokens (`typography.caption.fontSize` = 12, `typography.body.fontSize` = 16) but reference them as raw numbers instead of via theme. CaptureScreen's `fontSize: 64` and the `48` values are used for emoji/icon sizing which may be intentional.

**File(s):** Listed above
**Fix:** Replace hardcoded values with theme token references: `typography.caption.fontSize`, `typography.body.fontSize`, `typography.bodySmall.fontSize`, `typography.h3.fontSize`. For emoji sizing (48, 64), consider adding a `typography.icon` or `typography.iconLg` token.

### 15. Hardcoded borderRadius
**Status:** WARNING
**Severity:** LOW
**Details:** 6 instances of hardcoded `borderRadius:` values found:

| File | Line | Value | Context |
|---|---|---|---|
| `src/screens/ReviewCardScreen.tsx` | 488 | `borderRadius: 0` | Image with no rounding |
| `src/screens/ObjectDetailScreen.tsx` | 480 | `borderRadius: 0` | Image with no rounding |
| `src/screens/CaptureScreen.tsx` | 699 | `borderRadius: 1` | Level indicator bar |
| `src/screens/CaptureScreen.tsx` | 802 | `borderRadius: 38` | Shutter button (width/2) |
| `src/screens/CaptureScreen.tsx` | 815 | `borderRadius: 28` | Shutter inner (width/2) |
| `src/screens/AIProcessingScreen.tsx` | 316 | `borderRadius: 4` | Progress bar |

`borderRadius: 0` is intentional (full-bleed images). `borderRadius: 38` and `28` are derived from element dimensions (width/2 for circles). `borderRadius: 1` is a hairline radius. Only `borderRadius: 4` in AIProcessingScreen is a true theme violation (should use `radii.sm` = 6).

**File(s):** Listed above
**Fix:** Replace `borderRadius: 4` in AIProcessingScreen with `radii.sm`. The circular shutter button radii are computed from dimensions and are acceptable as-is.

---

## Phase 5: i18n & Git Hygiene

### 16. Hardcoded English Strings in Screens
**Status:** WARNING
**Severity:** HIGH
**Details:** Multiple screens contain hardcoded English strings instead of using i18n translation keys. Major offenders:

**`src/screens/ReviewCardScreen.tsx`** (most severe -- ~30+ hardcoded strings):
- Line 212: `"AI Analysis"`
- Line 217: `"Title"`, line 223: `"Object type"`, line 229: `"Medium"`
- Line 250: `"Object details"`, line 260: `"Object title"` (placeholder)
- Line 277: `"Date created"`, line 301: `"Dimensions"`
- Line 341: `"Description"`, line 346: `"Object description"` (placeholder)
- Line 363: `"Condition"`, line 368: `"Visible condition notes"` (placeholder)
- Line 378: `"Artists"`, line 389: `"Unknown artist"`
- Line 408: `"Keywords"`
- Line 428: `"Save to collection"`, line 436: `"Discard"`
- Lines 38-51: Object type labels (`"Painting"`, `"Sculpture"`, etc.)
- Lines 72, 133, 135: Status text (`"Not available"`, `"High confidence"`, `"Review suggested"`)

**`src/screens/AIProcessingScreen.tsx`** (~8 hardcoded strings):
- Lines 40-44: Step labels (`"Securing capture"`, `"Analyzing image"`, etc.)
- Line 138, 169: `"Analysis failed"` (error fallback)
- Line 219: `"Try again"`

**`src/screens/DevShowcase.tsx`** (~30+ hardcoded strings):
- All labels, badge text, metadata values are hardcoded. This is a dev showcase screen, so the severity is lower, but it still sets a bad precedent.

**`src/screens/SettingsScreen.tsx`**:
- Lines 67-68: Language labels (`'English'`, `'Deutsch'`) -- these are intentionally in their native language, PASS.

**File(s):**
- `C:\ClaudeProject-Register\aha-register\src\screens\ReviewCardScreen.tsx`
- `C:\ClaudeProject-Register\aha-register\src\screens\AIProcessingScreen.tsx`
- `C:\ClaudeProject-Register\aha-register\src\screens\DevShowcase.tsx`
**Fix:** Extract all user-facing strings to `src/i18n/locales/en.json` and `de.json`. Priority: ReviewCardScreen (production screen), then AIProcessingScreen. DevShowcase can be deferred.

### 17. EN vs DE Key Parity
**Status:** PASS
**Severity:** LOW
**Details:** Both locale files have exactly **564 leaf keys** with perfect 1:1 key parity. No missing or extra keys in either locale.
**File(s):**
- `C:\ClaudeProject-Register\aha-register\src\i18n\locales\en.json`
- `C:\ClaudeProject-Register\aha-register\src\i18n\locales\de.json`
**Fix:** None required.

### 18. Tracked Files That Should Be Gitignored
**Status:** PASS
**Severity:** LOW
**Details:** No `.env`, `node_modules`, `.DS_Store`, `Thumbs.db`, or `.expo/` files are tracked in git.
**File(s):** N/A
**Fix:** None required.

### 19. Windows `nul` File Check
**Status:** PASS
**Severity:** LOW
**Details:** No `nul` file found in the git index.
**File(s):** N/A
**Fix:** None required.

### 20. console.log Audit
**Status:** WARNING
**Severity:** MEDIUM
**Details:** 18 `console.log` statements found in `src/`. Analysis:

**SAFE (guarded by `__DEV__`):**
- `src/sync/engine.ts` lines 64, 70, 76, 82, 92, 99, 103, 125, 134 -- all sync status messages, `__DEV__` guarded
- `src/services/sync-transport.ts` lines 142, 157, 272 -- all `__DEV__` guarded

**SAFE (operational):**
- `src/utils/db-migration-encrypt.ts` line 139 -- logs row count during migration, no sensitive data

**SAFE (placeholder/TODO):**
- `src/screens/ObjectDetailScreen.tsx` line 138 -- `console.log('Edit not yet implemented')` -- no data
- `src/screens/ReviewCardScreen.tsx` line 172 -- `console.log('Discard pressed')` -- no data
- `src/screens/SettingsScreen.tsx` lines 577, 608 -- `console.log('Export all: not yet implemented')`, `console.log('Licenses: not yet implemented')` -- no data

**FLAGGED -- Logs user data including coordinates:**
- `src/screens/ReviewCardScreen.tsx` lines 152-166 -- `console.log('Save pressed', { title, objectType, ..., captureMetadata, imageUri, artists })` -- **logs capture metadata containing latitude, longitude, altitude, and the image URI**. This is user data and GPS coordinates logged to the console in production builds.

**File(s):**
- `C:\ClaudeProject-Register\aha-register\src\screens\ReviewCardScreen.tsx` lines 152-166
**Fix:** Either remove the console.log on line 152 entirely, wrap it in `if (__DEV__)`, or replace with a Sentry breadcrumb that excludes coordinate data.

---

## Summary Table

| # | Check | Status | Severity |
|---|---|---|---|
| 1 | Native directory check | PASS | LOW |
| 2 | .gitignore verification | PASS | LOW |
| 3 | EAS configuration | PASS | LOW |
| 4 | App configuration | PASS | LOW |
| 5 | Expo Doctor | PASS | LOW |
| 6 | npm audit | PASS | LOW |
| 7 | Non-Expo package review | PASS | LOW |
| 8 | Dependency tree health | PASS | LOW |
| 9 | Schema / Types alignment | WARNING | MEDIUM |
| 10 | Secrets in source | PASS | CRITICAL |
| 11 | SHA-256 capture pipeline | PASS | CRITICAL |
| 12 | Edge function JWT verification | PASS | CRITICAL |
| 13 | Hardcoded hex colors | PASS | LOW |
| 14 | Hardcoded fontSize | WARNING | MEDIUM |
| 15 | Hardcoded borderRadius | WARNING | LOW |
| 16 | Hardcoded English strings | WARNING | HIGH |
| 17 | EN vs DE key parity | PASS | LOW |
| 18 | Tracked files hygiene | PASS | LOW |
| 19 | Windows nul file | PASS | LOW |
| 20 | console.log audit | WARNING | MEDIUM |

**Overall: 15 PASS, 5 WARNING, 0 FAIL**

### Priority Action Items

1. **HIGH** -- Internationalize `ReviewCardScreen.tsx` and `AIProcessingScreen.tsx` (Check #16)
2. **MEDIUM** -- Guard or remove `console.log` in `ReviewCardScreen.tsx` line 152 that leaks GPS coordinates (Check #20)
3. **MEDIUM** -- Add `NOT NULL` constraint to `media.sha256_hash` in a future migration (Check #9)
4. **MEDIUM** -- Replace hardcoded `fontSize` values with theme tokens (Check #14)
5. **LOW** -- Replace `borderRadius: 4` with `radii.sm` in AIProcessingScreen (Check #15)
