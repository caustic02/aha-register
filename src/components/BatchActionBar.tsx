import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { typography, radii, spacing } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface SelectionHeaderProps {
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onCancel: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export function SelectionHeader({
  selectedCount,
  allSelected,
  onToggleAll,
  onCancel,
  t,
}: SelectionHeaderProps) {
  const { colors } = useTheme();
  const hStyles = useMemo(() => makeHeaderStyles(colors), [colors]);

  return (
    <View style={hStyles.container}>
      <Pressable onPress={onCancel} hitSlop={8}>
        <Text style={hStyles.cancelText}>{t('common.cancel')}</Text>
      </Pressable>
      <Text style={hStyles.countText}>
        {t('batch.selected_count', { count: selectedCount })}
      </Text>
      <Pressable onPress={onToggleAll} hitSlop={8}>
        <Text style={hStyles.selectAllText}>
          {allSelected ? t('batch.deselect_all') : t('batch.select_all')}
        </Text>
      </Pressable>
    </View>
  );
}

function makeHeaderStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.sm,
      paddingHorizontal: 20,
      paddingBottom: 12,
      backgroundColor: c.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    cancelText: {
      color: c.textSecondary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.medium,
    },
    countText: {
      color: c.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    selectAllText: {
      color: c.heroGreen,
      fontSize: typography.size.md,
      fontWeight: typography.weight.medium,
    },
  });
}

interface ActionBarProps {
  onAddToCollection: () => void;
  onExportPDF: () => void;
  onDelete: () => void;
  disabled?: boolean;
  exporting?: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export function BatchActionButtons({
  onAddToCollection,
  onExportPDF,
  onDelete,
  disabled,
  exporting,
  t,
}: ActionBarProps) {
  const { colors } = useTheme();
  const aStyles = useMemo(() => makeActionStyles(colors), [colors]);

  return (
    <View style={aStyles.container}>
      <Pressable
        style={[aStyles.actionBtn, disabled && aStyles.disabledBtn]}
        onPress={onAddToCollection}
        disabled={disabled}
      >
        <Text style={aStyles.actionIcon}>{'\u25C8'}</Text>
        <Text style={aStyles.actionText}>{t('batch.add_to_collection')}</Text>
      </Pressable>
      <Pressable
        style={[aStyles.actionBtn, (disabled || exporting) && aStyles.disabledBtn]}
        onPress={onExportPDF}
        disabled={disabled || exporting}
      >
        {exporting ? (
          <ActivityIndicator size="small" color={colors.heroGreen} />
        ) : (
          <Text style={aStyles.actionIcon}>{'\u2197'}</Text>
        )}
        <Text style={aStyles.actionText}>{t('batch.export_pdf')}</Text>
      </Pressable>
      <Pressable
        style={[aStyles.deleteBtn, disabled && aStyles.disabledBtn]}
        onPress={onDelete}
        disabled={disabled}
      >
        <Text style={aStyles.deleteIcon}>{'\u2715'}</Text>
        <Text style={aStyles.deleteText}>{t('batch.delete')}</Text>
      </Pressable>
    </View>
  );
}

function makeActionStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 12,
      paddingBottom: 36,
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      gap: 8,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: radii.md,
      backgroundColor: c.border,
      gap: 4,
    },
    disabledBtn: {
      opacity: 0.4,
    },
    actionIcon: {
      color: c.heroGreen,
      fontSize: typography.size.lg,
    },
    actionText: {
      color: c.heroGreen,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
      textAlign: 'center',
    },
    deleteBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: radii.md,
      backgroundColor: c.dangerLight,
      gap: 4,
    },
    deleteIcon: {
      color: c.danger,
      fontSize: typography.size.lg,
    },
    deleteText: {
      color: c.danger,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
      textAlign: 'center',
    },
  });
}
