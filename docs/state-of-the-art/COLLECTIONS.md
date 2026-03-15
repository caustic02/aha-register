# State of the Art: Collections

> Last updated: 2026-03-15
> Status: STUB

## What This Is
Users create named collections and add/remove objects. Uses `object_collections` join table (14th table, schema v1.2). Collections have a type (general/department/exhibition/project/research/conservation) and optional description.

## Features Built
- Create collection with name, type, and description
- List all collections with object count
- Collection detail view with object list and search
- Add objects to collection via multi-select picker
- Remove object from collection
- PDF export from collection detail (calls `exportCollectionToPDF`)

## Key Files

| File | Purpose |
|------|---------|
| `src/screens/CollectionsScreen.tsx` | List all collections |
| `src/screens/CollectionDetailScreen.tsx` | Collection detail, search, remove objects, export |
| `src/screens/CreateCollectionScreen.tsx` | Create new collection form |
| `src/screens/AddObjectsScreen.tsx` | Multi-select picker for adding objects to a collection |
| `src/services/collectionService.ts` | DB queries for collections and `object_collections` |
| `src/navigation/CollectionStack.tsx` | Stack navigator for collection screens |

## Known Gaps

- No collection sharing between users
- No collection templates
- No batch operations on collection contents
- No reordering of objects within a collection (display_order column exists but no UI)
- No collection-level privacy tier (inherits from individual object privacy_tier)
