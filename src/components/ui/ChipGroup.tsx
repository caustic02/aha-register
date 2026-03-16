import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touch, typography } from '../../theme';

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

export function ChipGroup({
  options,
  selected,
  onSelect,
  multiSelect = false,
}: ChipGroupProps) {
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipUnselected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipText: {
    ...typography.bodySmall,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  chipTextUnselected: {
    color: colors.text,
  },
});
