# Feature Spec: Capture Guidance Protocol System

> Author: Michael Tauschinger-Dempsey / Claude (architect)
> Date: 2026-03-21
> Status: SPEC COMPLETE
> Target: Berlin demo (full system)
> Repo: caustic02/aha-register

---

## What This Is

A protocol-driven capture guidance system that tells inexperienced archivists exactly what photos to take, in what order, and how many. Institutions define capture protocols (shot lists) that enforce their documentation standards. The app walks the user through each required shot with on-screen instructions, tracks completion, and flags incomplete documentation.

This is the feature that transforms Register from "a better camera app with metadata" into "institutional documentation infrastructure that enforces standards."

---

## Why It Matters

- Museum interns and volunteers document objects incorrectly or incompletely
- Field researchers under time pressure skip angles they'll need later
- Institutions have documentation standards but no way to enforce them digitally
- Incomplete photo sets are discovered weeks later when the object is inaccessible
- No competing product offers protocol-driven capture with institutional compliance

---

## User Stories

**Archivist (mobile):**
- I open the capture screen and the app tells me "Museum Standard Protocol: 6 shots required"
- I see a checklist: Front view, Back view, Top view, Detail (markings), Detail (condition), Scale reference
- As I take each photo, the checklist updates. Completed shots show a checkmark
- If I try to save with only 3 of 6 shots, the app warns me: "3 required shots remaining"
- I can override and save incomplete (field conditions may prevent full documentation)
- Each photo is tagged with its shot type for later retrieval and export

**Institution Admin (web companion, future):**
- I create a capture protocol for my museum: "Painting Documentation" with 8 required shots
- I specify which shots are required vs. optional
- I can set different protocols for different object types (paintings vs. sculpture vs. textiles)
- I can update protocols and they sync to all devices

**For Berlin Demo:**
- Admin configuration is hardcoded JSON (no web UI yet)
- 2-3 built-in protocols demonstrating the system
- Full mobile capture guidance UX is live

---

## Architecture

### Protocol Definition (JSON Config)

Protocols live in `src/config/protocols/` as JSON files, mirroring the domain config pattern from the export pipeline.

