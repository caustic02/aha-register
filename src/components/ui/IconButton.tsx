import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, touch, typography } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

type Variant = 'default' | 'filled' | 'tinted';

interface IconButtonProps {
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: Variant;
  disabled?: boolean;
  /** Optional text label rendered below the icon */
  label?: string;
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
    withLabel: {
      width: touch.minTarget,
      height: undefined,
      minHeight: touch.minTarget,
      paddingVertical: 6,
    },
    labeledContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: typography.size.xs,
      color: c.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
  });
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'default',
  disabled = false,
  label,
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
        label && styles.withLabel,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {label ? (
        <View style={styles.labeledContent}>
          {icon}
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </View>
      ) : icon}
    </Pressable>
  );
}
