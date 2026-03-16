import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  Badge,
  ChipGroup,
  EmptyState,
  IconButton,
  ListItem,
} from '../components/ui';
import {
  BackIcon,
  CloseIcon,
  ObjectsTabIcon,
  SearchIcon,
} from '../theme/icons';
import { colors, radii, spacing, touch, typography } from '../theme';
import { formatRelativeDate } from '../utils/format-date';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { ObjectType } from '../db/types';

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

const ITEM_HEIGHT = 72;
const ALL_TYPES = 'all';
const DEBOUNCE_MS = 300;

// ── Component ─────────────────────────────────────────────────────────────────

export function ObjectListScreen({ navigation }: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [objects, setObjects] = useState<ObjectRow[]>([]);
  const [availableTypes, setAvailableTypes] = useState<ObjectType[]>([]);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeType, setActiveType] = useState<string>(ALL_TYPES);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      if (debouncedSearch.trim().length > 0) {
        const like = `%${debouncedSearch.trim()}%`;
        conditions.push(
          '(o.title LIKE ? OR o.inventory_number LIKE ? OR o.description LIKE ?)',
        );
        params.push(like, like, like);
      }

      if (activeType !== ALL_TYPES) {
        conditions.push('o.object_type = ?');
        params.push(activeType);
      }

      const where =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await db.getAllAsync<ObjectRow>(
        `SELECT o.id, o.title, o.object_type, o.created_at,
                m.file_path AS thumbnail
         FROM objects o
         LEFT JOIN media m ON m.object_id = o.id AND m.is_primary = 1
         ${where}
         ORDER BY o.created_at DESC`,
        params,
      );
      setObjects(rows);
    } catch {
      setObjects([]);
    }
  }, [db, debouncedSearch, activeType]);

  useFocusEffect(
    useCallback(() => {
      loadTypes();
    }, [loadTypes]),
  );

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  // ── Chip options ──────────────────────────────────────────────────────────

  const chipOptions = [
    { label: t('objectList.allTypes'), value: ALL_TYPES },
    ...availableTypes.map((type) => ({
      label: t(`object_types.${type}`),
      value: type,
    })),
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectType = useCallback((value: string | string[]) => {
    setActiveType(Array.isArray(value) ? (value[0] ?? ALL_TYPES) : value);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchText('');
    setDebouncedSearch('');
    setActiveType(ALL_TYPES);
  }, []);

  // ── FlatList helpers ──────────────────────────────────────────────────────

  const keyExtractor = useCallback((item: ObjectRow) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<ObjectRow> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: ObjectRow }) => (
      <ListItem
        title={item.title}
        subtitle={formatRelativeDate(item.created_at)}
        thumbnail={item.thumbnail ? { uri: item.thumbnail } : undefined}
        badge={{
          label: t(`object_types.${item.object_type}`),
          variant: 'neutral',
        }}
        onPress={() =>
          navigation.navigate('ObjectDetail', { objectId: item.id })
        }
      />
    ),
    [navigation, t],
  );

  const hasActiveFilters =
    searchText.trim().length > 0 || activeType !== ALL_TYPES;

  const ListEmpty = (
    <EmptyState
      icon={<ObjectsTabIcon size={32} color={colors.textTertiary} />}
      title={t('objectList.emptySearch')}
      message={hasActiveFilters ? t('objectList.emptyMessage') : ''}
      actionLabel={hasActiveFilters ? t('objectList.clearFilters') : undefined}
      onAction={hasActiveFilters ? handleClearFilters : undefined}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <IconButton
          icon={<BackIcon size={24} color={colors.text} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        />
        <Text style={styles.headerTitle} accessibilityRole="header">{t('objectList.title')}</Text>
        <Badge label={String(objects.length)} variant="neutral" size="sm" />
      </View>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
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

      {/* ── Type filter chips ─────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScrollContent}
        style={styles.chipScroll}
      >
        <ChipGroup
          options={chipOptions}
          selected={activeType}
          onSelect={handleSelectType}
        />
      </ScrollView>

      {/* ── Results list ──────────────────────────────────────────────────── */}
      <FlatList
        data={objects}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListEmptyComponent={ListEmpty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        contentContainerStyle={
          objects.length === 0 ? styles.flatListEmpty : undefined
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  // Search bar (custom — ui TextInput requires label + doesn't support icons)
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
  // Type chips
  chipScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // FlatList empty state
  flatListEmpty: {
    flexGrow: 1,
  },
});
