import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, typography, radii } from '../theme';

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

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.textPrimary,
    fontSize: typography.size.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 80,
    paddingTop: 12,
  },
  readonlyValue: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
});
