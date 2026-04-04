/**
 * Full-screen image viewer with pinch-to-zoom, save, and share.
 *
 * Usage:
 *   const [viewerUri, setViewerUri] = useState<string | null>(null);
 *   <ImageViewer visible={!!viewerUri} imageUri={viewerUri ?? ''} onClose={() => setViewerUri(null)} />
 */
import React, { useCallback, useMemo } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { Image } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Download, Share2 } from 'lucide-react-native';
import { CloseIcon } from '../theme/icons';
import { spacing } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useAppTranslation } from '../hooks/useAppTranslation';

interface ImageViewerProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
}

export function ImageViewer({ visible, imageUri, onClose }: ImageViewerProps) {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const VIEWER_BG = colors.camera; // full-black for image viewing
  const CLOSE_BTN_BG = colors.overlay; // semi-transparent dark

  const handleSave = useCallback(async () => {
    if (!imageUri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('imageViewer.permissionNeeded'));
        return;
      }
      await MediaLibrary.saveToLibraryAsync(imageUri);
      Alert.alert(t('imageViewer.savedToGallery'));
    } catch {
      Alert.alert(t('common.error'));
    }
  }, [imageUri, t]);

  const handleShare = useCallback(async () => {
    if (!imageUri) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(t('common.error'));
        return;
      }
      await Sharing.shareAsync(imageUri);
    } catch {
      // User cancelled or share failed — no-op
    }
  }, [imageUri, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
      <View style={[styles.backdrop, { backgroundColor: VIEWER_BG }]}>
        <Zoomable
          minScale={1}
          maxScale={5}
          doubleTapScale={2}
          style={styles.zoomable}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Full-screen image"
          />
        </Zoomable>

        <Pressable
          style={[styles.closeBtn, { top: insets.top + 12, backgroundColor: CLOSE_BTN_BG }]}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <CloseIcon size={24} color={colors.white} />
        </Pressable>

        {/* Save / Share bottom bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            style={styles.actionBtn}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel={t('imageViewer.saveToDevice')}
          >
            <Download size={20} color={colors.white} />
            <Text style={styles.actionText}>{t('imageViewer.saveToDevice')}</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={t('imageViewer.share')}
          >
            <Share2 size={20} color={colors.white} />
            <Text style={styles.actionText}>{t('imageViewer.share')}</Text>
          </Pressable>
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    backdrop: {
      flex: 1,
    },
    zoomable: {
      flex: 1,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    closeBtn: {
      position: 'absolute',
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    // eslint-disable-next-line react-native/no-color-literals
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing['3xl'],
      paddingTop: spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    actionBtn: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    actionText: {
      fontSize: 12,
      fontWeight: '500',
      color: c.white,
    },
  });
}
