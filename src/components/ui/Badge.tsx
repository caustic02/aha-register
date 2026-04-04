import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

type Variant = 'info' | 'success' | 'warning' | 'error' | 'ai' | 'neutral';
type Size = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: Variant;
  size?: Size;
}

function getVariantColors(colors: ColorPalette): Record<Variant, { bg: string; text: string }> {
  return {
    info: { bg: colors.infoLight, text: colors.info },
    success: { bg: colors.successLight, text: colors.success },
    warning: { bg: colors.warningLight, text: colors.warning },
    error: { bg: colors.errorLight, text: colors.error },
    ai: { bg: colors.aiLight, text: colors.ai },
    neutral: { bg: colors.surface, text: colors.textSecondary },
  };
}

export function Badge({ label, variant = 'neutral', size = 'md' }: BadgeProps) {
  const { colors } = useTheme();
  const VARIANT_COLORS = useMemo(() => getVariantColors(colors), [colors]);
  const { bg, text } = VARIANT_COLORS[variant];

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: bg },
      ]}
    >
      <Text
        style={[
          size === 'sm' ? typography.caption : styles.mdText,
          { color: text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sm: {
    height: 20,
    paddingHorizontal: spacing.sm,
  },
  md: {
    height: 24,
    paddingHorizontal: spacing.md,
  },
  // md uses bodySmall metrics but overrides fontSize to 12
  mdText: {
    ...typography.bodySmall,
    fontSize: typography.caption.fontSize,
  },
});
