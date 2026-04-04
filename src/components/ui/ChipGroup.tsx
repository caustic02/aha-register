import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, touch, typography } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

interface ChipOption {
  label: string;
  value: string;
}

interface ChipGroupProps {
  options: ChipOption[];
  selected: string | string[];
  onSelect: (value: string | string[]) => void;
  multiSelect?: boolean;
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      minHeight: 40,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chipSelected: {
      backgroundColor: c.primaryLight,
      borderColor: c.primary,
    },
    chipUnselected: {
      backgroundColor: c.surface,
      borderColor: c.border,
    },
    chipPressed: {
      opacity: 0.75,
    },
    chipText: {
      ...typography.bodySmall,
    },
    chipTextSelected: {
      color: c.primary,
      fontWeight: '600',
    },
    chipTextUnselected: {
      color: c.text,
    },
  });
}

export function ChipGroup({
  options,
  selected,
  onSelect,
  multiSelect = false,
}: ChipGroupProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const selectedValues = Array.isArray(selected) ? selected : [selected];

  function handlePress(value: string) {
    if (multiSelect) {
      const current = Array.isArray(selected) ? selected : [selected];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onSelect(next);
    } else {
      onSelect(value);
    }
  }

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => handlePress(option.value)}
            hitSlop={touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => [
              styles.chip,
              isSelected ? styles.chipSelected : styles.chipUnselected,
              pressed && styles.chipPressed,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
