/**
 * Compact sync status bar displayed globally at the top of the app.
 * Hidden when idle (everything synced). Slides in/out with animation.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { useDatabase } from '../contexts/DatabaseContext';
import { SyncEngine } from '../sync/engine';
import { colors, radii, spacing, typography } from '../theme';

const BAR_HEIGHT = 30;

export function SyncStatusBar() {
  const { status, pendingCount, failedCount } = useSyncStatus();
  const { t } = useAppTranslation();
  const db = useDatabase();

  const [translateY] = useState(() => new Animated.Value(-BAR_HEIGHT));
  const visible = status !== 'idle';

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

  // Don't render at all to avoid invisible touch targets
  if (!visible) return null;

  let bgColor: string;
  let text: string;
  let showRetry = false;

  switch (status) {
    case 'syncing':
      bgColor = colors.statusSyncing;
      text = t('syncBar.syncing', { count: pendingCount });
      break;
    case 'offline':
      bgColor = colors.statusOffline;
      text = t('syncBar.offline');
      break;
    case 'error':
      bgColor = colors.statusError;
      text = t('syncBar.failed', { count: failedCount });
      showRetry = true;
      break;
    default:
      bgColor = colors.statusSuccess;
      text = '';
  }

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: bgColor, transform: [{ translateY }] }]}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
    >
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
      {showRetry && (
        <Pressable
          onPress={handleRetry}
          accessibilityRole="button"
          accessibilityLabel={t('syncBar.retry')}
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>{t('syncBar.retry')}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  text: {
    fontSize: typography.size.sm,
    color: colors.white,
    fontWeight: typography.weight.medium,
    flexShrink: 1,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.white,
    minHeight: 24,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: typography.size.xs,
    color: colors.white,
    fontWeight: typography.weight.semibold,
  },
});
