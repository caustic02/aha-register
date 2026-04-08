import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
// Bottom tabs removed - using single stack
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
import { deleteObject } from '../services/objectService';
import { IconButton } from '../components/ui';
import { SelectionHeader, BatchActionButtons } from '../components/BatchActionBar';
import { ExportStepperModal, type ExportSource } from '../components/ExportStepperModal';
import { BackIcon } from '../theme/icons';
import { CollectionPickerModal } from '../components/CollectionPickerModal';
import type { RootStackParamList } from '../navigation/RootStack';
import { typography, spacing, radii, layout, touch } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { resolveMediaUri } from '../utils/resolveMediaUri';

type Props = NativeStackScreenProps<RootStackParamList, 'CollectionDetail'>;

export function CollectionDetailScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { collectionId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [objects, setObjects] = useState<CollectionObject[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  // Export stepper
  const [showExportStepper, setShowExportStepper] = useState(false);
  const [exportSource, setExportSource] = useState<ExportSource | null>(null);

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
      navigation.navigate('ObjectDetail', { objectId });
    },
    [navigation],
  );

  const handleExportCollection = useCallback(() => {
    setExportSource({
      mode: 'collection',
      collectionId,
      collectionName: collection?.name ?? '',
    });
    setShowExportStepper(true);
  }, [collectionId, collection?.name]);

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

  const handleBatchExport = useCallback(() => {
    const ids = Array.from(selectedIds);
    setExportSource({
      mode: 'batch',
      objectIds: ids,
      title: t('batch.export_title'),
    });
    setShowExportStepper(true);
  }, [selectedIds, t]);

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
        accessibilityRole="button"
        accessibilityLabel={item.title}
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
          <Image source={{ uri: resolveMediaUri(item.file_path) }} style={styles.thumb} />
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
    [t, navigateToObject, selectionMode, selectedIds, toggleSelection, enterSelectionMode, styles],
  );

  if (!collection) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          <IconButton
            icon={<BackIcon size={24} color={colors.text} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back')}
          />
          <Pressable
            style={styles.exportBtn}
            onPress={handleExportCollection}
            accessibilityRole="button"
            accessibilityLabel={t('export.export_pdf')}
          >
            <Text style={styles.exportBtnText}>{t('export.export_pdf')}</Text>
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
                accessibilityRole="button"
                accessibilityLabel={t('collections.detail.add_objects')}
              >
                <Text style={styles.addObjectsHeaderBtnText}>
                  + {t('collections.detail.add_objects')}
                </Text>
              </Pressable>

              {/* Objects section header */}
              <Text style={styles.sectionTitle} accessibilityRole="header">
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
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="search"
                  clearButtonMode="never"
                  accessibilityLabel={t('collections.detail.search_placeholder')}
                />
                {searchText.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setSearchText('');
                      setDebouncedQuery('');
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.cancel')}
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
                    accessibilityRole="button"
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
                      accessibilityRole="button"
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
                accessibilityRole="button"
                accessibilityLabel={t('collections.detail.add_objects')}
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
          exporting={false}
          t={t}
        />
      )}

      <CollectionPickerModal
        visible={showCollectionPicker}
        onClose={() => setShowCollectionPicker(false)}
        onSelect={handleCollectionSelected}
        t={t}
      />

      <ExportStepperModal
        visible={showExportStepper}
        onClose={() => setShowExportStepper(false)}
        source={exportSource}
        onExportComplete={cancelSelection}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  exportBtn: {
    backgroundColor: c.border,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minHeight: touch.minTarget,
    justifyContent: 'center',
  },
  exportBtnText: {
    color: c.heroGreen,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 40,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.lg,
  },
  typeBadge: {
    backgroundColor: c.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  typeBadgeText: {
    color: c.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  countText: {
    color: c.textSecondary,
    fontSize: typography.size.sm,
  },
  addObjectsHeaderBtn: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addObjectsHeaderBtnText: {
    color: c.heroGreen,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  sectionTitle: {
    color: c.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.borderLight,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    fontSize: typography.size.base,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: c.textPrimary,
    fontSize: typography.size.md,
    padding: 0,
  },
  clearBtn: {
    color: c.textSecondary,
    fontSize: typography.size.base,
    paddingLeft: spacing.sm,
  },
  filterCount: {
    color: c.textSecondary,
    fontSize: typography.size.sm,
    marginBottom: spacing.sm,
  },
  filterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.border,
  },
  filterChipActive: {
    backgroundColor: c.heroGreen,
    borderColor: c.heroGreen,
  },
  filterChipText: {
    color: c.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  filterChipTextActive: {
    color: c.background,
    fontWeight: typography.weight.bold,
  },
  objectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
    gap: spacing.md,
  },
  objectRowSelection: {
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: c.heroGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: c.heroGreen,
    borderColor: c.heroGreen,
  },
  checkMark: {
    color: c.background,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: c.overlayLight,
  },
  thumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: c.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: typography.size.xl,
    color: c.border,
  },
  objectInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  objectTitle: {
    color: c.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  objectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  objectBadge: {
    backgroundColor: c.surfaceContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  objectBadgeText: {
    color: c.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  objectDate: {
    color: c.textSecondary,
    fontSize: typography.size.xs,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    color: c.textSecondary,
    fontSize: typography.size.md,
    marginBottom: spacing.lg,
  },
  addObjectsBtn: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: 10,
  },
  addObjectsBtnText: {
    color: c.heroGreen,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
}); }
