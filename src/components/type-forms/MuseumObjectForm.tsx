import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { FieldInput } from '../FieldInput';
import type { TypeFormProps } from './index';
import type { MuseumObjectData } from '../../db/types';

const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'critical'] as const;
const UNITS = ['cm', 'mm', 'in', 'm'] as const;

export default function MuseumObjectForm({ data, onChange, t }: TypeFormProps) {
  const d = data as MuseumObjectData;

  const [material, setMaterial] = useState((d.material ?? []).join(', '));
  const [technique, setTechnique] = useState((d.technique ?? []).join(', '));
  const [height, setHeight] = useState(d.dimensions?.height?.toString() ?? '');
  const [width, setWidth] = useState(d.dimensions?.width?.toString() ?? '');
  const [depth, setDepth] = useState(d.dimensions?.depth?.toString() ?? '');
  const [unit, setUnit] = useState(d.dimensions?.unit ?? 'cm');
  const [period, setPeriod] = useState(d.period ?? '');
  const [culture, setCulture] = useState(d.culture ?? '');
  const [provenance, setProvenance] = useState(d.provenance ?? '');
  const [condition, setCondition] = useState(d.condition ?? '');
  const [inscription, setInscription] = useState(d.inscription ?? '');

  const save = useCallback(
    (patch: Partial<MuseumObjectData>) => {
      onChange({ ...d, ...patch });
    },
    [d, onChange],
  );

  const splitCsv = (v: string) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const parseDim = () => ({
    height: height ? parseFloat(height) : undefined,
    width: width ? parseFloat(width) : undefined,
    depth: depth ? parseFloat(depth) : undefined,
    unit,
  });

  return (
    <View>
      <FieldInput
        label={t('type_forms.museum_object.material')}
        value={material}
        onChangeText={setMaterial}
        onBlur={() => save({ material: splitCsv(material) })}
        placeholder={t('type_forms.comma_separated')}
      />
      <FieldInput
        label={t('type_forms.museum_object.technique')}
        value={technique}
        onChangeText={setTechnique}
        onBlur={() => save({ technique: splitCsv(technique) })}
        placeholder={t('type_forms.comma_separated')}
      />

      {/* Dimensions */}
      <Text style={styles.fieldLabel}>
        {t('type_forms.museum_object.dimensions')}
      </Text>
      <View style={styles.dimRow}>
        <View style={styles.dimField}>
          <Text style={styles.dimLabel}>{t('type_forms.museum_object.height')}</Text>
          <TextInput
            style={styles.dimInput}
            value={height}
            onChangeText={setHeight}
            onBlur={() => save({ dimensions: parseDim() })}
            keyboardType="numeric"
            placeholderTextColor="#4A4A5A"
          />
        </View>
        <View style={styles.dimField}>
          <Text style={styles.dimLabel}>{t('type_forms.museum_object.width')}</Text>
          <TextInput
            style={styles.dimInput}
            value={width}
            onChangeText={setWidth}
            onBlur={() => save({ dimensions: parseDim() })}
            keyboardType="numeric"
            placeholderTextColor="#4A4A5A"
          />
        </View>
        <View style={styles.dimField}>
          <Text style={styles.dimLabel}>{t('type_forms.museum_object.depth')}</Text>
          <TextInput
            style={styles.dimInput}
            value={depth}
            onChangeText={setDepth}
            onBlur={() => save({ dimensions: parseDim() })}
            keyboardType="numeric"
            placeholderTextColor="#4A4A5A"
          />
        </View>
      </View>
      <Text style={styles.fieldLabel}>{t('type_forms.museum_object.unit')}</Text>
      <View style={styles.chipRow}>
        {UNITS.map((u) => (
          <Pressable
            key={u}
            style={[styles.chip, unit === u && styles.chipActive]}
            onPress={() => {
              setUnit(u);
              save({ dimensions: { ...parseDim(), unit: u } });
            }}
          >
            <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>
              {u}
            </Text>
          </Pressable>
        ))}
      </View>

      <FieldInput
        label={t('type_forms.museum_object.period')}
        value={period}
        onChangeText={setPeriod}
        onBlur={() => save({ period: period || undefined })}
      />
      <FieldInput
        label={t('type_forms.museum_object.culture')}
        value={culture}
        onChangeText={setCulture}
        onBlur={() => save({ culture: culture || undefined })}
      />
      <FieldInput
        label={t('type_forms.museum_object.provenance')}
        value={provenance}
        onChangeText={setProvenance}
        onBlur={() => save({ provenance: provenance || undefined })}
        multiline
      />

      <Text style={styles.fieldLabel}>
        {t('type_forms.museum_object.condition')}
      </Text>
      <View style={styles.chipRow}>
        {CONDITIONS.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, condition === c && styles.chipActive]}
            onPress={() => {
              const val = c === condition ? '' : c;
              setCondition(val);
              save({ condition: val || undefined });
            }}
          >
            <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>
              {t(`type_forms.condition.${c}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FieldInput
        label={t('type_forms.museum_object.inscription')}
        value={inscription}
        onChangeText={setInscription}
        onBlur={() => save({ inscription: inscription || undefined })}
        multiline
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
  dimRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dimField: { flex: 1 },
  dimLabel: {
    color: '#636E72',
    fontSize: 10,
    marginBottom: 4,
  },
  dimInput: {
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.1)',
    borderRadius: 10,
    color: '#DFE6E9',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
