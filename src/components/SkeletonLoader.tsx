/**
 * SkeletonLoader — pulse-opacity placeholder for local data loading.
 *
 * Rules:
 * - All colors/spacing/radii from src/theme/index.ts
 * - Animated API only (no Reanimated / no gradient shimmer)
 * - useNativeDriver: true — opacity runs on the UI thread
 */

import React, { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { radii, spacing } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

// ── Base primitive ─────────────────────────────────────────────────────────────

interface SkeletonLoaderProps {
  // Use number for pixel widths or template literal for percentages, e.g. "65%"
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
}

export function SkeletonLoader({
  width,
  height,
  borderRadius = radii.sm,
}: SkeletonLoaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // useMemo avoids the react-hooks/refs lint rule that forbids .current access during render
  const opacity = useMemo(() => new Animated.Value(0.3), []);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius },
        { opacity },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

// ── Card skeleton (list item: thumbnail + 2 text lines) ───────────────────────

export function SkeletonCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <SkeletonLoader width={48} height={48} borderRadius={radii.sm} />
      <View style={styles.cardLines}>
        <SkeletonLoader width="65%" height={14} />
        <SkeletonLoader width="40%" height={12} />
      </View>
    </View>
  );
}

// ── List skeleton (stacked SkeletonCards) ─────────────────────────────────────

interface SkeletonListProps {
  count?: number;
}

export function SkeletonList({ count = 4 }: SkeletonListProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    base: {
      backgroundColor: c.surfaceContainer,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    cardLines: {
      flex: 1,
      gap: spacing.sm,
    },
  });
}
