import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  Badge,
  EmptyState,
  IconButton,
  ListItem,
} from '../components/ui';
import {
  FilterSheet,
  type FilterState,
  type SortOption,
} from '../components/FilterSheet';
import { ExportStepperModal, type ExportSource } from '../components/ExportStepperModal';
import {
  BackIcon,
  CaptureTabIcon,
  CheckboxBlankIcon,
  CheckboxFilledIcon,
  CloseIcon,
  ExportIcon,
  FiltersIcon,
  GridViewIcon,
  ListViewIcon,
  ObjectsTabIcon,
  SearchIcon,
} from '../theme/icons';
import { colors, radii, spacing, touch, typography } from '../theme';
import { formatRelativeDate } from '../utils/format-date';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { ObjectType } from '../db/types';
import { useSyncStatuses } from '../hooks/useSyncStatuses';
import { SyncBadge } from '../components/SyncBadge';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'ObjectList'>;

interface ObjectRow {
  id: string;
  title: string;
  object_type: ObjectType;
  created_at: string;
  thumbnail: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;
const STORAGE_KEY_VIEW = 'objectList.viewMode';

type ViewMode = 'list' | 'grid';

// ── Sort helpers ──────────────────────────────────────────────────────────────

function buildOrderClause(sortBy: SortOption): string {
  switch (sortBy) {
    case 'oldest':
      return 'ORDER BY o.created_at ASC';
    case 'az':
      return 'ORDER BY o.title COLLATE NOCASE ASC';
    case 'za':
      return 'ORDER BY o.title COLLATE NOCASE DESC';
    default:
      return 'ORDER BY o.created_at DESC';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ObjectListScreen({ navigation, route }: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const filterSheetRef = useRef<BottomSheet>(null);

  // Route-param filter for review status (from HomeScreen inbox → "Review all")
  const reviewStatusFilter = route.params?.filterReviewStatus ?? null;

  const [objects, setObjects] = useState<ObjectRow[]>([]);
  const [availableTypes, setAvailableTypes] = useState<ObjectType[]>([]);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<FilterState>({
    objectTypes: [],
    sortBy: 'newest',
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Batch selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Export stepper
  const [showExportStepper, setShowExportStepper] = useState(false);
  const [exportSource, setExportSource] = useState<ExportSource | null>(null);

  // Sync status badges
  const objectIds = useMemo(() => objects.map((o) => o.id), [objects]);
  const syncStatuses = useSyncStatuses(objectIds);

  // ── Load view mode preference ───────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_VIEW).then((val) => {
      if (val === 'grid' || val === 'list') setViewMode(val);
    });
  }, []);

  // ── Debounce search input ─────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText]);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadTypes = useCallback(async () => {
    try {
      const rows = await db.getAllAsync<{ object_type: ObjectType }>(
        'SELECT DISTINCT object_type FROM objects ORDER BY object_type',
      );
      setAvailableTypes(rows.map((r) => r.object_type));
    } catch {
      setAvailableTypes([]);
    }
  }, [db]);

  const loadObjects = useCallback(async () => {
    try {
      const conditions: string[] = [];
      const params: (string | number | null)[] = [];

      if (reviewStatusFilter) {
        conditions.push('o.review_status = ?');
        params.push(reviewStatusFilter);
      }

      if (debouncedSearch.trim().length > 0) {
        const like = `%${debouncedSearch.trim()}%`;
        conditions.push(
          '(o.title LIKE ? OR o.inventory_number LIKE ? OR o.description LIKE ?)',
        );
        params.push(like, like, like);
      }

      if (filters.objectTypes.length > 0) {
        const placeholders = filters.objectTypes.map(() => '?').join(', ');
        conditions.push(`o.object_type IN (${placeholders})`);
        params.push(...filters.objectTypes);
      }

      const where =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const order = buildOrderClause(filters.sortBy);

      const rows = await db.getAllAsync<ObjectRow>(
        `SELECT o.id, o.title, o.object_type, o.created_at,
                m.file_path AS thumbnail
         FROM objects o
         LEFT JOIN media m ON m.object_id = o.id AND m.is_primary = 1
         ${where}
         ${order}`,
        params,
      );
      setObjects(rows);
    } catch {
      setObjects([]);
    }
  }, [db, debouncedSearch, filters, reviewStatusFilter]);

  useFocusEffect(
    useCallback(() => {
      loadTypes();
    }, [loadTypes]),
  );

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === 'list' ? 'grid' : 'list';
      AsyncStorage.setItem(STORAGE_KEY_VIEW, next);
      return next;
    });
  }, []);

  const openFilterSheet = useCallback(() => {
    filterSheetRef.current?.snapToIndex(0);
  }, []);

  const handleApplyFilters = useCallback((f: FilterState) => {
    setFilters(f);
  }, []);

  const removeTypeFilter = useCallback((type: ObjectType) => {
    setFilters((prev) => ({
      ...prev,
      objectTypes: prev.objectTypes.filter((t) => t !== type),
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchText('');
    setDebouncedSearch('');
    setFilters({ objectTypes: [], sortBy: 'newest' });
  }, []);

  // ── Batch selection ────────────────────────────────────────────────────────

  const enterSelectMode = useCallback(
    (id: string) => {
      setSelectMode(true);
      setSelectedIds(new Set([id]));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [],
  );

  const toggleSelection = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [],
  );

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const hasActiveFilters =
    searchText.trim().length > 0 || filters.objectTypes.length > 0 || !!reviewStatusFilter;

  const renderListItem = useCallback(
    ({ item }: { item: ObjectRow }) => {
      const isSelected = selectedIds.has(item.id);
      const itemSyncStatus = selectMode
        ? undefined
        : (syncStatuses.get(item.id) ?? 'synced');
      return (
        <ListItem
          title={item.title}
          subtitle={formatRelativeDate(item.created_at)}
          thumbnail={item.thumbnail ? { uri: item.thumbnail } : undefined}
          badge={{
            label: t(`object_types.${item.object_type}`),
            variant: 'neutral',
          }}
          leftElement={
            selectMode ? (
              <View style={styles.checkboxWrap}>
                {isSelected ? (
                  <CheckboxFilledIcon size={22} color={colors.primary} />
                ) : (
                  <CheckboxBlankIcon size={22} color={colors.textTertiary} />
                )}
              </View>
            ) : undefined
          }
          rightElement={
            itemSyncStatus && itemSyncStatus !== 'synced' ? (
              <SyncBadge status={itemSyncStatus} size="sm" />
            ) : undefined
          }
          onPress={() => {
            if (selectMode) {
              toggleSelection(item.id);
            } else {
              navigation.navigate('ObjectDetail', { objectId: item.id });
            }
          }}
          onLongPress={() => {
            if (!selectMode) enterSelectMode(item.id);
          }}
        />
      );
    },
    [navigation, t, selectMode, selectedIds, syncStatuses, toggleSelection, enterSelectMode],
  );

  const renderGridItem = useCallback(
    ({ item }: { item: ObjectRow }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <Pressable
          style={styles.gridCell}
          onPress={() => {
            if (selectMode) {
              toggleSelection(item.id);
            } else {
              navigation.navigate('ObjectDetail', { objectId: item.id });
            }
          }}
          onLongPress={() => {
            if (!selectMode) enterSelectMode(item.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          {item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              style={styles.gridImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.gridImage, styles.gridPlaceholder]}>
              <ObjectsTabIcon size={24} color={colors.textTertiary} />
            </View>
          )}
          {selectMode && (
            <View style={styles.gridCheckbox}>
              {isSelected ? (
                <CheckboxFilledIcon size={20} color={colors.primary} />
              ) : (
                <CheckboxBlankIcon size={20} color={colors.white} />
              )}
            </View>
          )}
          {!selectMode && (
            <View style={styles.gridSyncBadge}>
              <SyncBadge
                status={syncStatuses.get(item.id) ?? 'synced'}
                size="sm"
              />
            </View>
          )}
          <Text style={styles.gridTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </Pressable>
      );
    },
    [navigation, selectMode, selectedIds, syncStatuses, toggleSelection, enterSelectMode],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {selectMode ? (
        <View style={styles.headerRow}>
          <IconButton
            icon={<CloseIcon size={24} color={colors.text} />}
            onPress={exitSelectMode}
            accessibilityLabel={t('common.cancel')}
          />
          <Text style={styles.headerTitle}>
            {selectedIds.size} {t('collection.selected')}
          </Text>
          <IconButton
            icon={<ExportIcon size={22} color={colors.primary} />}
            onPress={() => {
              const ids = Array.from(selectedIds);
              setExportSource({
                mode: 'batch',
                objectIds: ids,
                title: t('batch.export_title'),
              });
              setShowExportStepper(true);
            }}
            accessibilityLabel={t('home.exportCollection')}
            disabled={selectedIds.size === 0}
          />
        </View>
      ) : (
        <View style={styles.headerRow}>
          <IconButton
            icon={<BackIcon size={24} color={colors.text} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back')}
          />
          <Text style={styles.headerTitle} accessibilityRole="header">
            {reviewStatusFilter ? t('inbox.title') : t('objectList.title')}
          </Text>
          <Badge label={String(objects.length)} variant="neutral" size="sm" />
          <IconButton
            icon={
              viewMode === 'list' ? (
                <GridViewIcon size={22} color={colors.text} />
              ) : (
                <ListViewIcon size={22} color={colors.text} />
              )
            }
            onPress={toggleViewMode}
            accessibilityLabel={
              viewMode === 'list'
                ? t('collection.gridView')
                : t('collection.listView')
            }
          />
          <IconButton
            icon={<FiltersIcon size={22} color={colors.text} />}
            onPress={openFilterSheet}
            accessibilityLabel={t('collection.filterTitle')}
          />
        </View>
      )}

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      {!selectMode && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <View style={styles.searchIconWrapper}>
              <SearchIcon size={18} color={colors.textTertiary} />
            </View>
            <RNTextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder={t('objectList.searchPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              style={styles.searchInput}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel={t('objectList.searchPlaceholder')}
            />
            {searchText.length > 0 && (
              <Pressable
                onPress={() => setSearchText('')}
                hitSlop={touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={styles.clearButton}
              >
                <CloseIcon size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* ── Review status filter chip ──────────────────────────────────────── */}
      {!selectMode && reviewStatusFilter && (
        <View style={styles.activeChipsContent}>
          <View style={styles.activeChip}>
            <Text style={styles.activeChipText}>
              {t(`review_status.${reviewStatusFilter}`)}
            </Text>
          </View>
        </View>
      )}

      {/* ── Active filter chips ────────────────────────────────────────────── */}
      {!selectMode && filters.objectTypes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeChipsContent}
          style={styles.activeChipsScroll}
        >
          {filters.objectTypes.map((type) => (
            <Pressable
              key={type}
              style={styles.activeChip}
              onPress={() => removeTypeFilter(type)}
              accessibilityRole="button"
              accessibilityLabel={`${t(`object_types.${type}`)} — ${t('common.cancel')}`}
            >
              <Text style={styles.activeChipText}>
                {t(`object_types.${type}`)}
              </Text>
              <CloseIcon size={12} color={colors.primary} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {objects.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={
              hasActiveFilters
                ? <SearchIcon size={48} color={colors.textTertiary} />
                : <CaptureTabIcon size={48} color={colors.textTertiary} />
            }
            title={
              hasActiveFilters
                ? t('empty_states.search.title')
                : t('empty_states.objects.title')
            }
            message={
              hasActiveFilters
                ? t('empty_states.search.description')
                : t('empty_states.objects.description')
            }
            actionLabel={
              hasActiveFilters ? t('objectList.clearFilters') : undefined
            }
            onAction={hasActiveFilters ? handleClearFilters : undefined}
          />
        </View>
      ) : viewMode === 'list' ? (
        <FlashList
          data={objects}
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          ListFooterComponent={ListFooterSpacer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          extraData={selectMode ? selectedIds.size : 0}
        />
      ) : (
        <FlashList
          data={objects}
          keyExtractor={(item) => item.id}
          renderItem={renderGridItem}
          ListFooterComponent={ListFooterSpacer}
          numColumns={3}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          extraData={selectMode ? selectedIds.size : 0}
        />
      )}

      {/* ── Filter bottom sheet ───────────────────────────────────────────── */}
      <FilterSheet
        sheetRef={filterSheetRef}
        availableTypes={availableTypes}
        initialFilters={filters}
        onApply={handleApplyFilters}
      />

      <ExportStepperModal
        visible={showExportStepper}
        onClose={() => setShowExportStepper(false)}
        source={exportSource}
        onExportComplete={exitSelectMode}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FOOTER_PAD = { height: 100 };
const ListFooterSpacer = () => <View style={FOOTER_PAD} />;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text,
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  // Search bar
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: touch.minTarget,
  },
  searchIconWrapper: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  // Active filter chips
  activeChipsScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activeChipsContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primaryContainer,
  },
  activeChipText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  // Empty state
  emptyWrap: {
    flex: 1,
  },
  // Checkbox in select mode
  checkboxWrap: {
    marginRight: spacing.md,
  },
  // Grid view
  gridCell: {
    flex: 1,
    margin: 2,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  gridImage: {
    width: '100%',
    aspectRatio: 1,
  },
  gridPlaceholder: {
    backgroundColor: colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTitle: {
    ...typography.caption,
    color: colors.text,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  gridCheckbox: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  gridSyncBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
});
