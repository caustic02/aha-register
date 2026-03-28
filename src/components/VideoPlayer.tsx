/**
 * Full-screen video player with save and share.
 *
 * Trim is deferred until native module linking is fixed post-Berlin.
 * The trim button is shown as disabled with "coming soon" label.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Download, Share2, Scissors, X } from 'lucide-react-native';
import { colors, spacing, radii, touch } from '../theme';
import { useAppTranslation } from '../hooks/useAppTranslation';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoPlayerProps {
  visible: boolean;
  videoUri: string;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VideoPlayer({
  visible,
  videoUri,
  onClose,
}: VideoPlayerProps) {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = false;
    p.play();
  });

  // Duration from player (seconds) — shown in future trim UI
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && player.duration > 0) {
        setDuration(player.duration);
      }
    });
    if (player.status === 'readyToPlay' && player.duration > 0) {
      setDuration(player.duration);
    }
    return () => sub.remove();
  }, [player]);

  // ── Save / Share ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!videoUri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('imageViewer.permissionNeeded'));
        return;
      }
      await MediaLibrary.saveToLibraryAsync(videoUri);
      Alert.alert(t('imageViewer.savedToGallery'));
    } catch {
      Alert.alert(t('common.error'));
    }
  }, [videoUri, t]);

  const handleShare = useCallback(async () => {
    if (!videoUri) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(t('common.error'));
        return;
      }
      await Sharing.shareAsync(videoUri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
    } catch {
      // User cancelled — no-op
    }
  }, [videoUri, t]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop}>
          {/* Video */}
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls
          />

          {/* Close button */}
          <Pressable
            style={[styles.closeBtn, { top: insets.top + spacing.md }]}
            onPress={onClose}
            hitSlop={touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <X size={24} color={colors.white} />
          </Pressable>

          {/* Bottom action bar */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <Pressable style={styles.actionBtn} onPress={handleSave} accessibilityRole="button">
              <Download size={20} color={colors.white} />
              <Text style={styles.actionText}>{t('imageViewer.saveToDevice')}</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={handleShare} accessibilityRole="button">
              <Share2 size={20} color={colors.white} />
              <Text style={styles.actionText}>{t('imageViewer.share')}</Text>
            </Pressable>
            <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
              <Scissors size={20} color={colors.white} />
              <Text style={styles.actionText}>{t('videoPlayer.trimComingSoon')}</Text>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.black },
  video: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing['3xl'],
    paddingTop: spacing.lg,
    backgroundColor: colors.overlay,
  },
  actionBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.white,
  },
});
