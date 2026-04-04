import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDatabase } from '../contexts/DatabaseContext';
import {
  getAllCollections,
  type CollectionWithCount,
} from '../services/collectionService';
import { typography, radii } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface CollectionPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (collection: { id: string; name: string }) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export function CollectionPickerModal({
  visible,
  onClose,
  onSelect,
  t,
}: CollectionPickerModalProps) {
  const db = useDatabase();
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (visible) {
      getAllCollections(db).then(setCollections);
    }
  }, [visible, db]);

  const renderItem = useCallback(
    ({ item }: { item: CollectionWithCount }) => (
      <Pressable
        style={styles.row}
        onPress={() => onSelect({ id: item.id, name: item.name })}
      >
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.count}>
          {item.objectCount === 0
            ? t('collections.object_count_zero')
            : item.objectCount === 1
              ? t('collections.object_count_one')
              : t('collections.object_count', { count: item.objectCount })}
        </Text>
      </Pressable>
    ),
    [onSelect, t, styles],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('batch.pick_collection')}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.closeBtn}>{'\u2715'}</Text>
            </Pressable>
          </View>
          {collections.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {t('batch.no_collections')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={collections}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      maxHeight: '60%',
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderLight,
    },
    title: {
      color: c.textPrimary,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.semibold,
    },
    closeBtn: {
      color: c.textSecondary,
      fontSize: typography.size.lg,
    },
    row: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderLight,
    },
    name: {
      color: c.textPrimary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.medium,
    },
    count: {
      color: c.textSecondary,
      fontSize: typography.size.sm,
      marginTop: 2,
    },
    empty: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: c.textSecondary,
      fontSize: typography.size.md,
    },
  });
}
