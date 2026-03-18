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
import {
  getAllCollections,
  type CollectionWithCount,
} from '../services/collectionService';
import type { CollectionStackParamList } from '../navigation/CollectionStack';
import { colors, typography, spacing, radii, layout } from '../theme';
import { EmptyState } from '../components/ui';
import { CollectionsTabIcon } from '../theme/icons';

type Props = NativeStackScreenProps<CollectionStackParamList, 'CollectionList'>;

export function CollectionsScreen({ navigation }: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const rows = await getAllCollections(db);
    setCollections(rows);
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      load();
    });
    return unsub;
  }, [navigation, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const objectCountLabel = useCallback(
    (count: number) => {
      if (count === 0) return t('collections.object_count_zero');
      if (count === 1) return t('collections.object_count_one');
      return t('collections.object_count', { count });
    },
    [t],
  );

  const renderItem = useCallback(
    ({ item }: { item: CollectionWithCount }) => (
      <Pressable
        style={styles.card}
        onPress={() =>
          navigation.navigate('CollectionDetail', { collectionId: item.id })
        }
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {t(`collections.type.${item.collection_type}`)}
            </Text>
          </View>
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.cardCount}>{objectCountLabel(item.objectCount)}</Text>
      </Pressable>
    ),
    [t, navigation, objectCountLabel],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">{t('collections.title')}</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateCollection')}
          accessibilityRole="button"
          accessibilityLabel={t('collections.create')}
        >
          <Text style={styles.addBtnText}>{'\u002B'}</Text>
        </Pressable>
      </View>

      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          collections.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <EmptyState
            icon={<CollectionsTabIcon size={48} color={colors.textTertiary} />}
            title={t('empty_states.collections.title')}
            message={t('empty_states.collections.description')}
            actionLabel={t('collections.create')}
            onAction={() => navigation.navigate('CreateCollection')}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
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
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: colors.white,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: 24,
  },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.borderLight,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardName: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    flex: 1,
    marginRight: 10,
  },
  typeBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  typeBadgeText: {
    color: colors.accent,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  cardDesc: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  cardCount: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
