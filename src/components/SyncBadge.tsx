/**
 * Per-object sync status badge.
 *
 * size="sm"  — 8 dp colored dot, hidden when synced (no visual noise for default state)
 * size="md"  — icon + short text label, all states always visible
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ObjectSyncStatus } from '../hooks/useSyncStatuses';
import { CheckIcon, ErrorIcon, OfflineIcon, SyncIcon } from '../theme/icons';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { spacing, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface SyncBadgeProps {
  status: ObjectSyncStatus;
  size?: 'sm' | 'md';
}

const DOT_SIZE = 8;

function StatusIcon({
  status,
  color,
}: {
  status: ObjectSyncStatus;
  color: string;
}) {
  switch (status) {
    case 'pending':
      return <SyncIcon size={12} color={color} />;
    case 'failed':
      return <ErrorIcon size={12} color={color} />;
    case 'offline':
      return <OfflineIcon size={12} color={color} />;
    default:
      return <CheckIcon size={12} color={color} />;
  }
}

export function SyncBadge({ status, size = 'sm' }: SyncBadgeProps) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function statusColor(s: ObjectSyncStatus): string {
    switch (s) {
      case 'pending':
        return colors.statusSyncing;
      case 'failed':
        return colors.statusError;
      case 'offline':
        return colors.statusOffline;
      default:
        return colors.statusSuccess;
    }
  }

  if (size === 'sm') {
    // Don't render the dot for synced — avoid visual noise on fully-synced items
    if (status === 'synced') return null;
    const dotBg = statusColor(status);
    return (
      <View
        style={[styles.dot, { backgroundColor: dotBg }]}
        accessibilityLabel={t(`syncBadge.${status}`)}
      />
    );
  }

  const color = statusColor(status);
  return (
    <View
      style={styles.mdRow}
      accessibilityLabel={t(`syncBadge.${status}`)}
    >
      <StatusIcon status={status} color={color} />
      <Text style={[styles.mdLabel, { color }]}>
        {t(`syncBadge.${status}`)}
      </Text>
    </View>
  );
}

function makeStyles(_c: ColorPalette) {
  return StyleSheet.create({
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
    },
    mdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    mdLabel: {
      fontSize: typography.size.xs,
      fontWeight: typography.weight.medium,
    },
  });
}
