import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, touch, typography } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
      marginTop: spacing.xl,
    },
    title: {
      ...typography.label,
      color: c.textSecondary,
    },
    actionWrapper: {
      minHeight: touch.minTarget,
      justifyContent: 'center',
    },
    action: {
      ...typography.bodySmall,
      color: c.accent,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
