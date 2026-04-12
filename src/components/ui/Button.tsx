import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ReactNode } from 'react';
import { radii, spacing, touch, typography } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  accessibilityHint?: string;
}

const HEIGHT: Record<Size, number> = { lg: 56, md: 48, sm: 40 };

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    base: {
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    fullWidth: {
      alignSelf: 'stretch',
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      marginRight: spacing.sm,
    },
    disabled: {
      opacity: 0.5,
    },
    // Variants
    primary: {
      backgroundColor: c.accent,
      borderWidth: 1,
      borderColor: c.accent,
    },
    primaryPressed: {
      backgroundColor: c.accentDark,
      opacity: 0.85,
    },
    secondary: {
      backgroundColor: c.transparent,
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    secondaryPressed: {
      opacity: 0.85,
    },
    ghost: {
      backgroundColor: c.transparent,
    },
    ghostPressed: {
      opacity: 0.85,
    },
  });
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const textColor =
    variant === 'primary' ? colors.accentText : colors.accent;
  const textStyle =
    size === 'sm' ? typography.bodySmall : typography.bodyMedium;

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      hitSlop={size === 'sm' ? touch.hitSlop : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        { height: HEIGHT[size] },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles[`${variant}Pressed` as keyof typeof styles],
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={textColor}
          />
        ) : (
          <>
            {icon && <View style={styles.icon}>{icon}</View>}
            <Text style={[textStyle, { color: textColor }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}
