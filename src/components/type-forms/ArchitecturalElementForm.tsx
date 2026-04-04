import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { FieldInput } from '../FieldInput';
import { DateField } from '../DateField';
import type { TypeFormProps } from './index';
import type { ArchitecturalElementData } from '../../db/types';
import { typography, radii } from '../../theme';
import type { ColorPalette } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';

const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'critical'] as const;

export default function ArchitecturalElementForm({ data, onChange, t }: TypeFormProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const d = data as ArchitecturalElementData;

  const [elementType, setElementType] = useState(d.element_type ?? '');
  const [style, setStyle] = useState(d.style ?? '');
  const [constructionMaterial, setConstructionMaterial] = useState(
    (d.construction_material ?? []).join(', '),
  );
  const [structuralCondition, setStructuralCondition] = useState(d.structural_condition ?? '');
  const [loadBearing, setLoadBearing] = useState(d.load_bearing ?? false);
  const [restorationHistory, setRestorationHistory] = useState(
    (d.restoration_history ?? []).join(', '),
  );

  const save = useCallback(
    (patch: Partial<ArchitecturalElementData>) => {
      onChange({ ...d, ...patch });
    },
    [d, onChange],
  );

  const splitCsv = (v: string) =>
    v.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <View>
      <FieldInput
        label={t('type_forms.architectural_element.element_type')}
        value={elementType}
        onChangeText={setElementType}
        onBlur={() => save({ element_type: elementType || undefined })}
      />
      <FieldInput
        label={t('type_forms.architectural_element.style')}
        value={style}
        onChangeText={setStyle}
        onBlur={() => save({ style: style || undefined })}
      />
      <FieldInput
        label={t('type_forms.architectural_element.construction_material')}
        value={constructionMaterial}
        onChangeText={setConstructionMaterial}
        onBlur={() => save({ construction_material: splitCsv(constructionMaterial) })}
        placeholder={t('type_forms.comma_separated')}
      />
      <DateField
        label={t('type_forms.architectural_element.construction_date')}
        value={d.construction_date}
        onChange={(iso) => save({ construction_date: iso })}
        t={t}
      />

      <Text style={styles.fieldLabel}>
        {t('type_forms.architectural_element.structural_condition')}
      </Text>
      <View style={styles.chipRow}>
        {CONDITIONS.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, structuralCondition === c && styles.chipActive]}
            onPress={() => {
              const val = c === structuralCondition ? '' : c;
              setStructuralCondition(val);
              save({ structural_condition: val || undefined });
            }}
          >
            <Text
              style={[
                styles.chipText,
                structuralCondition === c && styles.chipTextActive,
              ]}
            >
              {t(`type_forms.condition.${c}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>
          {t('type_forms.architectural_element.load_bearing')}
        </Text>
        <Switch
          value={loadBearing}
          onValueChange={(val) => {
            setLoadBearing(val);
            save({ load_bearing: val });
          }}
          trackColor={{ false: colors.border, true: colors.heroGreen }}
          thumbColor={colors.white}
        />
      </View>

      <FieldInput
        label={t('type_forms.architectural_element.restoration_history')}
        value={restorationHistory}
        onChangeText={setRestorationHistory}
        onBlur={() => save({ restoration_history: splitCsv(restorationHistory) })}
        placeholder={t('type_forms.comma_separated')}
      />
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    fieldLabel: {
      color: c.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
      textTransform: 'uppercase',
      marginBottom: 8,
      marginTop: 4,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.chipActive, borderColor: c.chipActive },
    chipText: { color: c.textSecondary, fontSize: typography.size.sm },
    chipTextActive: { color: c.white, fontWeight: typography.weight.semibold },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 16,
    },
  });
}
