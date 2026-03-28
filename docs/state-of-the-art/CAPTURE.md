# State of the Art: Capture System

> Last updated: 2026-03-28
> Status: ACTIVE

## Quick-ID Pre-Capture (added 2026-03-28)

New `QuickIDScreen` (`src/screens/QuickIDScreen.tsx`) sits before `CaptureScreen` in the capture flow. Museum registrars enter title (Bezeichnung) and optional accession number (Inventarnummer) before photographing. The object record is created in SQLite with `status: 'draft'` before the camera opens.

When `objectId` is passed to `CaptureScreen`, a green title pill replaces the domain pill in the camera top bar, confirming which object the user is documenting.

Skip path preserved: users who prefer capture-first can skip QuickID and get the existing anonymous-capture behavior.

## What This Is
The capture system is Register's core differentiator. It records objects/sites/incidents with SHA-256 tamper-evidence hashing at the moment of photo capture. This makes Register records legally admissible under the Berkeley Protocol and ICC standards.

## Architecture

### Phase State Machine
`CaptureScreen` drives the entire flow through a typed `Phase` union:

```
idle → extracting → preview → type_select → saving → done
```

- **idle**: Live `CameraView` (expo-camera). Flash off/on/auto cycles and is persisted to `app_settings`. Aspect ratio toggles 4:3 ↔ 1:1 (1:1 shows crop guide bars). Front/back camera toggle.
- **extracting**: `extractMetadata()` and `computeSHA256()` run in parallel via `Promise.all`. Default object type is also loaded from settings in this same parallel call.
- **preview**: Shows captured image, GPS coordinates (with source label), timestamp, dimensions, and first 16 chars of SHA-256 hash.
- **type_select**: `TypeSelector` component lets user pick one of 7 object types. "Skip" falls back to `SETTING_KEYS.DEFAULT_OBJECT_TYPE` or `'museum_object'`.
- **saving**: `createDraftObject()` runs the 6-step database transaction (see below).
- **done**: Shows object UUID prefix and navigation to Objects list or "Capture Another".

**Quick mode bypasses** the extracting → preview → type_select → saving → done phases entirely. The shutter fires `quickCapture()` in background and the camera stays in `idle`.

### Image Acquisition
Two entry points, both return `CaptureResult`:
- **Camera** (`expo-camera` `CameraView`): `takePictureAsync({ quality: 1, exif: true })`
- **Library** (`expo-image-picker`): `launchImageLibraryAsync({ quality: 1, exif: true, allowsMultipleSelection: true, selectionLimit: 10 })` — only first image used in capture flow

### Metadata Extraction (`services/metadata.ts`)
1. Reads `GPSLatitude` / `GPSLongitude` / `GPSAltitude` from EXIF → `coordinateSource: 'exif'`
2. If no EXIF GPS: calls `Location.getCurrentPositionAsync({ accuracy: Accuracy.High })` → `coordinateSource: 'gps_hardware'`
3. Timestamp from `DateTimeOriginal` or `DateTime` EXIF field (converts `YYYY:MM:DD HH:MM:SS` → ISO 8601). Falls back to `new Date().toISOString()`.
4. Device model: `Platform.OS + ' device'`. OS version: `Platform.OS + Platform.Version`.

### SHA-256 Hashing (`utils/hash.ts`)
Uses `expo-crypto` `Crypto.digest` (NOT `digestStringAsync`). Critical implementation detail:
1. Reads file via `expo-file-system` `File.base64()`
2. Decodes base64 → `Uint8Array` raw bytes via `atob()`
3. Hashes raw bytes — output matches `sha256sum` / `openssl dgst` on the same file
4. Returns lowercase hex string

The hash is computed **twice**: once at preview (on original URI) and once inside `createDraftObject` after copying to app storage. The stored media record uses the post-copy hash.

### Database Transaction (`services/draftObject.ts`)
All 6 steps run inside `db.withTransactionAsync` — any failure rolls back the entire capture:

1. **Copy image** to `{Paths.document}/media/{mediaId}.{ext}` (creates directory if needed)
2. **Recompute SHA-256** on the stored copy at `destUri`
3. **Read** `SETTING_KEYS.DEFAULT_PRIVACY_TIER` from `app_settings` (defaults to `'public'`)
4. **INSERT into `objects`**: status=`'draft'`, title=`'Untitled'`, object_type from TypeSelector (or default), all GPS fields, coordinate_source, privacy_tier, legal_hold=0
5. **INSERT into `media`**: SHA-256 hash, is_primary=1, sort_order=0, file_path to stored copy
6. **INSERT into `audit_trail`** via `logAuditEntry`: action=`'insert'`, userId resolved from auth session (falls back to `'local'` offline), newValues includes objectId/mediaId/sha256, deviceInfo includes model/os/app version
7. **INSERT into `sync_queue`** via `SyncEngine.queueChange('objects', objectId, 'insert', ...)`

### Settings Persistence
Three settings keys used during capture:
- `SETTING_KEYS.CAMERA_FLASH_MODE` — persisted on every flash toggle
- `SETTING_KEYS.DEFAULT_OBJECT_TYPE` — read at `extracting` phase
- `SETTING_KEYS.DEFAULT_PRIVACY_TIER` — read inside `createDraftObject`

### First-Run Intro Overlay
Shown when `AsyncStorage` key `capture_intro_dismissed` is absent or not `'true'`. Dismissed state written to `AsyncStorage` (not SQLite — survives app reinstall on device backup).

