import React, { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { FieldInput } from '../FieldInput';
import type { TypeFormProps } from './index';
import type { SpecimenData } from '../../db/types';
import { colors, typography } from '../../theme';

export default function SpecimenForm({ data, onChange, t }: TypeFormProps) {
  const d = data as SpecimenData;

  const [taxon, setTaxon] = useState(d.taxon ?? '');
  const [specimenType, setSpecimenType] = useState(d.specimen_type ?? '');
  const [collectionMethod, setCollectionMethod] = useState(d.collection_method ?? '');
  const [preservationMethod, setPreservationMethod] = useState(d.preservation_method ?? '');
  const [storageRequirements, setStorageRequirements] = useState(d.storage_requirements ?? '');
  const [geneticData, setGeneticData] = useState(d.genetic_data_available ?? false);

  const save = useCallback(
    (patch: Partial<SpecimenData>) => {
      onChange({ ...d, ...patch });
    },
    [d, onChange],
  );

  return (
    <View>
      <FieldInput
        label={t('type_forms.specimen.taxon')}
        value={taxon}
        onChangeText={setTaxon}
        onBlur={() => save({ taxon: taxon || undefined })}
      />
      <FieldInput
        label={t('type_forms.specimen.specimen_type')}
        value={specimenType}
        onChangeText={setSpecimenType}
        onBlur={() => save({ specimen_type: specimenType || undefined })}
      />
      <FieldInput
        label={t('type_forms.specimen.collection_method')}
        value={collectionMethod}
        onChangeText={setCollectionMethod}
        onBlur={() => save({ collection_method: collectionMethod || undefined })}
      />
      <FieldInput
        label={t('type_forms.specimen.preservation_method')}
        value={preservationMethod}
        onChangeText={setPreservationMethod}
        onBlur={() => save({ preservation_method: preservationMethod || undefined })}
      />
      <FieldInput
        label={t('type_forms.specimen.storage_requirements')}
        value={storageRequirements}
        onChangeText={setStorageRequirements}
        onBlur={() => save({ storage_requirements: storageRequirements || undefined })}
      />
      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>
          {t('type_forms.specimen.genetic_data_available')}
        </Text>
        <Switch
          value={geneticData}
          onValueChange={(val) => {
            setGeneticData(val);
            save({ genetic_data_available: val });
          }}
          trackColor={{ false: colors.border, true: colors.heroGreen }}
          thumbColor={colors.white}
        />
      </View>
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
});
