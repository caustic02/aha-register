import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { Button } from './ui';
import { colors, radii, spacing, touch, typography } from '../theme';
import type { ObjectType } from '../db/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SortOption = 'newest' | 'oldest' | 'az' | 'za';

export interface FilterState {
  objectTypes: ObjectType[];
  sortBy: SortOption;
}

interface FilterSheetProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  availableTypes: ObjectType[];
  initialFilters: FilterState;
  onApply: (filters: FilterState) => void;
}

// ── Object type keys that match i18n ──────────────────────────────────────────

const ALL_OBJECT_TYPES: ObjectType[] = [
  'museum_object',
  'site',
  'incident',
  'specimen',
  'architectural_element',
  'environmental_sample',
  'conservation_record',
];

// ── Component ─────────────────────────────────────────────────────────────────

export function FilterSheet({
  sheetRef,
  availableTypes,
  initialFilters,
  onApply,
}: FilterSheetProps) {
  const { t } = useAppTranslation();
  const snapPoints = useMemo(() => ['40%', '80%'], []);

  const [selectedTypes, setSelectedTypes] = useState<ObjectType[]>(
    initialFilters.objectTypes,
  );
  const [sortBy, setSortBy] = useState<SortOption>(initialFilters.sortBy);

  // Reset local state when sheet opens with new initial filters
  const handleSheetChange = useCallback(
    (index: number) => {
      if (index >= 0) {
        setSelectedTypes(initialFilters.objectTypes);
        setSortBy(initialFilters.sortBy);
      }
    },
    [initialFilters],
  );

  const toggleType = useCallback((type: ObjectType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedTypes([]);
    setSortBy('newest');
  }, []);

  const handleApply = useCallback(() => {
    onApply({ objectTypes: selectedTypes, sortBy });
    sheetRef.current?.close();
  }, [onApply, selectedTypes, sortBy, sheetRef]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
      />
    ),
    [],
  );

  // Determine which types to show — available ones first, then all
  const typeList =
    availableTypes.length > 0 ? ALL_OBJECT_TYPES : ALL_OBJECT_TYPES;

  const sortOptions: { value: SortOption; labelKey: string }[] = [
    { value: 'newest', labelKey: 'collection.newest' },
    { value: 'oldest', labelKey: 'collection.oldest' },
    { value: 'az', labelKey: 'collection.az' },
    { value: 'za', labelKey: 'collection.za' },
  ];

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{t('collection.filterTitle')}</Text>

        {/* Object Type section */}
        <Text style={styles.sectionLabel}>{t('collection.objectType')}</Text>
        <View style={styles.chipRow}>
          {typeList.map((type) => {
            const active = selectedTypes.includes(type);
            return (
              <Pressable
                key={type}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleType(type)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(`object_types.${type}`)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`object_types.${type}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Sort By section */}
        <Text style={styles.sectionLabel}>{t('collection.sortBy')}</Text>
        <View style={styles.chipRow}>
          {sortOptions.map((opt) => {
            const active = sortBy === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSortBy(opt.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(opt.labelKey)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(opt.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label={t('collection.apply')}
            variant="primary"
            size="lg"
            onPress={handleApply}
            fullWidth
          />
          <Pressable
            onPress={handleClearAll}
            style={styles.clearAll}
            accessibilityRole="button"
            accessibilityLabel={t('collection.clearAll')}
          >
            <Text style={styles.clearAllText}>{t('collection.clearAll')}</Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: colors.surface,
  },
  handle: {
    backgroundColor: colors.border,
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.secondaryContainer,
    minHeight: touch.minTargetSmall,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primaryContainer,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.secondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  actions: {
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  clearAll: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: touch.minTarget,
    justifyContent: 'center',
  },
  clearAllText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
