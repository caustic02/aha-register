import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

interface TypeSelectorProps {
  defaultType: ObjectType | null;
  onSelect: (type: ObjectType) => void;
  onSkip: () => void;
  t: (key: string) => string;
}

export function TypeSelector({ defaultType, onSelect, onSkip, t }: TypeSelectorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('capture.select_type')}</Text>
        <Text style={styles.subtitle}>{t('capture.select_type_subtitle')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {OBJECT_TYPES.map((type) => {
          const isDefault = type === defaultType;
          return (
            <Pressable
              key={type}
              style={[styles.card, isDefault && styles.cardHighlighted]}
              onPress={() => onSelect(type)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>
                  {t(`object_types.${type}`)}
                </Text>
                {isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>
                      {t('capture.default_badge')}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDesc}>
                {t(`capture.type_desc_${type}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipBtnText}>{t('capture.skip_use_default')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080F',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#636E72',
    fontSize: 14,
    marginTop: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  card: {
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.12)',
    borderRadius: 14,
    padding: 18,
  },
  cardHighlighted: {
    borderColor: '#74B9FF',
    backgroundColor: 'rgba(116,185,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  defaultBadge: {
    backgroundColor: 'rgba(116,185,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: {
    color: '#74B9FF',
    fontSize: 11,
    fontWeight: '600',
  },
  cardDesc: {
    color: '#636E72',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  skipBtn: {
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.3)',
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  skipBtnText: {
    color: '#74B9FF',
    fontSize: 16,
    fontWeight: '600',
  },
});
