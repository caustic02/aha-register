import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

interface DividerProps {
  inset?: number;
}

export function Divider({ inset }: DividerProps) {
  return (
    <View
      style={[styles.base, inset ? { marginLeft: inset } : undefined]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
