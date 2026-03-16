# aha! Register — Navigation Architecture

> Last updated: 2026-03-17
> Status: ACTIVE

React Navigation v6 with a bottom-tab root and per-tab native stacks.

---

## Navigator Tree

```
RootStack (NativeStack)          — auth gate, onboarding
└── MainTabs (BottomTab)
    ├── HomeStack (NativeStack)
    │   ├── Home
    │   └── ObjectDetail
    ├── CaptureStack (NativeStack)
    │   ├── CaptureCamera
    │   ├── AIProcessing
    │   └── ReviewCard
    ├── CollectionStack (NativeStack)
    │   ├── CollectionList
    │   └── CollectionDetail
    └── Settings (screen, no sub-stack)
```

---

## Screen Inventory

### HomeStack — `src/navigation/HomeStack.tsx`

| Screen | File | Purpose |
|--------|------|---------|
| `Home` | `src/screens/HomeScreen.tsx` | Dashboard: collection stats, recent captures, type breakdown, sync status |
| `ObjectDetail` | `src/screens/ObjectDetailScreen.tsx` | Read-only detail view: image gallery, metadata, persons, capture data, export, delete |

**Param list:**
```ts
type HomeStackParamList = {
  Home: undefined;
  ObjectDetail: { objectId: string };
};
```

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
