import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  getObjectsNotInCollection,
  addObjectToCollection,
  type PickerObject,
} from '../services/collectionService';
import type { CollectionStackParamList } from '../navigation/CollectionStack';
import { colors, typography, spacing, radii, layout } from '../theme';

type Props = NativeStackScreenProps<CollectionStackParamList, 'AddObjects'>;

export function AddObjectsScreen({ route, navigation }: Props) {
  const { collectionId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [objects, setObjects] = useState<PickerObject[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getObjectsNotInCollection(db, collectionId).then(setObjects);
  }, [db, collectionId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return objects;
    const q = search.trim().toLowerCase();
    return objects.filter((o) => o.title.toLowerCase().includes(q));
  }, [objects, search]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAdd = useCallback(async () => {
    if (selected.size === 0) return;
    setSaving(true);
    for (const objectId of selected) {
      await addObjectToCollection(db, objectId, collectionId);
    }
    navigation.goBack();
  }, [selected, db, collectionId, navigation]);

  const addLabel =
    selected.size === 1
      ? t('collections.add_objects.add_one')
      : t('collections.add_objects.add_count', { count: selected.size });

  const typeKey = (type: string) => `object_types.${type}` as const;

  const renderItem = useCallback(
    ({ item }: { item: PickerObject }) => {
      const isSelected = selected.has(item.id);
      return (
        <Pressable
          style={styles.row}
          onPress={() => toggleSelect(item.id)}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          accessibilityState={{ selected: isSelected }}
        >
          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
            {isSelected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
          </View>
          {item.file_path ? (
            <Image source={{ uri: item.file_path }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.thumbPlaceholderText}>{'\u25A3'}</Text>
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {t(typeKey(item.object_type))}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [selected, t, toggleSelect],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {t('collections.add_objects.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('collections.add_objects.search')}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {t('collections.add_objects.all_added')}
          </Text>
        }
      />

      {selected.size > 0 && (
        <View style={styles.footer}>
          <Pressable
            style={[styles.addBtn, saving && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            accessibilityState={{ disabled: saving }}
          >
            <Text style={styles.addBtnText}>{addLabel}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text,
  },
  headerSpacer: {
    width: 60,
  },
  cancelText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  searchContainer: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.textPrimary,
    fontSize: typography.size.md,
    padding: spacing.md,
  },
  list: {
    paddingHorizontal: layout.screenPadding,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.overlayLight,
  },
  thumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: typography.size.lg,
    color: colors.border,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    color: colors.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  badge: {
    backgroundColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: colors.accent,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
  },
  footer: {
    padding: layout.screenPadding,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: colors.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
});
