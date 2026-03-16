import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, touch, typography } from '../../theme';

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="header"
    >
      <Text style={styles.title}>{title}</Text>
      {action && onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={action}
          style={({ pressed }) => [styles.actionWrapper, pressed && styles.pressed]}
        >
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  title: {
    ...typography.label,
    color: colors.textSecondary,
  },
  actionWrapper: {
    minHeight: touch.minTarget,
    justifyContent: 'center',
  },
  action: {
    ...typography.bodySmall,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
