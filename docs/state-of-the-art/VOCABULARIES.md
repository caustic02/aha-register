# aha! Register — Vocabulary System

> Last updated: 2026-03-18
> Status: ACTIVE

Controlled vocabulary support using Getty Art & Architecture Thesaurus (AAT) terms.

---

## Architecture

```
scripts/
  extract-getty-vocabularies.ts   — Node script to fetch AAT data via SPARQL

src/data/getty/
  types.ts                        — GettyTerm / VocabularySelection interfaces
  ATTRIBUTION.md                  — ODC-By 1.0 license notice
  object-types.json               — ~500-1000 work type terms
  materials.json                  — ~500-1000 material terms
  techniques.json                 — ~300-500 technique terms
  styles-periods.json             — ~500-800 style/period terms

src/components/
  VocabularyPicker.tsx            — Search + select component
```

---

## Data Source

**Getty Art & Architecture Thesaurus (AAT)**
- SPARQL endpoint: `https://vocab.getty.edu/sparql`
- License: ODC Attribution License (ODC-By 1.0)
- Languages: English (primary), German (where available)

### AAT Facets

| Facet | Root Concept(s) | AAT ID(s) | Target Terms |
|-------|----------------|-----------|-------------|
| Object Types | Object Genres, Visual Works, Information Forms | 300264092, 300191086, 300026059 | 500–1000 |
| Materials | Materials | 300010358 | 500–1000 |
| Techniques | Processes and Techniques | 300053001 | 300–500 |
| Styles/Periods | Styles and Periods | 300264088 | 500–800 |

### Term Structure

```typescript
interface GettyTerm {
  uri: string;           // "http://vocab.getty.edu/aat/300015050"
  label_en: string;      // "oil painting"
  label_de?: string;     // "Ölmalerei"
  parent_en?: string;    // "painting techniques"
  scopeNote_en?: string; // brief definition
}
```

---

## Extraction Script

Run with:
```bash
npx tsx scripts/extract-getty-vocabularies.ts
```

The script:
1. Queries Getty SPARQL endpoint for each facet (EN + DE labels)
2. Merges results by AAT URI
3. Saves JSON files to `src/data/getty/`
4. Retries failed queries with exponential backoff
5. Falls back to smaller LIMIT if repeated failures

---

## VocabularyPicker Component

**File:** `src/components/VocabularyPicker.tsx`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `vocabulary` | `GettyTerm[]` | required | Bundled vocabulary data |
| `value` | `VocabularySelection \| VocabularySelection[]` | required | Current selection(s) |
| `onChange` | `(value) => void` | required | Selection change handler |
| `multiSelect` | `boolean` | `false` | Allow multiple selections |
| `placeholder` | `string` | — | Input placeholder text |
| `language` | `'en' \| 'de'` | required | Display language |
| `label` | `string` | — | Field label |

### UI Behavior

1. **Selected chips** — removable pills above the input showing current selections
2. **Search input** — text field with magnifying glass icon, filters vocabulary on type (200ms debounce)
3. **Dropdown results** — max 8 visible items, each showing: label, parent category, AAT URI badge
4. **Quick-select row** — horizontal scroll of 8 suggested terms below the input
5. **Free text** — any value not in Getty accepted as custom term (stored with `uri: null`)
6. **Single-select** — replaces current; **Multi-select** — appends to list

### Data Storage

When a Getty term is selected:
```json
{ "label": "oil paint", "uri": "http://vocab.getty.edu/aat/300015050" }
```

When free text is entered:
```json
{ "label": "handmade paper", "uri": null }
```

This enables future LIDO XML export with AAT URIs for linked data.

### Display Formatting

Getty AAT uses angle brackets `<…>` for hierarchical category containers (e.g. `<adhesive by composition or origin>`). These are machine notation not meant for human display.

`cleanAatLabel()` (`src/utils/vocabulary.ts`) strips leading `<` and trailing `>` from labels before rendering. Applied at:

- `VocabularyPicker.getDisplayLabel()` — all display paths (dropdown, chips, suggestions)
- `VocabularyPicker` parent term display — dropdown secondary text
- `matchToGetty()` in ReviewCardScreen — AI-to-Getty label matching results

The raw data is **not modified** — brackets are stripped at display time only, preserving data integrity for SPARQL round-tripping.

### Integration in ReviewCardScreen

| Field | Vocabulary | Mode |
|-------|-----------|------|
| Object Type | `object-types.json` | single-select |
| Medium / Materials | `materials.json` | multi-select |
| Technique | `techniques.json` | multi-select |
| Style / Period | `styles-periods.json` | single-select |

AI-prefilled values from Gemini are matched against Getty terms automatically.
Unmatched AI values are kept as free-text selections.

---

## Phase 2: Live Queries (Planned)

When online, the picker will query Getty SPARQL for terms not in the offline bundle:
- Same query pattern as extraction script with a text `FILTER`
- Results cached in AsyncStorage for offline access
- Seamless fallback to bundled data when offline

---

## Attribution

All Getty AAT data is used under **ODC-By 1.0**. Attribution notice in:
- `src/data/getty/ATTRIBUTION.md`
- Settings > About > Open Source Licences
