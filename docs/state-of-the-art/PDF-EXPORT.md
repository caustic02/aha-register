# State of the Art: PDF Export

> Last updated: 2026-03-15
> Status: ACTIVE

## What This Is
PDF reports generated from object detail and collection detail screens. Uses HTML-to-PDF via `expo-print` with `expo-sharing` for the native share sheet. Three report types: single object (2-page Karteikarte), collection (cover + one page per object + summary table), and batch (same layout as collection, no cover description).

## Architecture

### Pipeline (all three report types)
1. Load data from SQLite — object rows, media rows (with base64-encoded file content), audit trail, collections
2. Build HTML string with inline CSS (A4 page size, same `#2D5A27` accent color as app theme)
3. Call `Print.printToFileAsync({ html })` → returns a file URI
4. Call `Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })`

### Three Export Entry Points (`services/exportService.ts`)
| Function | Produces |
|----------|---------|
| `exportObjectToPDF(db, objectId)` | 2-page A4 report for one object |
| `exportCollectionToPDF(db, collectionId)` | Cover + N object pages + summary table |
| `exportBatchToPDF(db, objectIds[], title)` | Same as collection report, no cover description |

All three functions read `SETTING_KEYS.INSTITUTION_NAME` from `app_settings` and embed it in the report header.

### Object Report — 2 pages (`templates/object-report.ts`)
**Page 1** — Karteikarte layout:
- Header: *aha!* Register brand + "OBJECT REPORT" badge + institution name
- Title row: object type label, title, subtitle (short_title or description), inventory number badge
- Two-column body: primary photo (55% width) + thumbnail strip | facts card (Sammlung, Datierung, Herkunft, Hersteller, Präsenz with status dot, Standort)
- Objektdaten grid (2 columns): Material, Technik, Maße, Zustand, Eigentümer, Vers.-Wert, Klassifikation, Epoche, Kultur, Inschrift
- Provenienz & Erwerbung section (conditional — only shown if any provenance fields populated)
- Tamper-evidence footer: first 32 chars of SHA-256 (monospace), GPS coordinates, capture timestamp, audit event count, scannable QR code (encodes `https://aharegister.com/verify/{object_id}`)

**Page 2** — Detail and provenance:
- Compact header (brand + object title)
- Beschreibung (description + scientific_notes)
- Latest activity card (most recent audit_trail entry, amber background)
- Literatur & Quellen (bibliography, mentioned_in, internet_comment)
- Audit Trail timeline (last 20 entries, capped with overflow count)
- Second tamper-evidence footer: full object UUID, total audit event count

### Collection Report (`templates/collection-report.ts`)
- **Cover page**: brand, "Sammlungsbericht" badge, collection name/description, object count, institution name
- **Per-object pages**: condensed card — thumbnail image (120×90pt), title, type, key fields grid (Material, Technik, Maße, Zustand, Datierung, Epoche, Herkunft, Eigentümer), SHA-256 prefix, capture date, audit count
- **Summary table** (collections with >1 object): columns — #, Inventar-Nr., Titel, Typ, Zustand, Erfasst

### Media Embedding
Images are read from the app's local file system via `expo-file-system` `File.base64()` and embedded as `data:{mimeType};base64,{data}` URIs in the HTML. Missing files are silently skipped (try/catch). `expo-print`'s headless WebKit renderer handles `<img>` tags from data URIs.

### HTML Safety
Both templates use an `esc()` helper that escapes `&`, `<`, `>`, `"` in all user-supplied strings. No raw string interpolation of untrusted data.

### CSS
Inline `<style>` block, A4 page size (`@page { size: A4; margin: 18mm 20mm; }`), system font stack (`-apple-system, system-ui, 'Helvetica Neue'`), base font 9.5pt. Color constants imported from `src/theme/index.ts` — single source of truth.

## Key Files

| File | Purpose |
|------|---------|
| `src/services/exportService.ts` | Three export functions + `sharePDF` — orchestrates data loading, HTML generation, print, share |
| `src/services/exportTemplate.ts` | Shared `ObjectExportData` and `MediaWithBase64` types |
| `src/templates/object-report.ts` | 2-page A4 single-object HTML template with full CSS |
| `src/templates/collection-report.ts` | Multi-page collection report: cover + per-object cards + summary table |
| `src/services/mediaService.ts` | `getMediaForObject` — used to load media rows for base64 embedding |
| `src/services/collectionService.ts` | `getCollectionsForObject`, `getCollectionById` |

## Decision History

| Date | Decision | Reference |
|------|----------|-----------|
| 2026-03-09 | Images embedded as base64 data URIs (not file:// paths) | expo-print WebKit can't access arbitrary file:// URIs on device |
| 2026-03-09 | Duplicate color constants in templates (not imported from theme) | Templates are pure TypeScript strings — no React Native imports allowed |
| 2026-03-09 | Audit trail capped at last 20 entries in PDF | Page overflow control |
| 2026-03-09 | QR placeholder is decorative only — not a real QR code | Real QR requires additional library; not yet integrated |
| 2026-03-15 | QR codes now scannable via `qrcode` library (SVG embedded in HTML) | Gap fix — replaces decorative pixel art with real QR encoding verify URL |
| 2026-03-15 | PDF labels use i18n (`pdf.*` keys), no longer hardcoded German | Gap fix — templates accept `TFunc` parameter, labels resolve via i18next |
| 2026-03-15 | PDF colors imported from `src/theme/index.ts`, no duplication | Gap fix — `const C = colors` replaces hardcoded hex constants |

## Known Gaps

- No per-institution branding (logo, custom colors)
- No watermark option
- `exportBatchToPDF` exists in `exportService.ts` but the batch export UI in `BatchActionBar` calls it — verify integration is wired
- No digital signature — SHA-256 hash displayed but not cryptographically signed
