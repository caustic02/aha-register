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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  getObjectsNotInCollection,
  addObjectToCollection,
  type PickerObject,
} from '../services/collectionService';
import type { CollectionStackParamList } from '../navigation/CollectionStack';

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
        <Pressable style={styles.row} onPress={() => toggleSelect(item.id)}>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
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
          placeholderTextColor="#4A4A5A"
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
          >
            <Text style={styles.addBtnText}>{addLabel}</Text>
          </Pressable>
        </View>
      )}
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
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 60,
  },
  cancelText: {
    color: '#636E72',
    fontSize: 16,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.1)',
    borderRadius: 10,
    color: '#DFE6E9',
    fontSize: 15,
    padding: 12,
  },
  list: {
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(116,185,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#0984E3',
    borderColor: '#0984E3',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1A1A2E',
  },
  thumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 18,
    color: '#2D2D3A',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#74B9FF',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#636E72',
    fontSize: 15,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(116,185,255,0.08)',
    backgroundColor: '#0A0A14',
  },
  addBtn: {
    backgroundColor: '#0984E3',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
