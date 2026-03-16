import React, { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radii, touch } from '../../theme';

type Variant = 'default' | 'filled' | 'tinted';

interface IconButtonProps {
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: Variant;
  disabled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'default',
  disabled = false,
}: IconButtonProps) {
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

const styles = StyleSheet.create({
  base: {
    width: touch.minTarget,
    height: touch.minTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  default: {
    backgroundColor: colors.transparent,
  },
  filled: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
  },
  tinted: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.full,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
