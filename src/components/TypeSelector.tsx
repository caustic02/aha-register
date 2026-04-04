import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

interface TypeSelectorProps {
  defaultType: ObjectType | null;
  onSelect: (type: ObjectType) => void;
  onSkip: () => void;
  t: (key: string) => string;
}

export function TypeSelector({ defaultType, onSelect, onSkip, t }: TypeSelectorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
              accessibilityRole="button"
              accessibilityLabel={t(`object_types.${type}`)}
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

      <Pressable style={styles.skipBtn} onPress={onSkip} accessibilityRole="button" accessibilityLabel={t('capture.skip_use_default')}>
        <Text style={styles.skipBtnText}>{t('capture.skip_use_default')}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    title: {
      color: c.textPrimary,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.bold,
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: typography.size.base,
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
      backgroundColor: c.borderLight,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.lg,
      padding: 18,
    },
    cardHighlighted: {
      borderColor: c.heroGreen,
      backgroundColor: c.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    cardLabel: {
      color: c.textPrimary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    defaultBadge: {
      backgroundColor: c.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    defaultBadgeText: {
      color: c.heroGreen,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    cardDesc: {
      color: c.textSecondary,
      fontSize: typography.size.sm,
      marginTop: 6,
      lineHeight: 18,
    },
    skipBtn: {
      borderWidth: 1,
      borderColor: c.heroGreen,
      marginHorizontal: 20,
      marginBottom: 40,
      borderRadius: radii.lg,
      padding: 16,
      alignItems: 'center',
    },
    skipBtnText: {
      color: c.heroGreen,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
  });
}
