import React, { useMemo, useState } from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { radii, spacing, touch, typography } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

interface TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  onBlur?: () => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      width: '100%',
    },
    label: {
      ...typography.bodySmall,
      color: c.textSecondary,
      marginBottom: spacing.xs,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    input: {
      flex: 1,
      minHeight: touch.minTarget,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      fontSize: typography.body.fontSize,
      color: c.text,
    },
    inputWithLeftIcon: {
      paddingLeft: spacing.xs,
    },
    inputWithRightIcon: {
      paddingRight: spacing.xs,
    },
    iconLeft: {
      paddingLeft: spacing.md,
    },
    iconRight: {
      paddingRight: spacing.md,
    },
    multiline: {
      minHeight: 100,
      textAlignVertical: 'top',
      paddingTop: spacing.sm,
    },
    disabled: {
      opacity: 0.6,
    },
    error: {
      ...typography.caption,
      color: c.error,
      marginTop: spacing.xs,
    },
    helper: {
      ...typography.caption,
      color: c.textTertiary,
      marginTop: spacing.xs,
    },
  });
}

export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  multiline = false,
  secureTextEntry = false,
  keyboardType,
  maxLength,
  autoCapitalize,
  editable = true,
  onBlur,
  leftIcon,
  rightIcon,
}: TextInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.borderFocused
    : colors.border;

  const borderWidth = focused && !error ? 2 : 1;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          { borderColor, borderWidth },
          !editable && styles.disabled,
        ]}
      >
        {leftIcon != null && (
          <View style={styles.iconLeft}>{leftIcon}</View>
        )}
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          accessibilityLabel={label}
          style={[
            styles.input,
            leftIcon != null && styles.inputWithLeftIcon,
            rightIcon != null && styles.inputWithRightIcon,
            multiline && styles.multiline,
          ]}
        />
        {rightIcon != null && (
          <View style={styles.iconRight}>{rightIcon}</View>
        )}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}