## Key Tables

| Table | Role |
|-------|------|
| `objects` | Core record — UUID, type, status, GPS, privacy tier, timestamps |
| `media` | Photo file record — path, SHA-256 hash, mime type, is_primary flag |
| `audit_trail` | Immutable insert log with device info and evidence context |
| `sync_queue` | Queues the new object for cloud sync |
| `app_settings` | Reads default privacy tier, default object type, flash preference |

## Key Files

| File | Purpose |
|------|---------|
| `src/screens/CaptureScreen.tsx` | Phase state machine, camera UI, all user interactions |
| `src/services/capture.ts` | expo-camera and expo-image-picker wrappers; returns `CaptureResult` |
| `src/services/metadata.ts` | EXIF parsing, GPS fallback to hardware, device/OS info |
| `src/services/draftObject.ts` | 6-step atomic DB transaction: copy → hash → insert → audit → sync |
| `src/services/quickCapture.ts` | Quick-capture: minimal fire-and-forget persist (B2) |
| `src/services/captureHelpers.ts` | Shared file-copy and type-normalisation utilities (B2) |
| `src/services/objectService.ts` | `saveReviewedObject`, `updateReviewedObject`, `updateReviewStatus` |
| `src/utils/hash.ts` | SHA-256 over raw file bytes (not base64 string) |
| `src/db/audit.ts` | `logAuditEntry` / `getAuditHistory` helpers |
| `src/components/TypeSelector.tsx` | Post-preview object type picker UI |

## Decision History

| Date | Decision | Reference |
|------|----------|-----------|
| 2026-03-08 | Hash raw bytes, not base64 string | SHA-256 integrity fix commit |
| 2026-03-09 | Friendly error mapping for RLS errors | Device testing bug fixes |
| 2026-03-09 | Type selector shown post-preview, not pre-capture | Capture flow UX commit |
| 2026-03-15 | Audit trail userId: param > auth session > 'local' fallback | Gap fix |
| 2026-03-18 | B2 non-blocking capture: Quick/Full mode toggle, quickCapture service, capture inbox, review flow | B2 feature sprint |
| 2026-03-21 | Hide camera controls during protocol capture; move progress pill to left of topBar | Layout fix — device testing |
| 2026-03-21 | Auto-title + title input on protocol save; quickCapture default changed from "Untitled" to "Untitled Object" | Title UX fix — demo readiness |

## Protocol Object Titling

Objects created via protocol capture use a three-layer title strategy:

1. **Layer 1 — Auto-title from AI analysis**: If Gemini analysis has already run on any photo in the session, the AI-suggested title is pre-filled. (Currently N/A — protocol capture does not trigger AI analysis, but the plumbing supports it if added later.)
2. **Layer 2 — Title input on save**: `CompletionSummary` shows an inline `TextInput` ("Name this object") above the action bar. Pre-fills with `initialTitle` prop if available. User can type a title or leave empty.
3. **Layer 3 — Fallback**: If the user saves without typing, the title defaults to `t('protocols.untitled_object_fallback')` → "Untitled Object" (EN) / "Unbenanntes Objekt" (DE).

The title is persisted via `UPDATE objects SET title = ? WHERE id = ?` in the `onSave` callback in `CaptureScreen.tsx`, immediately before navigating to `ObjectDetail`.

### i18n Keys (protocols namespace)
- `object_title_prompt` — label above input
- `object_title_placeholder` — placeholder text
- `untitled_object_fallback` — empty-input fallback title

## Camera Enhancements

### Rule-of-Thirds Grid Overlay

Toggle-able grid on the live camera viewfinder. Divides the frame into 9 equal sections using two horizontal and two vertical lines (`rgba(255,255,255,0.3)`, `StyleSheet.hairlineWidth`). When grid is ON, a 32×32dp center crosshair is also rendered. Default: OFF.

- **Persistence:** `AsyncStorage` key `camera.gridEnabled` (`'true'`/`'false'`)
- **Toggle:** Grid button in top controls row (`GridIcon` / `Grid3x3` from lucide-react-native)
- **Overlay layer:** `zIndex: 5`, `pointerEvents="none"` — touches pass through

### Level Indicator

A 40×2dp animated horizontal bar at the bottom of the viewfinder (above bottom controls). Reads device tilt from `expo-sensors` `Accelerometer` (update interval: 150ms).

