import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  getAllCollections,
  type CollectionWithCount,
} from '../services/collectionService';
import type { CollectionStackParamList } from '../navigation/CollectionStack';
import { typography, spacing, radii, layout, touch } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { EmptyState } from '../components/ui';
import { BackIcon, CollectionsTabIcon } from '../theme/icons';

type Props = NativeStackScreenProps<CollectionStackParamList, 'CollectionList'>;

export function CollectionsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
    [t, navigation, objectCountLabel, styles],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={touch.hitSlop}
            accessibilityLabel={t('common.back')}
            accessibilityRole="button"
          >
            <BackIcon size={24} color={colors.text} />
          </Pressable>
        )}
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
            tintColor={colors.heroGreen}
          />
        }
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: touch.minTarget,
    height: touch.minTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h1,
    color: c.text,
    flex: 1,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: c.heroGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: c.white,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: 24,
  },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: c.borderLight,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardName: {
    color: c.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    flex: 1,
    marginRight: 10,
  },
  typeBadge: {
    backgroundColor: c.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  typeBadgeText: {
    color: c.heroGreen,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  cardDesc: {
    color: c.textSecondary,
    fontSize: typography.size.sm,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  cardCount: {
    color: c.textSecondary,
    fontSize: typography.size.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); }
