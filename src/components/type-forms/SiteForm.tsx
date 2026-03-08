import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { FieldInput } from '../FieldInput';
import type { TypeFormProps } from './index';
import type { SiteData } from '../../db/types';

export default function SiteForm({ data, onChange, t }: TypeFormProps) {
  const d = data as SiteData;

  const [siteClassification, setSiteClassification] = useState(d.site_classification ?? '');
  const [periodFrom, setPeriodFrom] = useState(d.period_from ?? '');
  const [periodTo, setPeriodTo] = useState(d.period_to ?? '');
  const [surveyMethod, setSurveyMethod] = useState(d.survey_method ?? '');
  const [landUse, setLandUse] = useState(d.land_use ?? '');
  const [threats, setThreats] = useState((d.threats ?? []).join(', '));
  const [protectionStatus, setProtectionStatus] = useState(d.protection_status ?? '');

  const save = useCallback(
    (patch: Partial<SiteData>) => {
      onChange({ ...d, ...patch });
    },
    [d, onChange],
  );

  const splitCsv = (v: string) =>
    v.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <View>
      <FieldInput
        label={t('type_forms.site.site_classification')}
        value={siteClassification}
        onChangeText={setSiteClassification}
        onBlur={() => save({ site_classification: siteClassification || undefined })}
      />
      <FieldInput
        label={t('type_forms.site.period_from')}
        value={periodFrom}
        onChangeText={setPeriodFrom}
        onBlur={() => save({ period_from: periodFrom || undefined })}
      />
      <FieldInput
        label={t('type_forms.site.period_to')}
        value={periodTo}
        onChangeText={setPeriodTo}
        onBlur={() => save({ period_to: periodTo || undefined })}
      />
      <FieldInput
        label={t('type_forms.site.survey_method')}
        value={surveyMethod}
        onChangeText={setSurveyMethod}
        onBlur={() => save({ survey_method: surveyMethod || undefined })}
      />
      <FieldInput
        label={t('type_forms.site.land_use')}
        value={landUse}
        onChangeText={setLandUse}
        onBlur={() => save({ land_use: landUse || undefined })}
      />
      <FieldInput
        label={t('type_forms.site.threats')}
        value={threats}
        onChangeText={setThreats}
        onBlur={() => save({ threats: splitCsv(threats) })}
        placeholder={t('type_forms.comma_separated')}
      />
      <FieldInput
        label={t('type_forms.site.protection_status')}
        value={protectionStatus}
        onChangeText={setProtectionStatus}
        onBlur={() => save({ protection_status: protectionStatus || undefined })}
      />
    </View>
  );
}
