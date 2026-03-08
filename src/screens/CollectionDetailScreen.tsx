import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { FieldInput } from '../components/FieldInput';
import {
  getCollectionById,
  updateCollection,
  removeObjectFromCollection,
  type CollectionObject,
} from '../services/collectionService';
import type { Collection } from '../db/types';
import { exportCollectionToPDF, sharePDF } from '../services/exportService';
import type { CollectionStackParamList } from '../navigation/CollectionStack';
import type { MainTabParamList } from '../navigation/MainTabs';

type Props = NativeStackScreenProps<CollectionStackParamList, 'CollectionDetail'>;

export function CollectionDetailScreen({ route, navigation }: Props) {
  const { collectionId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [objects, setObjects] = useState<CollectionObject[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exporting, setExporting] = useState(false);

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
      const tabNav =
        navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
      tabNav?.navigate('Objects', {
        screen: 'ObjectDetail',
        params: { objectId },
      });
    },
    [navigation],
  );

  const handleRemoveObject = useCallback(
    (objectId: string) => {
      Alert.alert(
        t('collections.remove_object'),
        t('collections.remove_confirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              await removeObjectFromCollection(db, objectId, collectionId);
              load();
            },
          },
        ],
      );
    },
    [db, collectionId, t, load],
  );

  const handleExportCollection = useCallback(async () => {
    setExporting(true);
    try {
      const uri = await exportCollectionToPDF(db, collectionId);
      await sharePDF(uri);
    } catch {
      Alert.alert(t('export.error_title'), t('export.error_message'));
    } finally {
      setExporting(false);
    }
  }, [db, collectionId, t]);

  const typeKey = (type: string) => `object_types.${type}` as const;

  const objectCountLabel = (count: number) => {
    if (count === 0) return t('collections.object_count_zero');
    if (count === 1) return t('collections.object_count_one');
    return t('collections.object_count', { count });
  };

  const renderObject = useCallback(
    ({ item }: { item: CollectionObject }) => (
      <Pressable
        style={styles.objectRow}
        onPress={() => navigateToObject(item.id)}
        onLongPress={() => handleRemoveObject(item.id)}
      >
        {item.file_path ? (
          <Image source={{ uri: item.file_path }} style={styles.thumb} />
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
    [t, navigateToObject, handleRemoveObject],
  );

  if (!collection) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2190'} {t('common.back')}</Text>
        </Pressable>
        <Pressable
          style={styles.exportBtn}
          onPress={handleExportCollection}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#74B9FF" />
          ) : (
            <Text style={styles.exportBtnText}>{t('export.export_pdf')}</Text>
          )}
        </Pressable>
      </View>

      <FlatList
        data={objects}
        keyExtractor={(item) => item.id}
        renderItem={renderObject}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
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
            >
              <Text style={styles.addObjectsHeaderBtnText}>
                + {t('collections.detail.add_objects')}
              </Text>
            </Pressable>

            {/* Objects section header */}
            <Text style={styles.sectionTitle}>
              {t('objects.title')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Text style={styles.emptyText}>{t('collections.detail.empty')}</Text>
            <Pressable
              style={styles.addObjectsBtn}
              onPress={() =>
                navigation.navigate('AddObjects', { collectionId })
              }
            >
              <Text style={styles.addObjectsBtnText}>
                {t('collections.detail.add_objects')}
              </Text>
            </Pressable>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backText: {
    color: '#74B9FF',
    fontSize: 16,
  },
  exportBtn: {
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportBtnText: {
    color: '#74B9FF',
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  typeBadge: {
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    color: '#74B9FF',
    fontSize: 12,
    fontWeight: '600',
  },
  countText: {
    color: '#636E72',
    fontSize: 13,
  },
  addObjectsHeaderBtn: {
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.2)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addObjectsHeaderBtnText: {
    color: '#74B9FF',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  objectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1A1A2E',
  },
  thumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 20,
    color: '#2D2D3A',
  },
  objectInfo: {
    flex: 1,
    gap: 4,
  },
  objectTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  objectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  objectBadge: {
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  objectBadgeText: {
    color: '#74B9FF',
    fontSize: 10,
    fontWeight: '600',
  },
  objectDate: {
    color: '#636E72',
    fontSize: 11,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#636E72',
    fontSize: 15,
    marginBottom: 16,
  },
  addObjectsBtn: {
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addObjectsBtnText: {
    color: '#74B9FF',
    fontSize: 14,
    fontWeight: '500',
  },
});
