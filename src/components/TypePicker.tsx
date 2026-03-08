import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAppTranslation } from '../hooks/useAppTranslation';
import type { ObjectType } from '../db/types';

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
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.15)',
    backgroundColor: 'transparent',
  },
  badgeActive: {
    backgroundColor: '#0984E3',
    borderColor: '#0984E3',
  },
  badgeText: {
    color: '#636E72',
    fontSize: 13,
    fontWeight: '500',
  },
  badgeTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
