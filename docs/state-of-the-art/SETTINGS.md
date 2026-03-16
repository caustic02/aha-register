# aha! Register — Settings Architecture

> Last updated: 2026-03-16
> Status: ACTIVE

User-facing configuration is split across two storage layers depending on whether a value needs to be available before the SQLite database is ready.

---

## Storage Layers

| Layer | Mechanism | Hook / Service | When ready |
|-------|-----------|----------------|------------|
| **Device-local** | AsyncStorage (`@react-native-async-storage/async-storage`) | `useSettings` hook | Immediately on app start |
| **App database** | SQLite `settings` table (via `settingsService`) | `getSetting` / `setSetting` | After `DatabaseContext` is initialised |

---

## AsyncStorage Keys — `src/hooks/useSettings.ts`

```ts
export const SETTINGS_KEYS = {
  AI_ANALYSIS_ENABLED:   'settings.aiAnalysisEnabled',   // boolean string
  SHOW_CONFIDENCE_SCORES:'settings.showConfidenceScores', // boolean string
  COLLECTION_DOMAIN:     'settings.collectionDomain',     // CollectionDomain
} as const;
```

### `CollectionDomain` type

```ts
export type CollectionDomain =
  | 'museum_collection'
  | 'archaeological_site'
  | 'conservation_lab'
  | 'natural_history'
  | 'human_rights'
  | 'general';
```

### `useSettings()` return value

```ts
{
  aiAnalysisEnabled: boolean;       // default: true
  showConfidenceScores: boolean;    // default: true
  collectionDomain: CollectionDomain; // default: 'general'
  loaded: boolean;                  // false until AsyncStorage has been read

  setAIAnalysisEnabled: (value: boolean) => Promise<void>;
  setShowConfidenceScores: (value: boolean) => Promise<void>;
  setCollectionDomain: (domain: CollectionDomain) => Promise<void>;
}
```

`loaded` is `false` until the initial `Promise.all` resolves. Consumer screens should avoid rendering AI-dependent UI until `loaded === true` to prevent one-frame flicker.

---

## SQLite Settings Keys — `src/services/settingsService.ts`

| Key (`SETTING_KEYS.*`) | Default | Notes |
|------------------------|---------|-------|
| `INSTITUTION_NAME` | `''` | Free-text, saved on `onBlur` |
| `INSTITUTION_TYPE` | `''` | One of `INSTITUTION_TYPES` |
| `DEFAULT_PRIVACY_TIER` | `'public'` | `PrivacyTier` |
| `DEFAULT_OBJECT_TYPE` | `'museum_object'` | `ObjectType` |
| `LANGUAGE` | `'en'` | ISO 639-1 code |
| `SYNC_ENABLED` | `'false'` | Boolean string |

---

## Domain Options

| Value | i18n key | Icon |
|-------|----------|------|
| `museum_collection` | `settings.domain.museum_collection` | `MuseumObjectIcon` |
| `archaeological_site` | `settings.domain.archaeological_site` | `SiteIcon` |
| `conservation_lab` | `settings.domain.conservation_lab` | `ConservationRecordIcon` |
| `natural_history` | `settings.domain.natural_history` | `SpecimenIcon` |
| `human_rights` | `settings.domain.human_rights` | `IncidentIcon` |
| `general` | `settings.domain.general` | `ObjectsTabIcon` |

Each domain also has a `_desc` key (e.g. `settings.domain.museum_collection_desc`) rendered as a subtitle in the radio row.

---

## Settings Screen Sections

```
SettingsScreen
├── Account
│   ├── Signed-in email (MetadataRow, read-only)
│   ├── Organisation name (MetadataRow, read-only)
│   ├── Sync status (MetadataRow, conditional)
│   └── Sign Out (Pressable, destructive alert)
├── Institution
│   ├── Institution Name (TextInput, blur-save)
│   ├── Institution Type (MetadataRow + inline picker)
│   ├── Default Privacy Tier (MetadataRow + inline picker)
│   └── Default Object Type (MetadataRow + inline picker)
├── AI Features
│   ├── AI Analysis (Switch, AsyncStorage)
│   └── Confidence Scores (Switch, AsyncStorage)
├── Collection Type
│   └── Domain selector (6 radio rows, AsyncStorage)
├── Language
│   └── EN / DE toggle rows (MetadataRow, i18n + SQLite)
├── Data & Storage
│   ├── Local Objects (MetadataRow, read-only)
│   ├── Pending Sync (MetadataRow, read-only)
│   ├── Storage Used (MetadataRow, placeholder)
│   ├── Export All Data (ListItem, not yet implemented)
│   └── Clear All Data (Pressable, destructive — deletes objects, sync_queue, audit_trail)
└── About
    ├── Version (MetadataRow)
    ├── Build (MetadataRow)
    └── Open Source Licences (ListItem, not yet implemented)
```

---

## Data Management — Clear All Data

Executes three `DELETE` statements inside a `try/catch`:

```sql
DELETE FROM objects;
DELETE FROM sync_queue;
DELETE FROM audit_trail;
```

After success, calls `load()` to refresh the stats display. On error, shows `Alert` with `t('common.error')`.

---

## Adding a New Setting

1. **AsyncStorage-backed** (read before DB ready, e.g. feature flags):
   - Add key to `SETTINGS_KEYS` in `src/hooks/useSettings.ts`
   - Add state field, load logic, and setter to `useSettings()`
   - Add i18n key to `settings.*` namespace in `en.json` / `de.json`

2. **SQLite-backed** (user profile data tied to institution):
   - Add key to `SETTING_KEYS` in `src/services/settingsService.ts`
   - Add to the `Promise.all` load block in `SettingsScreen`
   - Add i18n key as above
