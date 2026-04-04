import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { radii, shadows, spacing } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

interface CardProps {
  variant?: 'flat' | 'elevated';
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    base: {
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    flat: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    elevated: {
      backgroundColor: c.surfaceElevated,
      ...shadows.sm,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}

export function Card({
  variant = 'flat',
  children,
  onPress,
  style,
}: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
