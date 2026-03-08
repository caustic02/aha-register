import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import type { ObjectStackParamList } from '../navigation/ObjectStack';

type Props = NativeStackScreenProps<ObjectStackParamList, 'ObjectList'>;

interface ObjectRow {
  id: string;
  title: string;
  object_type: string;
  created_at: string;
  file_path: string | null;
}

export function ObjectListScreen({ navigation }: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const [count, setCount] = useState(0);
  const [objects, setObjects] = useState<ObjectRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadObjects = useCallback(async () => {
    const countRow = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) as c FROM objects',
    );
    setCount(countRow?.c ?? 0);

    const rows = await db.getAllAsync<ObjectRow>(
      `SELECT o.id, o.title, o.object_type, o.created_at, m.file_path
       FROM objects o
       LEFT JOIN media m ON m.object_id = o.id AND m.is_primary = 1
       ORDER BY o.created_at DESC
       LIMIT 20`,
    );
    setObjects(rows);
  }, [db]);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  // Reload when returning from detail screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadObjects();
    });
    return unsubscribe;
  }, [navigation, loadObjects]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadObjects();
    setRefreshing(false);
  }, [loadObjects]);

  const typeKey = (type: string) => `object_types.${type}` as const;

  const renderItem = useCallback(
    ({ item }: { item: ObjectRow }) => (
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('ObjectDetail', { objectId: item.id })}
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
    [t, navigation],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('common.search')}</Text>
        <Text style={styles.headerCount}>{t('objects.header_count', { count })}</Text>
      </View>

      <FlatList
        data={objects}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={objects.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('objects.empty')}</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  headerCount: {
    color: '#636E72',
    fontSize: 14,
    marginTop: 4,
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