```json
{
  "id": "museum_painting",
  "name": "Painting Documentation",
  "name_de": "Gemälde-Dokumentation",
  "description": "Standard protocol for documenting paintings in museum collections",
  "description_de": "Standardprotokoll für die Dokumentation von Gemälden in Museumssammlungen",
  "version": "1.0",
  "domain": "museum_collection",
  "object_types": ["painting", "drawing", "print", "photograph"],
  "shots": [
    {
      "id": "front",
      "order": 1,
      "label": "Front View",
      "label_de": "Vorderansicht",
      "instruction": "Photograph the front of the work straight-on. Fill the frame. Ensure even lighting with no glare.",
      "instruction_de": "Fotografieren Sie die Vorderseite des Werks frontal. Füllen Sie den Bildausschnitt. Achten Sie auf gleichmäßige Beleuchtung ohne Blendung.",
      "required": true,
      "icon": "image",
      "tips": [
        "Stand directly in front, not at an angle",
        "Avoid flash — use ambient or studio lighting",
        "Include the entire work with minimal border"
      ],
      "tips_de": [
        "Stehen Sie direkt davor, nicht schräg",
        "Vermeiden Sie Blitzlicht — nutzen Sie Umgebungs- oder Studiolicht",
        "Zeigen Sie das gesamte Werk mit minimalem Rand"
      ]
    },
    {
      "id": "back",
      "order": 2,
      "label": "Back / Verso",
      "label_de": "Rückseite / Verso",
      "instruction": "Photograph the back of the work. Capture any labels, stamps, inscriptions, or structural details.",
      "instruction_de": "Fotografieren Sie die Rückseite des Werks. Erfassen Sie alle Etiketten, Stempel, Inschriften oder strukturelle Details.",
      "required": true,
      "icon": "flip-horizontal",
      "tips": [
        "Labels and stamps are critical provenance evidence",
        "If the back is inaccessible, mark as skipped with a note"
      ],
      "tips_de": [
        "Etiketten und Stempel sind wichtige Provenienz-Nachweise",
        "Wenn die Rückseite nicht zugänglich ist, als übersprungen markieren mit Notiz"
      ]
    },
    {
      "id": "detail_signature",
      "order": 3,
      "label": "Signature / Markings",
      "label_de": "Signatur / Markierungen",
      "instruction": "Close-up of the artist's signature, date, or any inscriptions on the front.",
      "instruction_de": "Nahaufnahme der Künstlersignatur, des Datums oder anderer Inschriften auf der Vorderseite.",
      "required": true,
      "icon": "pen-tool",
      "tips": [
        "Use macro mode if available",
        "Ensure the text is sharp and readable",
        "If no signature exists, photograph where it would typically appear"
      ],
      "tips_de": [
        "Verwenden Sie den Makromodus, falls verfügbar",
        "Stellen Sie sicher, dass der Text scharf und lesbar ist",
        "Wenn keine Signatur vorhanden ist, fotografieren Sie die Stelle, wo sie typischerweise wäre"
      ]
    },
    {
      "id": "detail_condition",
      "order": 4,
      "label": "Condition Issues",
      "label_de": "Zustandsschäden",
      "instruction": "Document any visible damage: cracks, tears, discoloration, losses, repairs.",
      "instruction_de": "Dokumentieren Sie alle sichtbaren Schäden: Risse, Einrisse, Verfärbungen, Fehlstellen, Restaurierungen.",
      "required": false,
      "icon": "alert-triangle",
      "tips": [
        "Take multiple detail shots if there are several areas of concern",
        "Include a color reference card if available",
        "Raking light reveals surface texture and damage"
      ],
      "tips_de": [
        "Machen Sie mehrere Detailaufnahmen, wenn mehrere Problembereiche bestehen",
        "Fügen Sie eine Farbreferenzkarte bei, falls verfügbar",
        "Streiflicht zeigt Oberflächenstruktur und Schäden"
      ]
    },
    {
      "id": "scale",
      "order": 5,
      "label": "Scale Reference",
      "label_de": "Maßstabsreferenz",
      "instruction": "Full view of the work with a ruler, scale bar, or known-size reference object visible.",
      "instruction_de": "Gesamtansicht des Werks mit sichtbarem Lineal, Maßstab oder Referenzobjekt bekannter Größe.",
      "required": true,
      "icon": "ruler",
      "tips": [
        "A standard ruler or museum scale bar works best",
        "Place the reference at the same plane as the work surface",
        "This shot enables accurate dimension calculation"
      ],
      "tips_de": [
        "Ein Standardlineal oder Museums-Maßstab funktioniert am besten",
        "Platzieren Sie die Referenz in der gleichen Ebene wie die Werkoberfläche",
        "Diese Aufnahme ermöglicht eine genaue Maßberechnung"
      ]
    },
    {
      "id": "context",
      "order": 6,
      "label": "Context / Environment",
      "label_de": "Kontext / Umgebung",
      "instruction": "Show the work in its current location or display context.",
      "instruction_de": "Zeigen Sie das Werk in seinem aktuellen Standort oder Ausstellungskontext.",
      "required": false,
      "icon": "map-pin",
      "tips": [
        "Include surrounding objects for spatial context",
        "Show the room, wall, or storage location",
        "Useful for provenance and installation history"
      ],
      "tips_de": [
        "Zeigen Sie umgebende Objekte für räumlichen Kontext",
        "Zeigen Sie den Raum, die Wand oder den Lagerort",
        "Nützlich für Provenienz- und Ausstellungsgeschichte"
      ]
    }
  ],
  "completion_rules": {
    "minimum_required": 4,
    "allow_incomplete_save": true,
    "incomplete_warning": "This object has incomplete documentation. {{remaining}} required shots are missing.",
    "incomplete_warning_de": "Dieses Objekt hat eine unvollständige Dokumentation. {{remaining}} erforderliche Aufnahmen fehlen."
  }
}
```

### Built-in Protocols for Berlin Demo

