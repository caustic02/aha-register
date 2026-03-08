import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { FieldInput } from '../FieldInput';
import type { TypeFormProps } from './index';
import type { EnvironmentalSampleData } from '../../db/types';

export default function EnvironmentalSampleForm({ data, onChange, t }: TypeFormProps) {
  const d = data as EnvironmentalSampleData;

  const [sampleType, setSampleType] = useState(d.sample_type ?? '');
  const [collectionMethod, setCollectionMethod] = useState(d.collection_method ?? '');
  const [storageConditions, setStorageConditions] = useState(d.storage_conditions ?? '');
  const [analysisMethod, setAnalysisMethod] = useState(d.analysis_method ?? '');
  const [results, setResults] = useState(d.results ?? '');
  const [contaminationLevel, setContaminationLevel] = useState(d.contamination_level ?? '');
  const [phLevel, setPhLevel] = useState(d.ph_level?.toString() ?? '');
  const [temperature, setTemperature] = useState(d.temperature?.toString() ?? '');

  const save = useCallback(
    (patch: Partial<EnvironmentalSampleData>) => {
      onChange({ ...d, ...patch });
    },
    [d, onChange],
  );

  return (
    <View>
      <FieldInput
        label={t('type_forms.environmental_sample.sample_type')}
        value={sampleType}
        onChangeText={setSampleType}
        onBlur={() => save({ sample_type: sampleType || undefined })}
      />
      <FieldInput
        label={t('type_forms.environmental_sample.collection_method')}
        value={collectionMethod}
        onChangeText={setCollectionMethod}
        onBlur={() => save({ collection_method: collectionMethod || undefined })}
      />
      <FieldInput
        label={t('type_forms.environmental_sample.storage_conditions')}
        value={storageConditions}
        onChangeText={setStorageConditions}
        onBlur={() => save({ storage_conditions: storageConditions || undefined })}
      />
      <FieldInput
        label={t('type_forms.environmental_sample.analysis_method')}
        value={analysisMethod}
        onChangeText={setAnalysisMethod}
        onBlur={() => save({ analysis_method: analysisMethod || undefined })}
      />
      <FieldInput
        label={t('type_forms.environmental_sample.results')}
        value={results}
        onChangeText={setResults}
        onBlur={() => save({ results: results || undefined })}
        multiline
      />
      <FieldInput
        label={t('type_forms.environmental_sample.contamination_level')}
        value={contaminationLevel}
        onChangeText={setContaminationLevel}
        onBlur={() => save({ contamination_level: contaminationLevel || undefined })}
      />
      <FieldInput
        label={`${t('type_forms.environmental_sample.ph_level')}`}
        value={phLevel}
        onChangeText={setPhLevel}
        onBlur={() =>
          save({ ph_level: phLevel ? parseFloat(phLevel) : undefined })
        }
      />
      <FieldInput
        label={`${t('type_forms.environmental_sample.temperature')} (\u00B0C)`}
        value={temperature}
        onChangeText={setTemperature}
        onBlur={() =>
          save({ temperature: temperature ? parseFloat(temperature) : undefined })
        }
      />
    </View>
  );
}
