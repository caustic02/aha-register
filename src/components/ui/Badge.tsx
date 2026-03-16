import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

type Variant = 'info' | 'success' | 'warning' | 'error' | 'ai' | 'neutral';
type Size = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: Variant;
  size?: Size;
}

const VARIANT_COLORS: Record<Variant, { bg: string; text: string }> = {
  info: { bg: colors.infoLight, text: colors.info },
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
  error: { bg: colors.errorLight, text: colors.error },
  ai: { bg: colors.aiLight, text: colors.ai },
  neutral: { bg: colors.surface, text: colors.textSecondary },
};

export function Badge({ label, variant = 'neutral', size = 'md' }: BadgeProps) {
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
    fontSize: 12,
  },
});
