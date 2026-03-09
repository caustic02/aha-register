import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { deleteObject } from '../services/objectService';
import { addObjectToCollection } from '../services/collectionService';
import { exportBatchToPDF, sharePDF } from '../services/exportService';
import { SelectionHeader, BatchActionButtons } from '../components/BatchActionBar';
import { CollectionPickerModal } from '../components/CollectionPickerModal';
import type { ObjectStackParamList } from '../navigation/ObjectStack';
import { colors, typography, spacing, radii, layout } from '../theme';

type Props = NativeStackScreenProps<ObjectStackParamList, 'ObjectList'>;

interface ObjectRow {
  id: string;
  title: string;
  object_type: string;
  description: string | null;
  created_at: string;
  file_path: string | null;
}

export function ObjectListScreen({ navigation }: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const [objects, setObjects] = useState<ObjectRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [batchExporting, setBatchExporting] = useState(false);

  const loadObjects = useCallback(async () => {
    const rows = await db.getAllAsync<ObjectRow>(
      `SELECT o.id, o.title, o.object_type, o.description, o.created_at, m.file_path
       FROM objects o
       LEFT JOIN media m ON m.object_id = o.id AND m.is_primary = 1
       ORDER BY o.created_at DESC`,
    );
    setObjects(rows);
  }, [db]);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadObjects();
    });
    return unsubscribe;
  }, [navigation, loadObjects]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadObjects();
    setRefreshing(false);
  }, [loadObjects]);

  // Unique types present in the loaded data
  const availableTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const o of objects) seen.add(o.object_type);
    return Array.from(seen);
  }, [objects]);

  // Apply text + type filters
  const filteredObjects = useMemo(() => {
    let result = objects;
    if (selectedType) {
      result = result.filter((o) => o.object_type === selectedType);
    }
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      result = result.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.object_type.toLowerCase().includes(q) ||
          (o.description ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [objects, selectedType, debouncedQuery]);

  const isFiltering = debouncedQuery.trim().length > 0 || selectedType !== null;

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

  // Batch delete
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
            await loadObjects();
          },
        },
      ],
    );
  }, [selectedIds, db, t, cancelSelection, loadObjects]);

  // Batch export
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

  // Batch add to collection
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

  const renderItem = useCallback(
    ({ item }: { item: ObjectRow }) => (
      <Pressable
        style={[styles.row, selectionMode && styles.rowSelection]}
        onPress={() =>
          selectionMode
            ? toggleSelection(item.id)
            : navigation.navigate('ObjectDetail', { objectId: item.id })
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
        <View style={[styles.rowContent, selectionMode && styles.rowContentFlex]}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.rowMeta}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {t(typeKey(item.object_type))}
              </Text>
            </View>
            <Text style={styles.rowDate}>
              {item.created_at.slice(0, 10)}
            </Text>
          </View>
        </View>
      </Pressable>
    ),
    [t, navigation, selectionMode, selectedIds, toggleSelection, enterSelectionMode],
  );

  const emptyText =
    isFiltering ? t('objects.search_empty') : t('objects.empty');

  const countLabel = isFiltering
    ? t('objects.search_results', { count: filteredObjects.length, total: objects.length })
    : t('objects.header_count', { count: objects.length });

  return (
    <View style={styles.container}>
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
          {/* Search bar */}
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>{'\uD83D\uDD0D'}</Text>
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder={t('objects.search_placeholder')}
              placeholderTextColor={colors.textMuted}
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

          {/* Count */}
          <Text style={styles.headerCount}>{countLabel}</Text>

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
                    {t(typeKey(type))}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <FlatList
        data={filteredObjects}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={selectedIds}
        contentContainerStyle={
          filteredObjects.length === 0 ? styles.emptyList : undefined
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>{emptyText}</Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
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
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: layout.screenPadding,
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: typography.size.base,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.size.md,
    padding: 0,
  },
  clearBtn: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    paddingLeft: spacing.sm,
  },
  headerCount: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.sm,
  },
  filterRow: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: typography.weight.bold,
  },
  row: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  rowSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowContent: {
    gap: spacing.sm,
  },
  rowContentFlex: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    backgroundColor: colors.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  badgeText: {
    color: colors.accent,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  rowDate: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkMark: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
  },
});
