/**
 * Compact sync status bar at the top of the app.
 * Shown only while SyncEngine is actively running (network push/pull).
 * Uses position:absolute so it doesn't push content down.
 */
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { colors, spacing, typography } from '../theme';

const BAR_HEIGHT = 28;

export function SyncStatusBar() {
  const { status, pendingCount } = useSyncStatus();
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();

  const [translateY] = useState(() => new Animated.Value(-BAR_HEIGHT));
  const visible = status === 'syncing';

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -BAR_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  if (!visible) return null;

  const text = t('syncBar.syncing', { count: pendingCount });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: colors.warningLight,
          top: insets.top,
          transform: [{ translateY }],
        },
      ]}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
    >
      <Text style={[styles.text, { color: colors.warning }]} numberOfLines={1}>
        {text}
      </Text>
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
});
