import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface SelectionHeaderProps {
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onCancel: () => void;
  t: (key: string, opts?: any) => string;
}

export function SelectionHeader({
  selectedCount,
  allSelected,
  onToggleAll,
  onCancel,
  t,
}: SelectionHeaderProps) {
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

const hStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#0A0A14',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(116,185,255,0.2)',
  },
  cancelText: {
    color: '#636E72',
    fontSize: 15,
    fontWeight: '500',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  selectAllText: {
    color: '#74B9FF',
    fontSize: 15,
    fontWeight: '500',
  },
});

interface ActionBarProps {
  onAddToCollection: () => void;
  onExportPDF: () => void;
  onDelete: () => void;
  disabled?: boolean;
  exporting?: boolean;
  t: (key: string, opts?: any) => string;
}

export function BatchActionButtons({
  onAddToCollection,
  onExportPDF,
  onDelete,
  disabled,
  exporting,
  t,
}: ActionBarProps) {
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
          <ActivityIndicator size="small" color="#74B9FF" />
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

const aStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 36,
    backgroundColor: '#0A0A14',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(116,185,255,0.2)',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(116,185,255,0.1)',
    gap: 4,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  actionIcon: {
    color: '#74B9FF',
    fontSize: 18,
  },
  actionText: {
    color: '#74B9FF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.1)',
    gap: 4,
  },
  deleteIcon: {
    color: '#FF6B6B',
    fontSize: 18,
  },
  deleteText: {
    color: '#FF6B6B',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
