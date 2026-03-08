import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

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
          placeholderTextColor="#4A4A5A"
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
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.1)',
    borderRadius: 10,
    color: '#DFE6E9',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 80,
    paddingTop: 12,
  },
  readonlyValue: {
    color: '#DFE6E9',
    fontSize: 15,
  },
});
