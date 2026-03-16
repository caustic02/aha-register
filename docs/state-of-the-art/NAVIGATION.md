# aha! Register — Navigation Architecture

> Last updated: 2026-03-18
> Status: ACTIVE

React Navigation v6 with a bottom-tab root and per-tab native stacks.

---

## Navigator Tree

```
RootStack (NativeStack)          — auth gate, onboarding
└── MainTabs (BottomTab)
    ├── HomeStack (NativeStack)
    │   ├── Home
    │   ├── ObjectList
    │   └── ObjectDetail
    ├── CaptureStack (NativeStack)
    │   ├── CaptureCamera
    │   ├── AIProcessing
    │   └── ReviewCard
    ├── CollectionStack (NativeStack)
    │   ├── CollectionList
    │   └── CollectionDetail
    └── SettingsStack (screen, no sub-stack)
        └── Settings
```

---

## Screen Inventory

### HomeStack — `src/navigation/HomeStack.tsx`

| Screen | File | Purpose |
|--------|------|---------|
| `Home` | `src/screens/HomeScreen.tsx` | Dashboard: collection stats, recent captures (with View all link), type breakdown, sync status |
| `ObjectList` | `src/screens/ObjectListScreen.tsx` | Full collection browser: search, type filter chips, FlatList with thumbnails and badges |
| `ObjectDetail` | `src/screens/ObjectDetailScreen.tsx` | Read-only detail view: image gallery, metadata, persons, capture data, export, delete |

**Param list:**
```ts
type HomeStackParamList = {
  Home: undefined;
  ObjectList: undefined;
  ObjectDetail: { objectId: string };
};
```

**Navigation flow:** `Home` → `ObjectList` (View all link in Recent Captures header) → `ObjectDetail`.

> Note: `ObjectDetailScreen` is registered with `React.ComponentType<any>` to avoid TypeScript conflict with its native `ObjectStackParamList` type. The runtime params are identical.

---

### ObjectStack — `src/navigation/ObjectStack.tsx`

Still exists and shares `ObjectDetail` registration. Used only if a direct `ObjectList` entry point is needed in future.

| Screen | File | Purpose |
|--------|------|---------|
| `ObjectList` | `src/screens/ObjectListScreen.tsx` | Searchable list of all registered objects with batch actions |
| `ObjectDetail` | `src/screens/ObjectDetailScreen.tsx` | Read-only detail view (same screen as HomeStack) |

**Param list:**
```ts
type ObjectStackParamList = {
  ObjectList: undefined;
  ObjectDetail: { objectId: string };
};
```

---

### CaptureStack — `src/navigation/CaptureStack.tsx`

| Screen | File | Purpose |
|--------|------|---------|
| `CaptureCamera` | `src/screens/CaptureScreen.tsx` | Full-screen camera with flash, flip, aspect ratio, type selector |
| `AIProcessing` | `src/screens/AIProcessingScreen.tsx` | Animated 5-step progress while Gemini analyses the capture |
| `ReviewCard` | `src/screens/ReviewCardScreen.tsx` | Editable AI-prefilled metadata form before saving |

**Param list:**
```ts
type CaptureStackParamList = {
  CaptureCamera: undefined;
  AIProcessing: {
    imageUri: string;
    imageBase64: string;
    mimeType: string;
    captureMetadata: CaptureMetadata;
    sha256Hash?: string;
  };
  ReviewCard: {
    imageUri: string;
    analysisResult: AIAnalysisResult;
    captureMetadata: CaptureMetadata;
    sha256Hash?: string;
  };
};
```

**Flow:** `CaptureCamera` → `AIProcessing` (replace) → `ReviewCard` (replace) → reset to `CaptureCamera`.
Skip-AI path: `CaptureCamera` → directly `ReviewCard` with `EMPTY_ANALYSIS`.

---

### CollectionStack — `src/navigation/CollectionStack.tsx`

| Screen | File | Purpose |
|--------|------|---------|
| `CollectionList` | `src/screens/CollectionListScreen.tsx` | All collections with create action |
| `CollectionDetail` | `src/screens/CollectionDetailScreen.tsx` | Objects in a collection, add/remove |

---

### Tab icons (unicode emoji fallback)

| Tab | Symbol | Active colour |
|-----|--------|---------------|
| Objects | `◎` (`\u25CE`) | `#74B9FF` |
| Capture | `⊕` (`\u2295`) | `#74B9FF` |
| Collections | `◈` (`\u25C8`) | `#74B9FF` |
| Settings | `⚙` (`\u2699`) | `#74B9FF` |

---

## Cross-tab Navigation

To navigate to the Objects tab from inside CaptureStack:
```ts
navigation.getParent()?.navigate('Objects');
```

---

## Navigation Patterns

- **replace** — used between CaptureCamera → AIProcessing → ReviewCard so back-swipe never returns to mid-flow screens.
- **CommonActions.reset** — used when "Save" or "Discard" on ReviewCard should return the user cleanly to `CaptureCamera`.
- **goBack()** — used on `ObjectDetail` back button and after successful delete.
- **headerShown: false** — all navigators; every screen renders its own header bar using `IconButton` + `BackIcon`.

---

## Modal Components

| Component | File | Trigger |
|-----------|------|---------|
| `ExportModal` | `src/components/ExportModal.tsx` | ObjectDetail Export button |

`ExportModal` is a bottom-sheet-style `Modal` with three format options (PDF, JSON, CSV). It generates the export file and opens the native share sheet via `expo-sharing`.

---

### Settings — `src/screens/SettingsScreen.tsx`

Registered directly in `MainTabs` (no sub-stack). Renders a scrollable form divided into seven sections:

| Section | Content |
|---------|---------|
| Account | Signed-in email, organisation name, sync status, Sign Out button |
| Institution | Institution name (TextInput), institution type, default privacy tier, default object type — all persisted via `settingsService` |
| AI Features | "AI Analysis" toggle, "Confidence Scores" toggle — persisted via `useSettings` hook (AsyncStorage) |
| Collection Type | Radio-style domain selector (6 options) — persisted via `useSettings` hook |
| Language | EN / DE switcher — persisted via `settingsService` and `i18n.changeLanguage()` |
| Data & Storage | Local object/pending-sync counts, Export All Data, Clear All Data (destructive alert) |
| About | App version, build, Open Source Licences link |

**Settings hook:** `src/hooks/useSettings.ts` — reads/writes `settings.*` keys in AsyncStorage; exposes `aiAnalysisEnabled`, `showConfidenceScores`, `collectionDomain`, `loaded` flag, and their setters.

---

## Standalone Screens (not yet wired into navigation)

### TrustScreen — `src/screens/TrustScreen.tsx`

A brand + trust statement shown once during onboarding, after the intro slides and before sign-in.

**Prop contract:**
```ts
interface Props {
  onContinue?: () => void;  // advance to next onboarding step
  onSkip?: () => void;      // same action — defaults to onContinue if omitted
}
export default function TrustScreen(props: Props)
```

**Planned position in onboarding flow:**
```
OnboardingSlides → TrustScreen → AuthScreen (sign-in / sign-up)
```

**Content:** Five commitment cards (On-Device, EU Infrastructure, Tamper Evidence, AI Transparency, Privacy by Design) with icons from `src/theme/icons.ts`, i18n via the `trust` namespace. No navigation dependency — pure callback props.
