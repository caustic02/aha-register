import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldInput } from '../FieldInput';
import type { TypeFormProps } from './index';
import type { ConservationRecordData } from '../../db/types';

const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'critical'] as const;

export default function ConservationRecordForm({ data, onChange, t }: TypeFormProps) {
  const d = data as ConservationRecordData;

  const [treatmentType, setTreatmentType] = useState(d.treatment_type ?? '');
  const [conservator, setConservator] = useState(d.conservator ?? '');
  const [dateStarted, setDateStarted] = useState(d.date_started ?? '');
  const [dateCompleted, setDateCompleted] = useState(d.date_completed ?? '');
  const [materialsUsed, setMaterialsUsed] = useState(
    (d.materials_used ?? []).join(', '),
  );
  const [beforeCondition, setBeforeCondition] = useState(d.before_condition ?? '');
  const [afterCondition, setAfterCondition] = useState(d.after_condition ?? '');
  const [recommendations, setRecommendations] = useState(d.recommendations ?? '');
  const [nextReviewDate, setNextReviewDate] = useState(d.next_review_date ?? '');

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
      <FieldInput
        label={t('type_forms.conservation_record.date_started')}
        value={dateStarted}
        onChangeText={setDateStarted}
        onBlur={() => save({ date_started: dateStarted || undefined })}
        placeholder={t('objects.event_date_placeholder')}
      />
      <FieldInput
        label={t('type_forms.conservation_record.date_completed')}
        value={dateCompleted}
        onChangeText={setDateCompleted}
        onBlur={() => save({ date_completed: dateCompleted || undefined })}
        placeholder={t('objects.event_date_placeholder')}
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
      <FieldInput
        label={t('type_forms.conservation_record.next_review_date')}
        value={nextReviewDate}
        onChangeText={setNextReviewDate}
        onBlur={() => save({ next_review_date: nextReviewDate || undefined })}
        placeholder={t('objects.event_date_placeholder')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.15)',
  },
  chipActive: { backgroundColor: '#0984E3', borderColor: '#0984E3' },
  chipText: { color: '#636E72', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
});