| Protocol | Domain | Shots | Required | Object Types |
|----------|--------|-------|----------|-------------|
| museum_painting | museum_collection | 6 | 4 | painting, drawing, print, photograph |
| museum_sculpture | museum_collection | 8 | 5 | sculpture, relief, installation, ceramic |
| museum_general | museum_collection | 4 | 3 | any (fallback) |

**museum_sculpture** adds: Left Profile, Right Profile (required), and Underside (optional).

**museum_general** is the minimal set: Front, Back, Scale, Detail.

### Protocol Selection Flow

```
User opens capture screen
  → If user has a selected collection with a default protocol → auto-select
  → If object type is known (from previous AI analysis) → suggest matching protocol
  → Otherwise → show protocol picker (list of available protocols)
  → "No protocol" option always available (freeform capture, current behavior)
```

### Data Model Changes

**New SQLite table: `capture_protocols`** (synced from cloud, read-only on device)

```sql
CREATE TABLE IF NOT EXISTS capture_protocols (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_de TEXT,
  description TEXT,
  description_de TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  domain TEXT NOT NULL,
  object_types TEXT NOT NULL DEFAULT '[]',  -- JSON array
  shots TEXT NOT NULL DEFAULT '[]',         -- JSON array of shot definitions
  completion_rules TEXT NOT NULL DEFAULT '{}', -- JSON
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**New columns on `media` table:**

```sql
ALTER TABLE media ADD COLUMN shot_type TEXT;        -- e.g. 'front', 'back', 'scale'
ALTER TABLE media ADD COLUMN protocol_id TEXT;      -- FK to capture_protocols.id
ALTER TABLE media ADD COLUMN shot_order INTEGER;    -- position in protocol sequence
```

**New columns on `objects` table:**

```sql
ALTER TABLE objects ADD COLUMN protocol_id TEXT;            -- which protocol was used
ALTER TABLE objects ADD COLUMN protocol_complete INTEGER DEFAULT 0;  -- 0 or 1
ALTER TABLE objects ADD COLUMN shots_completed TEXT DEFAULT '[]';    -- JSON array of shot IDs
ALTER TABLE objects ADD COLUMN shots_remaining TEXT DEFAULT '[]';    -- JSON array of shot IDs
```

### UI Components

#### 1. Protocol Picker (pre-capture)
- Appears after camera permission, before first shot
- Cards showing protocol name, shot count, domain icon
- "No protocol (freeform)" option at bottom
- Remembers last-used protocol per collection

#### 2. Capture Guidance Overlay (during capture)
- Top bar: protocol name + progress ("3 of 6 shots")
- Current shot card: icon + label + instruction text (1-2 lines)
- Tips expandable via "?" icon (not shown by default, keeps viewfinder clear)
- Shot list sidebar (collapsible): thumbnails of completed shots, empty slots for remaining
- "Skip" button for current shot (marks as skipped, moves to next)
- "Retake" on completed shots

#### 3. Completion Summary (post-capture)
- Grid of all shots with thumbnails
- Required shots without photos highlighted in warning color
- "Save anyway" button with incomplete count warning
- "Continue capturing" button to fill remaining shots

### Key Files (new)

| File | Purpose |
|------|---------|
| src/config/protocols/museum_painting.json | Painting protocol definition |
| src/config/protocols/museum_sculpture.json | Sculpture protocol definition |
| src/config/protocols/museum_general.json | General/fallback protocol |
| src/config/protocols/index.ts | Protocol registry + loader |
| src/components/ProtocolPicker.tsx | Protocol selection UI |
| src/components/CaptureGuidanceOverlay.tsx | Camera overlay with current shot info |
| src/components/ShotListSidebar.tsx | Collapsible shot progress list |
| src/components/CompletionSummary.tsx | Post-capture review grid |
| src/hooks/useCaptureProtocol.ts | Protocol state machine (current shot, progress, skip/retake) |

### State Machine: useCaptureProtocol

```
States:
  IDLE          → no protocol selected
  SELECTING     → protocol picker visible
  CAPTURING     → actively taking shots per protocol
  REVIEWING     → all shots taken or user triggered review
  COMPLETE      → saved with protocol metadata

