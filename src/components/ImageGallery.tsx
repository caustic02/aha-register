import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useAppTranslation } from '../hooks/useAppTranslation';
import type { Media } from '../db/types';
import { colors, typography, radii } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_HEIGHT = 280;

interface Props {
  media: Media[];
  onAddPhoto: () => void;
  onSetPrimary: (mediaId: string) => void;
  onDelete: (mediaId: string) => void;
}

export function ImageGallery({ media, onAddPhoto, onSetPrimary, onDelete }: Props) {
  const { t } = useAppTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Media>>(null);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setCurrentIndex(idx);
    },
    [],
  );

  const handleLongPress = useCallback(
    (item: Media) => {
      const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [];

      if (item.is_primary !== 1) {
        buttons.push({
          text: t('media.set_primary'),
          onPress: () => onSetPrimary(item.id),
        });
      }

      buttons.push({
        text: t('media.delete'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            t('media.delete'),
            t('media.delete_confirm'),
            [
              { text: t('media.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => onDelete(item.id),
              },
            ],
          );
        },
      });

      buttons.push({ text: t('media.cancel'), style: 'cancel' });

      Alert.alert(undefined as unknown as string, undefined as unknown as string, buttons);
    },
    [t, onSetPrimary, onDelete],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Media>) => (
      <Pressable
        style={styles.imageContainer}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
      >
        <Image source={{ uri: item.file_path }} style={styles.image} />
        {item.is_primary === 1 && media.length > 1 && (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>{'\u2605'}</Text>
          </View>
        )}
      </Pressable>
    ),
    [handleLongPress, media.length],
  );

  // Empty state
  if (media.length === 0) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.placeholder} onPress={onAddPhoto}>
          <Text style={styles.placeholderIcon}>{'\u25A3'}</Text>
          <Text style={styles.addText}>+ {t('media.add_photo')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={media}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Counter badge */}
      {media.length > 1 && (
        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>
            {t('media.counter', { current: currentIndex + 1, total: media.length })}
          </Text>
        </View>
      )}

      {/* Add photo button */}
      <Pressable style={styles.addButton} onPress={onAddPhoto}>
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>

      {/* Dot indicators */}
      {media.length > 1 && (
        <View style={styles.dots}>
          {media.map((m, i) => (
            <View
              key={m.id}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  image: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: colors.overlayLight,
  },
  placeholder: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    color: colors.border,
  },
  addText: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    marginTop: 12,
  },
  primaryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.overlayDark,
    width: 28,
    height: 28,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBadgeText: {
    color: colors.warning,
    fontSize: typography.size.base,
  },
  counterBadge: {
    position: 'absolute',
    bottom: 32,
    right: 12,
    backgroundColor: colors.overlayDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.lg,
  },
  counterText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  addButton: {
    position: 'absolute',
    bottom: 32,
    left: 12,
    backgroundColor: colors.accent,
    width: 36,
    height: 36,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 8,
    height: 8,
    borderRadius: radii.sm,
  },
});
