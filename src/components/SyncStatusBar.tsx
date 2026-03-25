/**
 * Compact sync status bar displayed globally at the top of the app.
 * Hidden when idle (everything synced). Slides in below status bar.
 * Uses position:absolute so it doesn't push content down.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { useDatabase } from '../contexts/DatabaseContext';
import { SyncEngine } from '../sync/engine';
import { colors, radii, spacing, typography } from '../theme';

const BAR_HEIGHT = 28;

export function SyncStatusBar() {
  const { status, pendingCount, failedCount } = useSyncStatus();
  const { t } = useAppTranslation();
  const db = useDatabase();
  const insets = useSafeAreaInsets();

  const [translateY] = useState(() => new Animated.Value(-BAR_HEIGHT));
  const visible = status === 'syncing' || status === 'offline' || status === 'error';

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -BAR_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  const handleRetry = useCallback(() => {
    const engine = new SyncEngine(db);
    engine.triggerSync();
  }, [db]);

  if (!visible) return null;

  let bgColor: string;
  let textColor: string;
  let text: string;
  let showRetry = false;

  switch (status) {
    case 'syncing':
      bgColor = colors.warningLight;
      textColor = colors.warning;
      text = t('syncBar.syncing', { count: pendingCount });
      break;
    case 'offline':
      bgColor = colors.statusOffline;
      textColor = colors.white;
      text = t('syncBar.offline');
      break;
    case 'error':
      bgColor = colors.statusError;
      textColor = colors.white;
      text = t('syncBar.failed', { count: failedCount });
      showRetry = true;
      break;
    default:
      return null;
  }

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: bgColor, top: insets.top, transform: [{ translateY }] }]}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
    >
      <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
        {text}
      </Text>
      {showRetry && (
        <Pressable
          onPress={handleRetry}
          accessibilityRole="button"
          accessibilityLabel={t('syncBar.retry')}
          style={[styles.retryBtn, { borderColor: textColor }]}
        >
          <Text style={[styles.retryText, { color: textColor }]}>{t('syncBar.retry')}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    zIndex: 100,
    elevation: 4,
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    flexShrink: 1,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    minHeight: 18,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