Actions:
  selectProtocol(id)     → SELECTING → CAPTURING
  captureShot(shotId)    → assigns photo to shot, advances to next
  skipShot(shotId)       → marks skipped, advances to next
  retakeShot(shotId)     → returns to that shot for re-capture
  reviewCapture()        → CAPTURING → REVIEWING
  saveObject()           → REVIEWING → COMPLETE (with protocol metadata)
  cancelProtocol()       → CAPTURING → IDLE (back to freeform)
```

### Integration with Existing Systems

**Capture flow:** CaptureScreen.tsx gains a protocol mode. When a protocol is active, each photo capture tags the media record with `shot_type`, `protocol_id`, and `shot_order`. The Save button behavior changes: it triggers CompletionSummary instead of immediate save.

**Object detail:** ObjectDetailScreen shows protocol completion status. Photos are grouped by shot type. Missing shots are flagged.

**Export:** PDF export can group photos by shot type with labels. The domain config already has the infrastructure. Add a "Documentation Protocol" section to the PDF showing compliance status.

**AI analysis:** After capturing the front view, trigger Gemini analysis automatically. Use the result to suggest object type and auto-match a more specific protocol if the user started with museum_general.

**Audit trail:** Protocol selection, shot completion, skips, and overrides are all logged to audit_trail. This is the compliance record.

---

## Build Order

### Phase 1: Protocol Infrastructure (CC Opus, ~2 hours)
1. Create JSON protocol files (3 protocols)
2. Create protocol index/loader
3. Schema migration: capture_protocols table, media columns, objects columns
4. Update db/schema.ts and db/types.ts
5. Create useCaptureProtocol hook (state machine)

### Phase 2: Capture Guidance UX (CC Opus + Cursor, ~3 hours)
1. ProtocolPicker component
2. CaptureGuidanceOverlay component
3. ShotListSidebar component
4. Wire into CaptureScreen.tsx
5. i18n: all protocol labels + UI strings (EN + DE)

### Phase 3: Completion & Review (CC Opus + Cursor, ~2 hours)
1. CompletionSummary component
2. Incomplete save warning flow
3. Protocol status on ObjectDetailScreen
4. Shot type grouping in photo gallery

### Phase 4: Export Integration (Cursor, ~1 hour)
1. Add protocol compliance section to PDF template
2. Group photos by shot type in export
3. Show completion percentage

### Phase 5: Polish & Test (CC Sonnet, ~1 hour)
1. Full walkthrough on emulator
2. i18n parity check
3. TypeScript strict check
4. Update State of the Art docs
5. ADR filed

**Total estimate: 8-9 hours across 1-2 sessions**

---

## What This Does NOT Include (Post-Berlin)

- Web admin UI for creating/editing protocols (companion dashboard)
- Protocol sync from cloud to device
- AR angle guidance (gyroscope-assisted framing)
- Auto-detection of which shot type was just taken (ML classifier)
- Protocol analytics (which shots are most often skipped)
- Custom protocol creation on device
- Protocol versioning and migration
- Multi-object batch capture with shared protocol

---

## Competitive Landscape

No competing collection management tool offers protocol-driven capture:
- **TMS (Gallery Systems):** No mobile capture
- **MuseumPlus (Zetcom):** Basic photo upload, no guidance
- **CollectiveAccess:** Photo field, no protocol
- **Axiell Collections:** Bulk import, no guided capture
- **PastPerfect:** Desktop-era, no mobile
- **CatalogIt:** Mobile photos but freeform only

This is a category-defining feature.

---

## Decision Record

| Decision | Rationale |
|----------|-----------|
| JSON configs, not database-first | Mirrors export pipeline pattern. Fast to iterate. Admin UI adds DB layer later |
| Text overlay, not AR for v1 | Works on every device. AR requires gyroscope calibration and adds complexity |
| Allow incomplete save with warning | Field conditions prevent perfect documentation. Forcing completion loses trust |
| Protocol on objects table, not separate join | One object = one protocol. Simpler queries. Protocol can change (re-document) |
| Shot metadata on media records | Each photo knows its role. Enables smart export, search by shot type, compliance audits |
| i18n from day one | Berlin demo audience is German-speaking. No shortcuts |
