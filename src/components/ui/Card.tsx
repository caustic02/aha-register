import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '../../theme';

interface CardProps {
  variant?: 'flat' | 'elevated';
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({
  variant = 'flat',
  children,
  onPress,
  style,
}: CardProps) {
  const cardStyle = [
    styles.base,
    variant === 'flat' ? styles.flat : styles.elevated,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          ...cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  flat: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
