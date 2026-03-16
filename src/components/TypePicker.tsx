import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAppTranslation } from '../hooks/useAppTranslation';
import type { ObjectType } from '../db/types';
import { colors, typography, radii } from '../theme';

const OBJECT_TYPES: ObjectType[] = [
  'museum_object',
  'site',
  'incident',
  'specimen',
  'architectural_element',
  'environmental_sample',
  'conservation_record',
];

interface TypePickerProps {
  selected: ObjectType;
  onChange: (type: ObjectType) => void;
}

export function TypePicker({ selected, onChange }: TypePickerProps) {
  const { t } = useAppTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {OBJECT_TYPES.map((type) => {
        const active = type === selected;
        return (
          <Pressable
            key={type}
            style={[styles.badge, active && styles.badgeActive]}
            onPress={() => onChange(type)}
          >
            <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
              {t(`object_types.${type}`)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  // eslint-disable-next-line react-native/no-color-literals
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  badgeActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  badgeTextActive: {
    color: colors.white,
    fontWeight: typography.weight.semibold,
  },
});
