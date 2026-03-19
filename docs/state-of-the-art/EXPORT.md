# aha! Register — Export Module

> Last updated: 2026-03-16
> Status: ACTIVE

Offline-first export of object records as PDF, CSV, or JSON. No network calls — all data from local SQLite, all files generated and shared locally.

---

## Architecture

### Export Service — `src/services/export-service.ts`

Pure functions. Each takes an `ExportableObject` and returns either a string (JSON/CSV) or a file URI (PDF).

```ts
interface ExportableObject {
  object: RegisterObject;
  media: Media[];
  persons: ExportPerson[];
}
```

| Function | Returns | Description |
|----------|---------|-------------|
| `exportAsJSON(data)` | `string` | Pretty-printed JSON with export metadata block, SHA-256 hashes. Strips internal IDs. |
| `exportAsCSV(data)` | `string` | Single-row CSV with headers. Persons concatenated as `role: name; ...`. Media count + primary filename. |
| `exportAsPDF(data)` | `Promise<string>` | HTML-to-PDF via `expo-print`. Returns local file URI. A4, self-contained HTML with inline CSS and base64-embedded primary image. |

### Share Utility — `src/services/export-share.ts`

| Function | Description |
|----------|-------------|
| `buildExportFilename(title, ext)` | `aha-register-{sanitized-title}-{YYYY-MM-DD}.{ext}` |
| `shareExport(content, filename, mimeType, isPdfUri?)` | Writes content to cache file, opens native share sheet via `expo-sharing`. For PDF, shares the URI directly. |

### Export Modal — `src/components/ExportModal.tsx`

Bottom-sheet modal with three `ListItem` rows (PDF, JSON, CSV). Shows per-option loading spinner during generation. Triggered from `ObjectDetailScreen`'s Export icon button.

---

## Supported Formats

### PDF Object Data Sheet (D3)

Professional A4 data sheet modeled on Articheck condition reports and museum object data sheets. Layout adapts to the `ExportConfig.template` tier.

**Engine:** `expo-print` (`Print.printToFileAsync`), HTML-to-PDF, A4 with 20mm/18mm margins.

**Typography:**
- Title: 16pt bold
- Section headers: 11pt bold, uppercase, letter-spacing 0.6pt, bottom rule
- Field labels: 9pt bold, gray (`colors.textSecondary`)
- Field values: 10pt regular, black
- Footer: 7pt, gray
- Image view labels: 8pt italic

**Quick layout (1 page):**
- Header band (institution, title, accession no., date)
- Single centered primary image (65% width, max 300pt height)
- Single-column metadata: identification fields only
- Footer with SHA-256 hash, brand, date

**Standard layout (1–2 pages):**
- Header band
- Image area: primary (42% width) + up to 3 thumbnails stacked right
- Two-column metadata: Col 1 = identification + physical + classification; Col 2 = condition + provenance + capture data
- Description below columns (full width)
- Footer

**Detailed layout (multi-page):**
- Same as standard page 1
- Page 2+: additional images in 4-column grid, documents with OCR text

**Config wiring:**
- `config.selectedImageIds` → which images to include
- `config.useIsolated` → prefer `derivative_isolated` versions
- `config.sections` → which metadata blocks render
- `config.showAiBadges` → inline "AI" badges next to AI-analyzed values
- Falls back to standard template when called without config (backward compatible)

**Dimension format:** `H 45.2 × W 30.1 × D 12.0 cm` (reads from `type_specific_data.dimensions`)

**Image handling:**
- `expo-file-system` `File.base64()` for offline-first loading
- Thin 0.5pt border on all images
- View type labels from `VIEW_LABELS` lookup (not i18n — PDF is static HTML)
- Missing files silently skipped

### JSON Data
- **Structure:** Flat object with nested `media[]`, `persons[]`, and `_export` metadata block
- **Export metadata:** `{ exportDate, exportFormat, appVersion, platform }`
- **Excluded:** Internal SQLite rowids, sync_queue references, file system paths, raw image data

### CSV Spreadsheet
- **Layout:** Header row + single data row (one row per object)
- **Persons:** Concatenated as `role: name; role: name` in single column
- **Media:** `mediaCount` (integer) + `primaryImageFilename` + `sha256Hash` columns
- **Escaping:** Fields containing commas, newlines, or double quotes are quoted per RFC 4180

---

## Privacy & Evidence Handling

| Condition | Behaviour |
|-----------|-----------|
| `privacy_tier = 'anonymous'` | GPS coordinates, persons, and device info are stripped from all export formats |
| `legal_hold = 1` | `Alert.alert` shown before export: "This record is under legal hold. Export for authorized purposes only." User must confirm to proceed |
| All formats | `privacy_tier` and `evidence_class` included as metadata fields |

---

## File Naming Convention

```
aha-register-{title}-{YYYY-MM-DD}.{ext}
```

