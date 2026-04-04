import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAppTranslation } from '../hooks/useAppTranslation';
import type { ObjectType } from '../db/types';
import { typography, radii } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
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
      borderColor: c.border,
      backgroundColor: 'transparent',
    },
    badgeActive: {
      backgroundColor: c.heroGreen,
      borderColor: c.heroGreen,
    },
    badgeText: {
      color: c.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    badgeTextActive: {
      color: c.white,
      fontWeight: typography.weight.semibold,
    },
  });
}
