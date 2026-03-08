import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { FieldInput } from '../FieldInput';
import { DateField } from '../DateField';
import type { TypeFormProps } from './index';
import type { IncidentData } from '../../db/types';

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export default function IncidentForm({ data, onChange, t }: TypeFormProps) {
  const d = data as IncidentData;

  const [incidentType, setIncidentType] = useState(d.incident_type ?? '');
  const [severity, setSeverity] = useState(d.severity ?? '');
  const [perpetratorInfo, setPerpetratorInfo] = useState(d.perpetrator_info ?? '');
  const [lawEnforcement, setLawEnforcement] = useState(d.law_enforcement_notified ?? false);
  const [caseNumber, setCaseNumber] = useState(d.case_number ?? '');
  const [recoveryStatus, setRecoveryStatus] = useState(d.recovery_status ?? '');

  const save = useCallback(
    (patch: Partial<IncidentData>) => {
      onChange({ ...d, ...patch });
    },
    [d, onChange],
  );

  return (
    <View>
      <FieldInput
        label={t('type_forms.incident.incident_type')}
        value={incidentType}
        onChangeText={setIncidentType}
        onBlur={() => save({ incident_type: incidentType || undefined })}
      />
      <DateField
        label={t('type_forms.incident.date_reported')}
        value={d.date_reported}
        onChange={(iso) => save({ date_reported: iso })}
        t={t}
      />
      <DateField
        label={t('type_forms.incident.date_occurred')}
        value={d.date_occurred}
        onChange={(iso) => save({ date_occurred: iso })}
        t={t}
      />

      <Text style={styles.fieldLabel}>
        {t('type_forms.incident.severity')}
      </Text>
      <View style={styles.chipRow}>
        {SEVERITIES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, severity === s && styles.chipActive]}
            onPress={() => {
              const val = s === severity ? '' : s;
              setSeverity(val);
              save({ severity: val || undefined });
            }}
          >
            <Text style={[styles.chipText, severity === s && styles.chipTextActive]}>
              {t(`type_forms.severity.${s}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FieldInput
        label={t('type_forms.incident.perpetrator_info')}
        value={perpetratorInfo}
        onChangeText={setPerpetratorInfo}
        onBlur={() => save({ perpetrator_info: perpetratorInfo || undefined })}
        multiline
      />

      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>
          {t('type_forms.incident.law_enforcement_notified')}
        </Text>
        <Switch
          value={lawEnforcement}
          onValueChange={(val) => {
            setLawEnforcement(val);
            save({ law_enforcement_notified: val });
          }}
          trackColor={{ false: '#2D2D3A', true: '#0984E3' }}
          thumbColor="#FFFFFF"
        />
      </View>

      <FieldInput
        label={t('type_forms.incident.case_number')}
        value={caseNumber}
        onChangeText={setCaseNumber}
        onBlur={() => save({ case_number: caseNumber || undefined })}
      />
      <FieldInput
        label={t('type_forms.incident.recovery_status')}
        value={recoveryStatus}
        onChangeText={setRecoveryStatus}
        onBlur={() => save({ recovery_status: recoveryStatus || undefined })}
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
});
