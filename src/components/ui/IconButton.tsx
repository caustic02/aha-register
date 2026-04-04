import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { radii, touch } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

type Variant = 'default' | 'filled' | 'tinted';

interface IconButtonProps {
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: Variant;
  disabled?: boolean;
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    base: {
      width: touch.minTarget,
      height: touch.minTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },
    default: {
      backgroundColor: c.transparent,
    },
    filled: {
      backgroundColor: c.primary,
      borderRadius: radii.full,
    },
    tinted: {
      backgroundColor: c.primaryLight,
      borderRadius: radii.full,
    },
    disabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'default',
  disabled = false,
}: IconButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon}
    </Pressable>
  );
}
