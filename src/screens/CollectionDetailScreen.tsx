import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { FieldInput } from '../components/FieldInput';
import {
  getCollectionById,
  updateCollection,
  addObjectToCollection,
  type CollectionObject,
} from '../services/collectionService';
import type { Collection } from '../db/types';
import { exportCollectionToPDF, exportBatchToPDF, sharePDF } from '../services/exportService';
import { deleteObject } from '../services/objectService';
import { SelectionHeader, BatchActionButtons } from '../components/BatchActionBar';
import { CollectionPickerModal } from '../components/CollectionPickerModal';
import type { CollectionStackParamList } from '../navigation/CollectionStack';
import type { MainTabParamList } from '../navigation/MainTabs';

type Props = NativeStackScreenProps<CollectionStackParamList, 'CollectionDetail'>;

export function CollectionDetailScreen({ route, navigation }: Props) {
  const { collectionId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [objects, setObjects] = useState<CollectionObject[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exporting, setExporting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [batchExporting, setBatchExporting] = useState(false);

  const load = useCallback(async () => {
    const result = await getCollectionById(db, collectionId);
    if (!result) return;
    setCollection(result.collection);
    setObjects(result.objects);
    setName(result.collection.name);
    setDescription(result.collection.description ?? '');
  }, [db, collectionId]);

  useEffect(() => {
    load();
  }, [load]);

  // Reload when returning from AddObjectsScreen
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      load();
    });
    return unsub;
  }, [navigation, load]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchText);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchText]);

  const availableTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const o of objects) seen.add(o.object_type);
    return Array.from(seen);
  }, [objects]);

  const filteredObjects = useMemo(() => {
    let result = objects;
    if (selectedType) {
      result = result.filter((o) => o.object_type === selectedType);
    }
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      result = result.filter((o) => o.title.toLowerCase().includes(q));
    }
    return result;
  }, [objects, selectedType, debouncedQuery]);

  const isFiltering = debouncedQuery.trim().length > 0 || selectedType !== null;

  const handleNameBlur = useCallback(() => {
    if (collection && name.trim() && name !== collection.name) {
      updateCollection(db, collectionId, { name: name.trim() });
    }
  }, [name, collection, db, collectionId]);

  const handleDescriptionBlur = useCallback(() => {
    if (collection && description !== (collection.description ?? '')) {
      updateCollection(db, collectionId, {
        description: description.trim() || undefined,
      });
    }
  }, [description, collection, db, collectionId]);

  const navigateToObject = useCallback(
    (objectId: string) => {
      const tabNav =
        navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
      tabNav?.navigate('Objects', {
        screen: 'ObjectDetail',
        params: { objectId },
      });
    },
    [navigation],
  );

  const handleExportCollection = useCallback(async () => {
    setExporting(true);
    try {
      const uri = await exportCollectionToPDF(db, collectionId);
      await sharePDF(uri);
    } catch {
      Alert.alert(t('export.error_title'), t('export.error_message'));
    } finally {
      setExporting(false);
    }
  }, [db, collectionId, t]);

  // ── Selection mode handlers ──────────────────────────────────────────────

  const enterSelectionMode = useCallback((itemId: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([itemId]));
  }, []);

  const toggleSelection = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const allSelected = useMemo(
    () =>
      filteredObjects.length > 0 &&
      filteredObjects.every((o) => selectedIds.has(o.id)),
    [filteredObjects, selectedIds],
  );

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredObjects.map((o) => o.id)));
    }
  }, [allSelected, filteredObjects]);

  const handleBatchDelete = useCallback(() => {
    const count = selectedIds.size;
    Alert.alert(
      t('batch.delete_title'),
      t('batch.delete_confirm', { count }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              await deleteObject(db, id);
            }
            cancelSelection();
            await load();
          },
        },
      ],
    );
  }, [selectedIds, db, t, cancelSelection, load]);

  const handleBatchExport = useCallback(async () => {
    setBatchExporting(true);
    try {
      const ids = Array.from(selectedIds);
      const uri = await exportBatchToPDF(db, ids, t('batch.export_title'));
      await sharePDF(uri);
      cancelSelection();
    } catch {
      Alert.alert(t('export.error_title'), t('export.error_message'));
    } finally {
      setBatchExporting(false);
    }
  }, [selectedIds, db, t, cancelSelection]);

  const handleCollectionSelected = useCallback(
    async (collection: { id: string; name: string }) => {
      setShowCollectionPicker(false);
      const ids = Array.from(selectedIds);
      for (const objId of ids) {
        await addObjectToCollection(db, objId, collection.id);
      }
      Alert.alert(
        t('common.success'),
        t('batch.added_to_collection', { count: ids.length, name: collection.name }),
      );
      cancelSelection();
    },
    [selectedIds, db, t, cancelSelection],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const typeKey = (type: string) => `object_types.${type}` as const;

  const objectCountLabel = (count: number) => {
    if (count === 0) return t('collections.object_count_zero');
    if (count === 1) return t('collections.object_count_one');
    return t('collections.object_count', { count });
  };

  const renderObject = useCallback(
    ({ item }: { item: CollectionObject }) => (
      <Pressable
        style={[styles.objectRow, selectionMode && styles.objectRowSelection]}
        onPress={() =>
          selectionMode
            ? toggleSelection(item.id)
            : navigateToObject(item.id)
        }
        onLongPress={() => {
          if (!selectionMode) enterSelectionMode(item.id);
        }}
      >
        {selectionMode && (
          <View
            style={[
              styles.checkbox,
              selectedIds.has(item.id) && styles.checkboxChecked,
            ]}
          >
            {selectedIds.has(item.id) && (
              <Text style={styles.checkMark}>{'\u2713'}</Text>
            )}
          </View>
        )}
        {item.file_path ? (
          <Image source={{ uri: item.file_path }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbPlaceholderText}>{'\u25A3'}</Text>
          </View>
        )}
        <View style={styles.objectInfo}>
          <Text style={styles.objectTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.objectMeta}>
            <View style={styles.objectBadge}>
              <Text style={styles.objectBadgeText}>
                {t(typeKey(item.object_type))}
              </Text>
            </View>
            <Text style={styles.objectDate}>{item.created_at.slice(0, 10)}</Text>
          </View>
        </View>
      </Pressable>
    ),
    [t, navigateToObject, selectionMode, selectedIds, toggleSelection, enterSelectionMode],
  );

  if (!collection) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      {selectionMode ? (
        <SelectionHeader
          selectedCount={selectedIds.size}
          allSelected={allSelected}
          onToggleAll={toggleSelectAll}
          onCancel={cancelSelection}
          t={t}
        />
      ) : (
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{'\u2190'} {t('common.back')}</Text>
          </Pressable>
          <Pressable
            style={styles.exportBtn}
            onPress={handleExportCollection}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#74B9FF" />
            ) : (
              <Text style={styles.exportBtnText}>{t('export.export_pdf')}</Text>
            )}
          </Pressable>
        </View>
      )}

      <FlatList
        data={filteredObjects}
        keyExtractor={(item) => item.id}
        renderItem={renderObject}
        extraData={selectedIds}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          selectionMode ? undefined : (
            <View>
              {/* Editable name */}
              <FieldInput
                label={t('collections.create_screen.name')}
                value={name}
                onChangeText={setName}
                onBlur={handleNameBlur}
              />

              {/* Type badge + count */}
              <View style={styles.metaRow}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {t(`collections.type.${collection.collection_type}`)}
                  </Text>
                </View>
                <Text style={styles.countText}>
                  {objectCountLabel(objects.length)}
                </Text>
              </View>

              {/* Editable description */}
              <FieldInput
                label={t('collections.create_screen.description')}
                value={description}
                onChangeText={setDescription}
                onBlur={handleDescriptionBlur}
                multiline
                placeholder={t('collections.create_screen.description')}
              />

              {/* Add Objects button (always visible) */}
              <Pressable
                style={styles.addObjectsHeaderBtn}
                onPress={() =>
                  navigation.navigate('AddObjects', { collectionId })
                }
              >
                <Text style={styles.addObjectsHeaderBtnText}>
                  + {t('collections.detail.add_objects')}
                </Text>
              </Pressable>

              {/* Objects section header */}
              <Text style={styles.sectionTitle}>
                {t('objects.title')}
              </Text>

              {/* Search bar */}
              <View style={styles.searchRow}>
                <Text style={styles.searchIcon}>{'\uD83D\uDD0D'}</Text>
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder={t('collections.detail.search_placeholder')}
                  placeholderTextColor="#4A4A5A"
                  returnKeyType="search"
                  clearButtonMode="never"
                />
                {searchText.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setSearchText('');
                      setDebouncedQuery('');
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.clearBtn}>{'\u2715'}</Text>
                  </Pressable>
                )}
              </View>

              {/* Filtered count */}
              {isFiltering && (
                <Text style={styles.filterCount}>
                  {t('collections.detail.search_results', {
                    count: filteredObjects.length,
                    total: objects.length,
                  })}
                </Text>
              )}

              {/* Type filter chips */}
              {availableTypes.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  <Pressable
                    style={[
                      styles.filterChip,
                      selectedType === null && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedType(null)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedType === null && styles.filterChipTextActive,
                      ]}
                    >
                      {t('objects.filter_all')}
                    </Text>
                  </Pressable>
                  {availableTypes.map((type) => (
                    <Pressable
                      key={type}
                      style={[
                        styles.filterChip,
                        selectedType === type && styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setSelectedType(selectedType === type ? null : type)
                      }
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedType === type && styles.filterChipTextActive,
                        ]}
                      >
                        {t(`object_types.${type}`)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )
        }
        ListEmptyComponent={
          isFiltering ? (
            <View style={styles.emptyContent}>
              <Text style={styles.emptyText}>
                {t('collections.detail.search_empty')}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContent}>
              <Text style={styles.emptyText}>{t('collections.detail.empty')}</Text>
              <Pressable
                style={styles.addObjectsBtn}
                onPress={() =>
                  navigation.navigate('AddObjects', { collectionId })
                }
              >
                <Text style={styles.addObjectsBtnText}>
                  {t('collections.detail.add_objects')}
                </Text>
              </Pressable>
            </View>
          )
        }
      />

      {selectionMode && (
        <BatchActionButtons
          onAddToCollection={() => setShowCollectionPicker(true)}
          onExportPDF={handleBatchExport}
          onDelete={handleBatchDelete}
          disabled={selectedIds.size === 0}
          exporting={batchExporting}
          t={t}
        />
      )}

      <CollectionPickerModal
        visible={showCollectionPicker}
        onClose={() => setShowCollectionPicker(false)}
        onSelect={handleCollectionSelected}
        t={t}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backText: {
    color: '#74B9FF',
    fontSize: 16,
  },
  exportBtn: {
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportBtnText: {
    color: '#74B9FF',
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  typeBadge: {
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    color: '#74B9FF',
    fontSize: 12,
    fontWeight: '600',
  },
  countText: {
    color: '#636E72',
    fontSize: 13,
  },
  addObjectsHeaderBtn: {
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.2)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addObjectsHeaderBtnText: {
    color: '#74B9FF',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#DFE6E9',
    fontSize: 15,
    padding: 0,
  },
  clearBtn: {
    color: '#636E72',
    fontSize: 14,
    paddingLeft: 8,
  },
  filterCount: {
    color: '#636E72',
    fontSize: 13,
    marginBottom: 8,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.2)',
  },
  filterChipActive: {
    backgroundColor: '#74B9FF',
    borderColor: '#74B9FF',
  },
  filterChipText: {
    color: '#636E72',
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#08080F',
    fontWeight: '700',
  },
  objectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  objectRowSelection: {
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(116,185,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#74B9FF',
    borderColor: '#74B9FF',
  },
  checkMark: {
    color: '#08080F',
    fontSize: 13,
    fontWeight: '700',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1A1A2E',
  },
  thumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 20,
    color: '#2D2D3A',
  },
  objectInfo: {
    flex: 1,
    gap: 4,
  },
  objectTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  objectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  objectBadge: {
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  objectBadgeText: {
    color: '#74B9FF',
    fontSize: 10,
    fontWeight: '600',
  },
  objectDate: {
    color: '#636E72',
    fontSize: 11,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#636E72',
    fontSize: 15,
    marginBottom: 16,
  },
  addObjectsBtn: {
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addObjectsBtnText: {
    color: '#74B9FF',
    fontSize: 14,
    fontWeight: '500',
  },
});
