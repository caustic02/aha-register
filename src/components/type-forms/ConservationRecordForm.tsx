import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldInput } from '../FieldInput';
import { DateField } from '../DateField';
import type { TypeFormProps } from './index';
import type { ConservationRecordData } from '../../db/types';
import { colors, typography, radii } from '../../theme';

const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'critical'] as const;

export default function ConservationRecordForm({ data, onChange, t }: TypeFormProps) {
  const d = data as ConservationRecordData;

  const [treatmentType, setTreatmentType] = useState(d.treatment_type ?? '');
  const [conservator, setConservator] = useState(d.conservator ?? '');
  const [materialsUsed, setMaterialsUsed] = useState(
    (d.materials_used ?? []).join(', '),
  );
  const [beforeCondition, setBeforeCondition] = useState(d.before_condition ?? '');
  const [afterCondition, setAfterCondition] = useState(d.after_condition ?? '');
  const [recommendations, setRecommendations] = useState(d.recommendations ?? '');

  const save = useCallback(
    (patch: Partial<ConservationRecordData>) => {
      onChange({ ...d, ...patch });
    },
    [d, onChange],
  );

  const splitCsv = (v: string) =>
    v.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <View>
      <FieldInput
        label={t('type_forms.conservation_record.treatment_type')}
        value={treatmentType}
        onChangeText={setTreatmentType}
        onBlur={() => save({ treatment_type: treatmentType || undefined })}
      />
      <FieldInput
        label={t('type_forms.conservation_record.conservator')}
        value={conservator}
        onChangeText={setConservator}
        onBlur={() => save({ conservator: conservator || undefined })}
      />
      <DateField
        label={t('type_forms.conservation_record.date_started')}
        value={d.date_started}
        onChange={(iso) => save({ date_started: iso })}
        t={t}
      />
      <DateField
        label={t('type_forms.conservation_record.date_completed')}
        value={d.date_completed}
        onChange={(iso) => save({ date_completed: iso })}
        t={t}
      />
      <FieldInput
        label={t('type_forms.conservation_record.materials_used')}
        value={materialsUsed}
        onChangeText={setMaterialsUsed}
        onBlur={() => save({ materials_used: splitCsv(materialsUsed) })}
        placeholder={t('type_forms.comma_separated')}
      />

      <Text style={styles.fieldLabel}>
        {t('type_forms.conservation_record.before_condition')}
      </Text>
      <View style={styles.chipRow}>
        {CONDITIONS.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, beforeCondition === c && styles.chipActive]}
            onPress={() => {
              const val = c === beforeCondition ? '' : c;
              setBeforeCondition(val);
              save({ before_condition: val || undefined });
            }}
          >
            <Text
              style={[
                styles.chipText,
                beforeCondition === c && styles.chipTextActive,
              ]}
            >
              {t(`type_forms.condition.${c}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>
        {t('type_forms.conservation_record.after_condition')}
      </Text>
      <View style={styles.chipRow}>
        {CONDITIONS.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, afterCondition === c && styles.chipActive]}
            onPress={() => {
              const val = c === afterCondition ? '' : c;
              setAfterCondition(val);
              save({ after_condition: val || undefined });
            }}
          >
            <Text
              style={[
                styles.chipText,
                afterCondition === c && styles.chipTextActive,
              ]}
            >
              {t(`type_forms.condition.${c}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FieldInput
        label={t('type_forms.conservation_record.recommendations')}
        value={recommendations}
        onChangeText={setRecommendations}
        onBlur={() => save({ recommendations: recommendations || undefined })}
        multiline
      />
      <DateField
        label={t('type_forms.conservation_record.next_review_date')}
        value={d.next_review_date}
        onChange={(iso) => save({ next_review_date: iso })}
        t={t}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: colors.textSecondary,
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
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.chipActive, borderColor: colors.chipActive },
  chipText: { color: colors.textSecondary, fontSize: typography.size.sm },
  chipTextActive: { color: colors.white, fontWeight: typography.weight.semibold },
});
