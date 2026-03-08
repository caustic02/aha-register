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
import type { ObjectStackParamList } from '../navigation/ObjectStack';

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

  const handleDelete = useCallback(
    (item: ObjectRow) => {
      Alert.alert(
        t('objects.delete_title'),
        t('objects.delete_confirm', { title: item.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              await deleteObject(db, item.id);
              await loadObjects();
            },
          },
        ],
      );
    },
    [db, t, loadObjects],
  );

  const typeKey = (type: string) => `object_types.${type}` as const;

  const renderItem = useCallback(
    ({ item }: { item: ObjectRow }) => (
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('ObjectDetail', { objectId: item.id })}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.rowContent}>
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
    [t, navigation, handleDelete],
  );

  const emptyText =
    isFiltering ? t('objects.search_empty') : t('objects.empty');

  const countLabel = isFiltering
    ? t('objects.search_results', { count: filteredObjects.length, total: objects.length })
    : t('objects.header_count', { count: objects.length });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Search bar */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>{'\uD83D\uDD0D'}</Text>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t('objects.search_placeholder')}
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

      <FlatList
        data={filteredObjects}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
            tintColor="#74B9FF"
          />
        }
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
    paddingTop: 60,
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
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
  headerCount: {
    color: '#636E72',
    fontSize: 13,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  filterRow: {
    paddingHorizontal: 20,
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
  row: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowContent: {
    gap: 6,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#74B9FF',
    fontSize: 11,
    fontWeight: '600',
  },
  rowDate: {
    color: '#636E72',
    fontSize: 12,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#636E72',
    fontSize: 16,
  },
});
