import React, { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { typography, radii } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface FieldInputProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  onBlur?: () => void;
  multiline?: boolean;
  readonly?: boolean;
  placeholder?: string;
}

export function FieldInput({
  label,
  value,
  onChangeText,
  onBlur,
  multiline = false,
  readonly = false,
  placeholder,
}: FieldInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {readonly ? (
        <Text style={styles.readonlyValue}>{value || '—'}</Text>
      ) : (
        <TextInput
          style={[styles.input, multiline && styles.multiline]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      )}
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    label: {
      color: c.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    input: {
      backgroundColor: c.borderLight,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.md,
      color: c.textPrimary,
      fontSize: typography.size.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    multiline: {
      minHeight: 80,
      paddingTop: 12,
    },
    readonlyValue: {
      color: c.textPrimary,
      fontSize: typography.size.md,
    },
  });
}
