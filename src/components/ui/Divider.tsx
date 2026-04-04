import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

interface DividerProps {
  inset?: number;
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    base: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
  });
}

export function Divider({ inset }: DividerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View
      style={[styles.base, inset ? { marginLeft: inset } : undefined]}
    />
  );
}