- **Level (±2°):** Bar color = `rgba(45,90,39,0.85)` (brand green with 85% opacity)
- **Tilted:** Bar color = `rgba(255,255,255,0.5)`, rotates up to ±15° (clamped) via `Animated.spring` with native driver
- **Implementation:** `tiltAnim` (`Animated.Value`) drives a `rotate` transform. A separate `isLevel` boolean state drives the color (native driver can't animate colors).

### Session Photo Count Badge

A small pill-shaped badge (top-left of camera view, below top controls) showing how many objects have been successfully saved in the current camera session. Hidden when count = 0.

- Background: `rgba(0,0,0,0.55)` / white text / `radii.full` border radius
- Incremented in `handleSave` after `setSavedId` (on successful `createDraftObject`)
- Resets to 0 only when the component unmounts (navigating away from Capture tab)

### Protocol Capture Layout

When a capture protocol is active (`protocolHook.protocol` is non-null), the default camera controls bar (Flash | Ratio | Flip | Grid) is hidden. The `CaptureGuidanceOverlay` replaces the top-of-screen controls during guided capture. Controls reappear when no protocol is active.

- **Hide condition:** `{!protocolHook.protocol && <View style={styles.topControls}>…</View>}` — conditional render in `CaptureScreen.tsx`
- **Why:** The controls bar (`zIndex: 10`) rendered on top of the overlay (`zIndex: 8`) and competed visually with the protocol guidance UI
- **Progress pill position:** Moved to the **left** side of the `topBar` (pill first, then protocol name), so it does not compete with any top-right navigation elements. Protocol name is right-aligned and flex-fills remaining space.

### Flash Control

Existing text/emoji-based flash toggle (`⚡`). Cycles `off → on → auto → off`. Flash mode persisted in `SETTING_KEYS.CAMERA_FLASH_MODE` (SQLite). i18n keys: `capture.flash_off`, `capture.flash_on`, `capture.flash_auto`.

## AI Review & Save Flow (CaptureStack → ReviewCardScreen)

After AI analysis (or skip-AI), the user lands on `ReviewCardScreen` with editable AI-prefilled metadata. The save flow:

### Save Steps (`saveReviewedObject` in `services/objectService.ts`)

1. **Copy image** to `{Paths.document}/media/{mediaId}.{ext}`
2. **Compute SHA-256** on the stored copy (SACRED: hash precedes all DB writes)
3. **Read** default privacy tier from `app_settings`
4. **Build** `type_specific_data` JSON from AI metadata (medium, dimensions, style, culture, condition, keywords)
5. **Transaction** (all-or-nothing):
   - INSERT into `objects`: title, description, object_type, GPS fields, type_specific_data, status='draft'
   - INSERT into `media`: SHA-256 hash, is_primary=1, file_path to stored copy
   - INSERT into `audit_trail`: action='insert', newValues includes sha256, deviceInfo
   - INSERT into `sync_queue` via SyncEngine
6. **(Optional)** `addObjectToCollection` — only if user selected a collection; failure does not block save

### Collection Picker

`ReviewCardScreen` includes a `@gorhom/bottom-sheet` collection picker:
- Lists all existing collections with type badge and object count
- Inline "Create new" row: TextInput + Create button → creates collection and selects it
- Empty state prompts user to type a name
- Collection is OPTIONAL — objects are always saved even without a collection
- Selected collection shown as a card with remove (✕) action

### Post-Save Navigation

After successful save, the CaptureStack wrapper:
1. Resets CaptureStack to `CaptureCamera` (prevents back-swipe to stale ReviewCard)
2. Navigates to `Home` tab → `ObjectDetail` screen with the new objectId

### Hash Integrity Guarantee

The SHA-256 hash is computed on the **stored copy** of the image file (not the original URI) at step 2, **before** the database transaction begins at step 5. The hash value stored in the `media` table matches `sha256sum` / `openssl dgst` on the stored file.

## Domain-Aware AI Analysis

The Gemini analysis prompt is selected based on the user's collection domain setting (`useSettings().collectionDomain`). The domain flows through the full chain:

```
SettingsScreen → useSettings hook → CaptureStack → AIProcessingScreen → ai-analysis.ts → Edge Function → Gemini
```

### Domain Prompt Templates

| Domain | System Prompt Focus |
|--------|-------------------|
| `museum_collection` | Museum registrar. AAT terminology, precise material/technique, dating with reasoning, condition vocabulary, artist attribution |
| `conservation_lab` | Conservation specialist. Detailed material layers, cracking/flaking/losses, environmental damage, treatment-relevant technique analysis |
| `human_rights` | Berkeley Protocol investigator. Objective physical description only, visible markings/text, no speculation on provenance or attribution |
| `archaeological_site` | Archaeologist. Typological classification, fabric/ware identification, manufacture indicators, stratigraphic observations |
| `natural_history` | Specimen specialist. Taxonomic identification, preservation state, morphological features, scientific nomenclature |
| `general` | Generic analysis. Balanced coverage of all fields without domain-specific vocabulary depth |

### Data Flow

1. `CaptureStack.AIProcessingWrapper` reads `collectionDomain` from `useSettings()` hook
2. Passes `domain` prop to `AIProcessingScreen`
3. `AIProcessingScreen` calls `analyzeObject(base64, mimeType, domain)`
4. `ai-analysis.ts` includes `domain` in the Edge Function request body
5. Edge Function selects `DOMAIN_PROMPTS[domain]` and `DOMAIN_USER_PROMPTS[domain]`
6. Gemini receives domain-specific system instruction and user prompt
7. Response JSON schema is consistent across all domains (same `AIAnalysisResult` type)

### Key Files

| File | Role |
|------|------|
| `supabase/functions/analyze-object/index.ts` | 6 domain-specific system prompts + user prompts |
| `src/services/ai-analysis.ts` | `analyzeObject(base64, mime, domain)` — passes domain to Edge Function |
| `src/screens/AIProcessingScreen.tsx` | Accepts `domain` prop, passes to `analyzeObject` |
| `src/navigation/CaptureStack.tsx` | Reads `collectionDomain` from settings, passes to AIProcessingScreen |
| `src/hooks/useSettings.ts` | `CollectionDomain` type and AsyncStorage persistence |

---

## Quick Capture Mode (B2)

The camera has two modes, toggled by a segmented pill above the shutter button. Mode is persisted in `AsyncStorage` key `capture.mode`. Default: `'quick'`.

### Quick Mode (field work)

Tap shutter → 150ms white flash overlay → `quickCapture()` fires in background → camera stays live → thumbnail appears in strip.

- **No blocking**: the camera never leaves `idle` phase. No preview, no type selection, no AI.
- **Fire-and-forget**: `quickCapture()` runs as an async IIFE. Errors show a 3-second red toast; the camera is never blocked.
- **Shutter flash**: `Animated.Value` opacity 0→0.8→0 in 150ms. Respects `AccessibilityInfo.isReduceMotionEnabled()`.
- **Thumbnail strip**: horizontal `ScrollView` at bottom of camera, 52×52 rounded thumbnails (newest on right). Tapping navigates to `ObjectDetail`. Count badge: "3 captured".
- **Session state**: thumbnails and count are session-only (`useState`), not DB queries. Cleared on unmount.

### Full Mode (single careful captures)

Tap shutter → existing full flow: `extracting → preview → type_select → saving → done`. No changes from the pre-B2 flow.

### quickCapture Service (`services/quickCapture.ts`)

Minimal-metadata persist: copy → SHA-256 → single atomic transaction.

1. Generate UUIDs for object and media
2. `copyToMediaStorage()` — copies image to `{Paths.document}/media/{mediaId}.jpg`
3. `computeSHA256()` on stored copy — **SACRED: before any DB write**
4. Read `DEFAULT_PRIVACY_TIER` from `app_settings`
5. Single `db.withTransactionAsync`:
   - INSERT `objects`: `object_type='uncategorized'`, `review_status='needs_review'`, `title='Untitled'`
   - INSERT `media`: SHA-256 hash, `is_primary=1`, file_path to stored copy
   - INSERT `audit_trail`: `action='quick_capture'`
   - INSERT `sync_queue`
6. Return object ID

### Shared Helpers (`services/captureHelpers.ts`)

Extracted from duplicated code in `draftObject.ts` and `objectService.ts`:
- `copyToMediaStorage(sourceUri, mediaId, mimeType)` → returns `destUri`
- `buildStorageName(mediaId, mimeType)` → returns filename string
- `normalizeFileType(mimeType)` → `'image' | 'video' | 'audio' | 'document'`

---

## Review Flow (B2)

Quick-captured objects have `review_status = 'needs_review'` and `object_type = 'uncategorized'`. The review flow lets users add full metadata later.

### Capture Inbox (HomeScreen)

- First section on HomeScreen, only rendered when `needs_review` count > 0
- Queries `objects WHERE review_status = 'needs_review' ORDER BY created_at DESC` joined with `media` for thumbnails
- Horizontal 52×52 thumbnail row with amber dot indicators (`statusWarning`, 8dp circle)
- "Review all" navigates to `ObjectListScreen` with `filterReviewStatus: 'needs_review'` route param
- Tapping a thumbnail navigates to `ObjectDetailScreen`

### Review Banner (ObjectDetailScreen)

When `object.review_status !== 'complete'`, an amber banner appears below the gallery:
- `WarningIcon` + "This object needs review" + description text
- "Start review" CTA button

### Review Status Lifecycle

```
needs_review → in_review → complete
                 ↓
              needs_review  (if user backs out)
```

- `needs_review → in_review`: user taps "Start review" on ObjectDetailScreen
- `in_review → complete`: `updateReviewedObject()` succeeds via ReviewCardScreen save
- `in_review → needs_review`: user discards from ReviewCardScreen

Each transition logged in `audit_trail` via `updateReviewStatus()`.

### updateReviewedObject (`services/objectService.ts`)

Updates an existing quick-captured object with full metadata. Does **NOT** copy the image or recompute the hash (sacred from quick capture).

1. Build `type_specific_data` JSON from review metadata
2. Single `db.withTransactionAsync`:
   - UPDATE `objects` SET title, object_type, description, type_specific_data, `review_status='complete'`
   - INSERT `audit_trail`: `action='review_complete'`
   - INSERT `sync_queue`: `action='update'`

### Navigation Wiring

"Start review" reads the existing media's base64 and navigates to `CaptureStack.AIProcessing` with `existingObjectId` param. This threads through:
1. `AIProcessingWrapper` → passes `existingObjectId` to `ReviewCard` route
2. `ReviewCardWrapper` → if `existingObjectId` present, discard reverts to `needs_review`
3. `ReviewCardScreen` → if `existingObjectId` present, calls `updateReviewedObject` (UPDATE) instead of `saveReviewedObject` (INSERT)

### Key Files (B2 additions)

| File | Purpose |
|------|---------|
| `src/services/quickCapture.ts` | `quickCapture()` — minimal fire-and-forget persist |
| `src/services/captureHelpers.ts` | Shared file-copy and type-normalisation utilities |
| `src/services/objectService.ts` | `updateReviewedObject()`, `updateReviewStatus()` |
| `src/screens/CaptureScreen.tsx` | Quick/Full mode toggle, shutter flash, thumbnail strip |
| `src/screens/HomeScreen.tsx` | Capture inbox section |
| `src/screens/ObjectDetailScreen.tsx` | Review banner + "Start review" handler |

---

## Object Isolation — Background Removal (B1)

Removes the background from a captured object photo, creating a derivative PNG. The original photo and its SHA-256 hash are **NEVER** modified.

### Derivative Model

- Derivatives are linked to originals via `parent_media_id` (FK to `media.id`)
- Column `media_type` distinguishes: `'original'` (default) vs `'derivative_isolated'`
- Derivatives have **no SHA-256 hash** — they are presentation assets, not evidence
- The `sha256_hash` field is set to `''` (empty string) for derivatives

### Isolation Service (`services/isolationService.ts`)

`isolateObject(db, objectId, mediaId)` → `{ derivativeId, filePath } | null`

1. Read original media record → `file_path`
2. Read image file → base64
3. Network check via `expo-network` — throws `'OFFLINE'` if no connectivity
4. Auth token (3-tier: cached → refresh → anonymous)
5. Call `remove-background` Edge Function (remove.bg API)
6. Save returned PNG to `{Paths.document}/media/{derivativeId}.png`
7. Transaction: INSERT derivative media (`media_type='derivative_isolated'`, `parent_media_id`) + audit (`action='background_removed'`) + sync queue

### Edge Function (`supabase/functions/remove-background/`)

- POST with `{ imageBase64, mimeType }`, JWT-validated
- Calls `https://api.remove.bg/v1.0/removebg` with `image_file_b64`, `size=auto`, `format=png`
- Env var: `REMOVE_BG_API_KEY`
- Returns `{ resultBase64, mimeType: 'image/png' }`

### Compare View (`screens/IsolationCompareScreen.tsx`)

Full-screen modal (`fullScreenModal` presentation in HomeStack) with three phases:

- **Processing**: original image with animated pulse overlay (opacity 0.3↔0.6). Respects `reduceMotion`.
- **Error**: "Try again" / "Cancel" buttons. Offline-specific message.
- **Compare**: crossfade toggle between Original / Isolated (200ms `Animated.timing`). Dark background (`rgba(0,0,0,0.95)`) for image clarity. "Discard" / "Keep" actions.

**Discard** cleanup: deletes derivative file from filesystem → `DELETE FROM media WHERE id = ?` → audit entry (`isolation_discarded`).

### Entry Points

1. **ObjectDetailScreen**: Scissors icon in action bar. Hidden when no original media exists or derivative already exists (no duplicate isolation).
2. **ReviewCardScreen**: Same button when reviewing an existing object (`existingObjectId` present).

After returning from a successful isolation, ObjectDetailScreen reloads via `useFocusEffect` and shows the derivative in the media gallery.

### Key Files (B1)

| File | Purpose |
|------|---------|
| `src/services/isolationService.ts` | `isolateObject()` — network check → Edge Function → save derivative |
| `supabase/functions/remove-background/index.ts` | remove.bg API proxy with JWT auth |
| `src/screens/IsolationCompareScreen.tsx` | Processing → Compare → Keep/Discard flow |
| `src/screens/ObjectDetailScreen.tsx` | Isolate button entry point |

---

## Decision History

| Date | Decision | Reference |
|------|----------|-----------|
| 2026-03-18 | B1: remove.bg chosen for background removal (cloud API, no on-device model) | B1 architecture decision |
| 2026-03-18 | B1: derivatives have no SHA-256 hash — presentation assets, not evidence | B1 integrity rule |
| 2026-03-18 | B1: original media file and hash are never read, modified, or referenced during isolation | B1 integrity rule |

---

## Review Form Structure (B4)

`ReviewCardScreen` organises its metadata fields into four collapsible `FormSection` wrappers, replacing the previous flat layout.

### Sections

| Section key | Icon | Default state | Required fields |
|-------------|------|---------------|-----------------|
| `identification` | `TagIcon` (Tag) | **Expanded** | title, object type |
| `physical` | `RulerIcon` (Ruler) | **Expanded** | — |
| `classification` | `LayersIcon` (Layers) | Collapsed | — |
| `condition` | `ConditionIcon` (ShieldCheck) | Collapsed | — |

### Collapsing Behaviour

- `expanded` + `onToggle` props are managed by `expandedSections` state in `ReviewCardScreen`.
- Each section header shows an AI count badge (`aiFieldCount`) when ≥1 AI-suggested fields are visible inside it.
- Toggle drives `LayoutAnimation.configureNext(easeInEaseOut)` for content and `Animated.timing` (200ms, native driver) for the chevron rotation. Both are skipped when `AccessibilityInfo.isReduceMotionEnabled()` returns true.

### Inline Validation

Triggered on "Save" before any async work:

```ts
if (!title.trim())         errors.title = t('validation.titleRequired');
if (!objectTypeSel.label)  errors.objectType = t('validation.objectTypeRequired');
```

If any error exists:
1. `identification` section is force-expanded.
2. `scrollRef.current?.scrollTo({ y: 0, animated: true })` scrolls to top.
3. Error text below the field renders with `accessibilityRole="alert"`.

### AI Badges

Each AI-prefilled field renders `<AIFieldBadge visible confidence={n} />` inline next to its label (see Design System → AIFieldBadge).

### Key Files (B4)

| File | Purpose |
|------|---------|
| `src/components/FormSection.tsx` | Collapsible section wrapper with icon, title, AI count, animated chevron |
| `src/components/AIFieldBadge.tsx` | Inline confidence pill for AI-suggested field values |
| `src/screens/ReviewCardScreen.tsx` | Hosts 4 FormSections + expanded state + inline validation |

### Decision History

| Date | Decision |
|------|----------|
| 2026-03-18 | B4: Flat form → 4 collapsible FormSections; Identification + Physical open by default |
| 2026-03-18 | B4: Inline validation on Save (not on blur) to avoid interrupting AI prefill review |

---

## Document Scanning (C1)

Native document scanning with on-device OCR. The scanner provides edge detection, corner handles, and perspective correction via platform-native APIs.

### Scanner

`react-native-document-scanner-plugin` wraps:
- **Android**: Google ML Kit Document Scanner API
- **iOS**: Apple VisionKit

`launchDocumentScanner()` opens the native scanner UI (separate from `expo-camera`). Returns the deskewed image URI on success, or `null` if the user cancels.

### Storage Model

Two media records per scan, following the same derivative pattern as B1 isolation:

| Record | `media_type` | `sha256_hash` | `parent_media_id` |
|--------|-------------|---------------|-------------------|
| Raw scan | `'document_scan'` | Computed (evidence) | `NULL` |
| Deskewed | `'document_deskewed'` | `''` (empty — presentation) | Raw scan ID |

Both records are inserted in a single `db.withTransactionAsync` along with audit trail and sync queue entries.

### On-Device OCR

`extractTextOnDevice()` runs `rn-mlkit-ocr` (Google ML Kit, Expo config plugin) on the deskewed image. Results are stored on the **raw scan** media record (not the derivative):

```
media.ocr_text       = extracted text
media.ocr_confidence = 0–100 score
media.ocr_source     = 'on_device'
```

### Cloud OCR Upgrade (C6)

`upgradeOcrFromCloud()` calls the `ocr-enhance` Edge Function (Gemini 2.5 Pro). Only overwrites on-device results if cloud confidence > on-device confidence. See the C6 section below for full detail.

### Key Files (C1)

| File | Purpose |
|------|---------|
| `src/services/documentScanService.ts` | `launchDocumentScanner`, `processDocumentScan`, `extractTextOnDevice`, `upgradeOcrFromCloud` |
| `src/db/schema.ts` | `ocr_text`, `ocr_confidence`, `ocr_source` columns + migration statements |
| `src/db/types.ts` | `OcrSource` union, extended `MediaType` union |
| `docs/migrations/20260318200000_add_ocr_columns.sql` | Migration SQL |

### Object Detail Entry Point (C2)

`ObjectDetailScreen` has a "Documents" section (after Persons, before Capture Metadata) showing all document scans for the object.

**Scan flow:**
1. User taps "Scan document" button (secondary style, `ScanIcon`)
2. `launchDocumentScanner()` opens native scanner UI
3. On success: `processDocumentScan()` stores raw + deskewed pair
4. `extractTextOnDevice()` runs ML Kit OCR on the deskewed image
5. Documents list refreshes via `useObjectDocuments` hook

**Document card layout:**
- 56×56 thumbnail (deskewed image preferred)
- 2-line OCR text preview (truncated)
- `AIFieldBadge` showing OCR confidence percentage
- Source badge: "On-device" or "Cloud"
- Tap navigates to `DocumentReview` screen (C4 placeholder)

**Data hook:** `useObjectDocuments(objectId)` queries `media WHERE media_type IN ('document_scan', 'document_deskewed')`, groups raw+deskewed pairs, returns one entry per scan sorted by `created_at DESC`.

### Document Review Screen (C4)

`DocumentReviewScreen` shows a single document scan with editable OCR text.

**Layout (top to bottom):**
1. Header with back button + title + Save button (shown when text is dirty)
2. Zoomable document image (deskewed preferred, raw fallback) — `ScrollView` with `maximumZoomScale={4}`
3. OCR confidence badge (`AIFieldBadge`) + source badge ("On-device" / "Cloud")
4. Editable multiline `TextInput` with extracted OCR text
5. Action row: Re-scan + Delete

**Save flow:** Updates `ocr_text` on raw scan media record, logs `ocr_text_edit` to `audit_trail`, queues to `sync_queue`.

**Re-scan flow:** Deletes old raw + deskewed pair → launches scanner → `processDocumentScan` → `extractTextOnDevice` → navigates to new media ID.

**Delete flow:** Confirmation alert → deletes deskewed derivative + raw scan in transaction → navigates back.

### Key Files (C2/C4)

| File | Purpose |
|------|---------|
| `src/screens/ObjectDetailScreen.tsx` | Documents section, scan button, scan flow handler |
| `src/screens/DocumentReviewScreen.tsx` | Full document review: zoomable image, editable OCR, save/rescan/delete |
| `src/hooks/useObjectDocuments.ts` | Query hook: groups raw+deskewed pairs, returns display data |
| `src/navigation/HomeStack.tsx` | `DocumentReview` route registration |

### Camera Screen Entry Point (C5)

`CaptureScreen` has a document scan button in the bottom controls row (right side, replacing the spacer). Visible in both Quick and Full modes.

**Button placement:** Bottom controls row: Library (left) | Shutter (center) | Document Scan (right). Same size as library button (52×52), overlay background, `ScanIcon` (ScanLine) 22dp white.

**Auto-linking logic (5-minute window):**
1. User taps document scan button → native scanner launches
2. On return, queries: `SELECT id, title FROM objects WHERE created_at > [now - 5min] ORDER BY created_at DESC LIMIT 1`
3. **Path A — recent object found:** links scan to that object, shows "Document linked to [title]"
4. **Path B — no recent object:** creates a new object (`uncategorized`, `needs_review`, title="Document scan") → links scan → runs OCR → if OCR has text, updates title to first line (max 60 chars)

**Workflow:** photograph artifact → flip tag → tap scan → auto-links to last capture. 5-minute window is generous for field work, tight enough to avoid wrong associations.

Standalone scans (Path B) appear in the capture inbox on HomeScreen for review.

### Cloud OCR Enhancement (C6)

After a sync cycle completes, the sync engine runs `runPostSyncCloudOcr()` as a **fire-and-forget** post-sync step. This queries up to 5 document scans where `ocr_source = 'on_device'` and sends each to the `ocr-enhance` Edge Function (Gemini 2.5 Pro).

**OCR lifecycle:**
```
Capture → on-device OCR (immediate, rn-mlkit-ocr)
                ↓
          Sync cycle
                ↓
          Cloud OCR (Gemini 2.5 Pro, if on_device confidence can be improved)
                ↓
          ocr_source = 'cloud', confidence updated
```

**Safety guards:**
- Only targets `ocr_source = 'on_device'` — never re-processes `'cloud'` or `'none'`
- Cloud confidence must exceed on-device confidence to upgrade (comparison done server-side)
- Fire-and-forget: failure never blocks sync, never throws, never crashes
- Limit 5 per sync cycle to avoid excessive API usage
- Domain-aware prompting uses `collection_domain` from settings

**Edge Function:** `supabase/functions/ocr-enhance/index.ts`
- JWT validated (same as analyze-object)
- Sends image base64 + existing confidence + domain to Gemini
- Returns `upgraded` (with text, confidence, language, handwriting_detected) or `no_upgrade`
- Audit trail logged for both outcomes

### Key Files (C6)

| File | Purpose |
|------|---------|
| `supabase/functions/ocr-enhance/index.ts` | Gemini-powered cloud OCR Edge Function |
| `src/services/documentScanService.ts` | `upgradeOcrFromCloud()` — calls Edge Function, updates media |
| `src/sync/engine.ts` | `runPostSyncCloudOcr()` — post-sync trigger |

### Decision History (C1–C6)

| Date | Decision |
|------|----------|
| 2026-03-18 | C1: `react-native-document-scanner-plugin` chosen (Expo config plugin, VisionKit + ML Kit, actively maintained) |
| 2026-03-18 | C1: Raw scan gets SHA-256 hash; deskewed derivative has no hash (same rule as B1 isolation) |
| 2026-03-18 | C1: OCR text stored on raw scan record, not deskewed derivative |
| 2026-03-18 | C1: `rn-mlkit-ocr` for on-device OCR (Expo config plugin, New Architecture compatible — swapped from `@react-native-ml-kit/text-recognition` which failed expo-doctor) |
| 2026-03-18 | C2: Entry point on ObjectDetailScreen; one card per scan (deskewed for display, raw for OCR data) |
| 2026-03-18 | C2: `DocumentReview` route registered in HomeStack |
| 2026-03-18 | C4: Full DocumentReviewScreen: zoomable image, editable OCR, save/rescan/delete |
| 2026-03-18 | C5: Camera entry point with 5-minute auto-link; manual toggle deferred auto-detection (simpler, more reliable) |
| 2026-03-18 | C6: Cloud OCR via Gemini 2.5 Pro; fires post-sync, fire-and-forget; only upgrades if cloud confidence > on-device |

---

## View Inventory System (D1)

Tracks which photographic views exist for each object and which views are required based on the object's domain.

### View Types

Controlled vocabulary on `media.view_type` (`NULL` = uncategorized legacy capture):

| View Type | Description |
|-----------|-------------|
| `front` | Primary face of the object |
| `back` | Reverse / verso |
| `top` | Plan view / bird's eye |
| `bottom` | Underside (maker's marks, labels, stamps) |
| `left_side` | Left profile |
| `right_side` | Right profile |
| `detail` | Close-up of notable feature |
| `detail_signature` | Artist signature or maker's mark close-up |
| `detail_damage` | Condition issue close-up |
| `detail_label` | Museum label, inventory tag, sticker |
| `overall` | Object in context / environment |
| `interior` | Inside view (open boxes, vessels, books) |
| `document_scan` | Document scan (existing C1 flow) |

### Domain View Requirements

Each domain defines required views (minimum for a complete record), recommended views (improve the record), and a primary/"hero" view type. Config in `src/config/viewRequirements.ts`.

| Domain | Required | Primary |
|--------|----------|---------|
| `fine_art_painting` | front, back | front |
| `fine_art_sculpture` | front, back, left_side, right_side | front |
| `ceramics` | front, bottom, top | **top** |
| `textiles` | front, back | front |
| `furniture` | front, back, top | front |
| `archaeology` | front, back, top, bottom | front |
| `natural_history` | front, back, top | front |
| `ethnography` | front, back | front |
| `photography_works_on_paper` | front, back | front |
| `human_rights` | front, overall | front |
| `conservation` | front, back, detail_damage | front |
| `general` | front, back | front |

### View Inventory API

`getViewInventory(domain, mediaRecords)` returns:
- `captured` — view types that have at least one photo
- `missing_required` / `missing_recommended` — gaps
- `completeness` — 0–100% of required views captured
- `primary_image` — best candidate for hero image (tagged primary view → first front → is_primary flag → first capture)

### Key Files (D1)

| File | Purpose |
|------|---------|
| `src/config/viewRequirements.ts` | Domain view configs, `getViewRequirements()`, `getViewInventory()` |
| `src/config/exportTemplates.ts` | Quick/standard/detailed export tier definitions |
| `src/db/schema.ts` | `view_type` column on media |
| `src/db/types.ts` | `ViewType` union type |

---

## Full-Screen Image Viewer (2026-03-20)

New `src/components/ImageViewer.tsx` — reusable full-screen modal with pinch-to-zoom:
- Library: `@likashefqet/react-native-image-zoom` v4.3.0 (Zoomable component)
- Pinch to zoom (1x–5x), double-tap to zoom to 2x
- Black background, safe-area-aware close button (top-right)
- Wired into: ObjectDetailScreen (gallery images), CaptureScreen (preview phase)
- Usage: `<ImageViewer visible={!!uri} imageUri={uri} onClose={() => setUri(null)} />`

## Background Removal Edge Function

`supabase/functions/remove-background/index.ts` — calls remove.bg API.
- Auth: same 3-tier JWT pattern as analyze-object (session → refresh → anonymous)
- Secret: `REMOVE_BG_API_KEY` is set in Supabase secrets
- Client: `src/services/isolationService.ts` sends user JWT, handles 401 retry
- Function redeployed 2026-03-20

## Capture Guidance Protocol System (2026-03-21)

Protocol-driven capture guidance that walks users through required documentation shots for institutional compliance. Protocols define ordered sequences of required and optional shots with localized instructions and tips.

### Architecture

JSON protocol configs in `src/config/protocols/` follow the same pattern as domain export configs. Each protocol specifies:
- Ordered shot list with localized labels, instructions, and tips
- Required vs optional designation per shot
- Completion rules (minimum required count, allow incomplete save)
- Object type matching (e.g., painting protocol matches painting/drawing/print/photograph)

The `useCaptureProtocol` hook is a `useReducer`-based state machine: `idle → selecting → capturing → reviewing → complete`. It tracks completed shots, skipped shots, and derives progress/completeness.

### Built-in Protocols

| Protocol | Shots | Required | Object Types |
|----------|-------|----------|-------------|
| `museum_painting` | 6 | 4 | painting, drawing, print, photograph |
| `museum_sculpture` | 8 | 5 | sculpture, relief, installation, ceramic, vessel |
| `museum_general` | 4 | 2 | any (fallback) |

### UI Components

| Component | Purpose |
|-----------|---------|
| `ProtocolPicker` | Modal with protocol cards, recommended badge for matching types, freeform option |
| `CaptureGuidanceOverlay` | Camera viewfinder overlay with shot instruction, progress pill, skip/tips/review buttons |
| `ShotListSidebar` | Slide-in panel with per-shot status badges and thumbnails |
| `TipsModal` | Per-shot tips display with localized content |
| `CompletionSummary` | Full-screen review grid with save/continue/retake actions |

### Data Model

Protocol metadata on objects table: `protocol_id`, `protocol_complete`, `shots_completed` (JSON), `shots_remaining` (JSON).
Shot metadata on media table: `shot_type`, `protocol_id`, `shot_order`.

### Integration Points

- **CaptureScreen**: Protocol picker on Full mode entry, guidance overlay on camera, protocol-aware shutter (fire-and-forget with metadata tagging)
- **ObjectDetailScreen**: Protocol status section with shot checklist, photos grouped by shot type
- **PDF Export**: Protocol compliance section with shot status table, photos grouped by shot type in thumbnail strip

### Key Files

| File | Purpose |
|------|---------|
| `src/config/protocols/museum_painting.json` | 6-shot painting protocol |
| `src/config/protocols/museum_sculpture.json` | 8-shot sculpture protocol |
| `src/config/protocols/museum_general.json` | 4-shot general fallback |
| `src/config/protocols/index.ts` | Protocol registry, loader, type interfaces |
| `src/hooks/useCaptureProtocol.ts` | State machine hook |
| `src/components/ProtocolPicker.tsx` | Protocol selection modal |
| `src/components/CaptureGuidanceOverlay.tsx` | Camera overlay with instructions |
| `src/components/ShotListSidebar.tsx` | Slide-in shot list panel |
| `src/components/TipsModal.tsx` | Per-shot tips modal |
| `src/components/CompletionSummary.tsx` | Review grid with save/continue/retake |
| `src/db/schema.ts` | `capture_protocols` table + migration columns |
| `src/db/types.ts` | `CaptureProtocolRow` interface + field types |
| `docs/migrations/20260321120000_capture_protocols.sql` | Migration SQL |

### Decision History

| Date | Decision |
|------|----------|
| 2026-03-21 | Text overlay for v1 (universal device support), AR guidance deferred to v2 |
| 2026-03-21 | Allow incomplete save with warning — field conditions may prevent full documentation |
| 2026-03-21 | JSON configs not database-first — mirrors export pipeline pattern |
| 2026-03-21 | Protocol events logged to audit_trail for institutional compliance |

---

## Known Gaps

- No LiDAR/3D scan integration (Kiri Engine identified, not integrated)
- Intro overlay uses `AsyncStorage` (not settings DB) — separate persistence layer
- Cloud OCR upgrade button on DocumentReviewScreen (manual trigger — currently only auto-triggered via sync)
- Camera auto-detection of flat documents deferred in favor of manual toggle (C5)
- View type tagging UI not yet built — captures default to `view_type = NULL`
