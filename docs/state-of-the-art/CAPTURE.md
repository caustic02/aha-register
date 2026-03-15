# State of the Art: Capture System

> Last updated: 2026-03-15
> Status: ACTIVE

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

## Known Gaps

- No batch capture mode
- No LiDAR/3D scan integration (Kiri Engine identified, not integrated)
- No AI vision layer (architecture planned, not built)
- Intro overlay uses `AsyncStorage` (not settings DB) — separate persistence layer