- `title`: lowercased, spaces → hyphens, special characters removed, max 60 chars
- Example: `aha-register-marble-bust-of-apollo-2026-03-16.pdf`

---

## Dependencies

All pre-existing in `package.json`. No new dependencies added.

| Package | Version | Role |
|---------|---------|------|
| `expo-print` | ~55.0.8 | HTML-to-PDF generation |
| `expo-sharing` | ~55.0.11 | Native share sheet |
| `expo-file-system` | ~55.0.10 | Read media files (base64), write temp export files |

---

## Existing Export Infrastructure

The new export module (`export-service.ts`, `export-share.ts`) coexists with the existing `exportService.ts` / `exportTemplate.ts` which handle:
- Full PDF reports with QR codes, audit trails, and collection reports
- Batch PDF export for multiple objects
- Collection-level PDF reports

The new module provides a simpler, format-flexible export path for single objects (PDF/CSV/JSON) triggered from the Object Detail screen.

---

## Export Template Tiers (D1)

Three tiers following the Articheck pattern. Config in `src/config/exportTemplates.ts`.

### Quick

- Max 1 page
- Primary image only (isolated if available, original if not)
- Fields: title, object_type, medium, dimensions, date, accession_number
- No condition, no provenance, no AI badges

### Standard

- 1–2 pages
- Up to 4 images (primary + 3 selected from view inventory)
- Fields: all identification + physical description + classification
- Condition summary (1 line)
- Getty AAT terms shown
- AI badges optional (toggle)

### Detailed

- Multi-page (unlimited)
- All available images with view_type labels
- All fields including full condition, provenance, exhibition history
- Getty AAT terms + AI confidence badges
- Document scans included
- Audit trail summary

### How View Inventory Feeds Into Image Selection

The view inventory system (`src/config/viewRequirements.ts`) determines which images appear in each tier:

1. **Quick** — `primary_image` from `getViewInventory()` (prefers isolated derivative)
2. **Standard** — primary + up to 3 additional from captured views, prioritising required views first, then recommended
3. **Detailed** — all media with `view_type` labels rendered under each image

### Key Files

| File | Purpose |
|------|---------|
| `src/config/exportTemplates.ts` | `ExportTemplateConfig` type, `getExportTemplate()`, tier definitions |
| `src/config/viewRequirements.ts` | `getViewInventory()` — drives image selection |
| `src/services/export-service.ts` | Export generation (PDF, JSON, CSV) |
| `src/components/ExportStepperModal.tsx` | 5-step export stepper (object mode) + legacy flow (batch/collection) |
| `src/hooks/useExportConfig.ts` | `ExportConfig` state management hook |

---

## Export Stepper — 5-Step Configuration Flow (D2)

Full-screen stepper for single-object exports. Replaces the previous 2-step format→review modal for object mode. Batch/collection exports keep the existing bottom-sheet flow.

### Steps

| # | Step | Description | Skippable? |
|---|------|-------------|------------|
| 1 | **Format** | PDF Data Sheet, PDF Condition Report, JSON, CSV | JSON/CSV skip directly to generation |
| 2 | **Template** | Quick / Standard / Detailed — pre-fills Steps 3–4 | No |
| 3 | **Images** | Selectable grid with view_type labels, isolated toggle, completeness indicator | No |
| 4 | **Content** | Section toggles (identification always ON), AI badges, branding | No |
| 5 | **Preview** | Simplified layout diagram + config summary + Generate button | No |

### Navigation

- Top: step indicator dots (numbered, filled for completed steps)
- Bottom bar: Back / Next buttons (Next disabled until required selection made)
- No swipe between steps (prevents accidental navigation)
- Close button (×) on Step 1; Back arrow (←) on Steps 2–5

### State Management — `useExportConfig`

```typescript
interface ExportConfig {
  format: 'pdf_datasheet' | 'pdf_condition' | 'json' | 'csv';
  template: 'quick' | 'standard' | 'detailed';
  selectedImageIds: string[];
  useIsolated: boolean;
  showDimensions: boolean;
  sections: { identification, physical, classification, condition, provenance, documents };
  showAiBadges: boolean;
  includeBranding: boolean;
}
```

Template selection calls `applyTemplate(tier, media, domain)` which:
1. Reads defaults from `exportTemplates.ts`
2. Computes view inventory to select appropriate images
3. Pre-fills section toggles and AI badge setting
4. User can override any default in subsequent steps

### Entry Points

| Screen | Mode | Flow |
|--------|------|------|
| ObjectDetailScreen | `object` | Full 5-step stepper |
| ObjectListScreen | `batch` | Legacy 3-step bottom sheet |
| CollectionDetailScreen | `collection` | Legacy 3-step bottom sheet |

### Key Files (D2)

| File | Purpose |
|------|---------|
| `src/components/ExportStepperModal.tsx` | Main component — routes between object and legacy flows |
| `src/hooks/useExportConfig.ts` | Config state, template application, image/section toggling |
