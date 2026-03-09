import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { FieldInput } from '../FieldInput';
import { DateField } from '../DateField';
import type { TypeFormProps } from './index';
import type { MuseumObjectData } from '../../db/types';

const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'critical'] as const;
const UNITS = ['cm', 'mm', 'in', 'm'] as const;
const DISPLAY_STATUSES = ['ausgestellt', 'nicht ausgestellt', 'in Restaurierung', 'Depot'] as const;

// ── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  filled,
  total,
  initialOpen,
  children,
}: {
  title: string;
  filled: number;
  total: number;
  initialOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <View style={secStyles.container}>
      <Pressable style={secStyles.header} onPress={() => setOpen((o) => !o)}>
        <Text style={secStyles.title}>{title}</Text>
        <View style={secStyles.right}>
          {filled > 0 && (
            <View style={secStyles.badge}>
              <Text style={secStyles.badgeText}>{filled}/{total}</Text>
            </View>
          )}
          <Text style={secStyles.chevron}>{open ? '▲' : '▼'}</Text>
        </View>
      </Pressable>
      {open && <View style={secStyles.body}>{children}</View>}
    </View>
  );
}

const secStyles = StyleSheet.create({
  container: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.12)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(116,185,255,0.04)',
  },
  title: {
    color: '#DFE6E9',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#0984E3',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  chevron: {
    color: '#636E72',
    fontSize: 10,
  },
  body: {
    padding: 14,
    paddingTop: 8,
  },
});

// ── MuseumObjectForm ──────────────────────────────────────────────────────────

export default function MuseumObjectForm({ data, onChange, t }: TypeFormProps) {
  const d = data as MuseumObjectData;

  // Existing typed fields
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

  // New text fields (single state object for all 26 text inputs)
  const [txt, setTxt] = useState<Record<string, string>>({
    short_title: data.short_title ?? '',
    description: data.description ?? '',
    place_of_origin: data.place_of_origin ?? '',
    maker_role: data.maker_role ?? '',
    stamps_signatures: data.stamps_signatures ?? '',
    date_exact: data.date_exact ?? '',
    material_technique_notes: data.material_technique_notes ?? '',
    dimension_notes: data.dimension_notes ?? '',
    department: data.department ?? '',
    classification: data.classification ?? '',
    storage_location: data.storage_location ?? '',
    owner: data.owner ?? '',
    acquisition_type: data.acquisition_type ?? '',
    purchase_price: data.purchase_price ?? '',
    insurance_value: data.insurance_value ?? '',
    historical_collections: data.historical_collections ?? '',
    historical_inventory_numbers: data.historical_inventory_numbers ?? '',
    provenance_narrative: data.provenance_narrative ?? '',
    scientific_notes: data.scientific_notes ?? '',
    bibliography: data.bibliography ?? '',
    mentioned_in: data.mentioned_in ?? '',
    internet_comment: data.internet_comment ?? '',
    registrar_data: data.registrar_data ?? '',
    admin_notes: data.admin_notes ?? '',
    general_notes: data.general_notes ?? '',
    rights_status: data.rights_status ?? '',
  });

  // New non-text fields
  const [dimensionsVerified, setDimensionsVerified] = useState<boolean>(!!data.dimensions_verified);
  const [displayStatus, setDisplayStatus] = useState<string>(data.display_status ?? '');
  const [permanentLoan, setPermanentLoan] = useState<boolean>(!!data.permanent_loan);
  const [permanentLoanUntil, setPermanentLoanUntil] = useState<string | undefined>(
    data.permanent_loan_until,
  );

  // ── Helpers ────────────────────────────────────────────────────────────

  const save = useCallback(
    (patch: Partial<MuseumObjectData>) => {
      onChange({ ...d, ...patch });
    },
    [d, onChange],
  );

  const saveFld = useCallback(
    (key: string, val: string) => {
      onChange({ ...data, [key]: val || undefined });
    },
    [data, onChange],
  );

  const updateTxt = (key: string, val: string) =>
    setTxt((prev) => ({ ...prev, [key]: val }));

  const splitCsv = (v: string) =>
    v.split(',').map((s) => s.trim()).filter(Boolean);

  const parseDim = () => ({
    height: height ? parseFloat(height) : undefined,
    width: width ? parseFloat(width) : undefined,
    depth: depth ? parseFloat(depth) : undefined,
    unit,
  });

  // ── Filled counters ──────────────────────────────────────────────────

  const countFilled = (keys: string[]): number =>
    keys.filter((k) => {
      const v = data[k];
      if (v === undefined || v === null || v === '') return false;
      if (typeof v === 'boolean') return v;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    }).length;

  const identityFilled = countFilled([
    'short_title', 'description', 'place_of_origin', 'maker_role', 'stamps_signatures', 'date_exact',
  ]);
  const physicalFilled =
    countFilled(['material', 'technique', 'condition', 'inscription', 'material_technique_notes', 'dimension_notes', 'dimensions_verified']) +
    (height || width || depth ? 1 : 0);
  const classificationFilled = countFilled(['period', 'culture', 'department', 'classification']);
  const displayStorageFilled = countFilled(['display_status', 'storage_location']);
  const ownershipFilled = countFilled([
    'owner', 'acquisition_type', 'purchase_price', 'insurance_value', 'permanent_loan', 'permanent_loan_until',
  ]);
  const provenanceFilled = countFilled([
    'provenance', 'historical_collections', 'historical_inventory_numbers', 'provenance_narrative',
  ]);
  const researchFilled = countFilled([
    'scientific_notes', 'bibliography', 'mentioned_in', 'internet_comment',
  ]);
  const adminFilled = countFilled([
    'registrar_data', 'admin_notes', 'general_notes', 'rights_status',
  ]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <View>

      {/* ── Section 1: Identity ─────────────────────────────────────── */}
      <Section
        title={t('type_forms.museum_object.section_identity')}
        filled={identityFilled}
        total={6}
        initialOpen
      >
        <FieldInput
          label={t('type_forms.museum_object.short_title')}
          value={txt.short_title}
          onChangeText={(v) => updateTxt('short_title', v)}
          onBlur={() => saveFld('short_title', txt.short_title)}
        />
        <FieldInput
          label={t('type_forms.museum_object.description')}
          value={txt.description}
          onChangeText={(v) => updateTxt('description', v)}
          onBlur={() => saveFld('description', txt.description)}
          multiline
        />
        <FieldInput
          label={t('type_forms.museum_object.place_of_origin')}
          value={txt.place_of_origin}
          onChangeText={(v) => updateTxt('place_of_origin', v)}
          onBlur={() => saveFld('place_of_origin', txt.place_of_origin)}
        />
        <FieldInput
          label={t('type_forms.museum_object.maker_role')}
          value={txt.maker_role}
          onChangeText={(v) => updateTxt('maker_role', v)}
          onBlur={() => saveFld('maker_role', txt.maker_role)}
        />
        <FieldInput
          label={t('type_forms.museum_object.stamps_signatures')}
          value={txt.stamps_signatures}
          onChangeText={(v) => updateTxt('stamps_signatures', v)}
          onBlur={() => saveFld('stamps_signatures', txt.stamps_signatures)}
        />
        <FieldInput
          label={t('type_forms.museum_object.date_exact')}
          value={txt.date_exact}
          onChangeText={(v) => updateTxt('date_exact', v)}
          onBlur={() => saveFld('date_exact', txt.date_exact)}
        />
      </Section>

      {/* ── Section 2: Physical ─────────────────────────────────────── */}
      <Section
        title={t('type_forms.museum_object.section_physical')}
        filled={physicalFilled}
        total={8}
        initialOpen
      >
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
        <Text style={styles.fieldLabel}>{t('type_forms.museum_object.dimensions')}</Text>
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
              <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldLabel}>{t('type_forms.museum_object.condition')}</Text>
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
        <FieldInput
          label={t('type_forms.museum_object.material_technique_notes')}
          value={txt.material_technique_notes}
          onChangeText={(v) => updateTxt('material_technique_notes', v)}
          onBlur={() => saveFld('material_technique_notes', txt.material_technique_notes)}
          multiline
        />
        <FieldInput
          label={t('type_forms.museum_object.dimension_notes')}
          value={txt.dimension_notes}
          onChangeText={(v) => updateTxt('dimension_notes', v)}
          onBlur={() => saveFld('dimension_notes', txt.dimension_notes)}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('type_forms.museum_object.dimensions_verified')}</Text>
          <Switch
            value={dimensionsVerified}
            onValueChange={(v) => {
              setDimensionsVerified(v);
              onChange({ ...data, dimensions_verified: v });
            }}
            trackColor={{ false: 'rgba(116,185,255,0.1)', true: '#0984E3' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Section>

      {/* ── Section 3: Classification ────────────────────────────────── */}
      <Section
        title={t('type_forms.museum_object.section_classification')}
        filled={classificationFilled}
        total={4}
        initialOpen={false}
      >
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
          label={t('type_forms.museum_object.department')}
          value={txt.department}
          onChangeText={(v) => updateTxt('department', v)}
          onBlur={() => saveFld('department', txt.department)}
        />
        <FieldInput
          label={t('type_forms.museum_object.classification')}
          value={txt.classification}
          onChangeText={(v) => updateTxt('classification', v)}
          onBlur={() => saveFld('classification', txt.classification)}
        />
      </Section>

      {/* ── Section 4: Display & Storage ─────────────────────────────── */}
      <Section
        title={t('type_forms.museum_object.section_display_storage')}
        filled={displayStorageFilled}
        total={2}
        initialOpen={false}
      >
        <Text style={styles.fieldLabel}>{t('type_forms.museum_object.display_status')}</Text>
        <View style={styles.chipRow}>
          {DISPLAY_STATUSES.map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, displayStatus === s && styles.chipActive]}
              onPress={() => {
                const val = s === displayStatus ? '' : s;
                setDisplayStatus(val);
                onChange({ ...data, display_status: val || undefined });
              }}
            >
              <Text style={[styles.chipText, displayStatus === s && styles.chipTextActive]}>
                {t(`type_forms.museum_object.display_status_${s.replace(/ /g, '_').toLowerCase()}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <FieldInput
          label={t('type_forms.museum_object.storage_location')}
          value={txt.storage_location}
          onChangeText={(v) => updateTxt('storage_location', v)}
          onBlur={() => saveFld('storage_location', txt.storage_location)}
        />
      </Section>

      {/* ── Section 5: Ownership & Acquisition ───────────────────────── */}
      <Section
        title={t('type_forms.museum_object.section_ownership')}
        filled={ownershipFilled}
        total={6}
        initialOpen={false}
      >
        <FieldInput
          label={t('type_forms.museum_object.owner')}
          value={txt.owner}
          onChangeText={(v) => updateTxt('owner', v)}
          onBlur={() => saveFld('owner', txt.owner)}
        />
        <FieldInput
          label={t('type_forms.museum_object.acquisition_type')}
          value={txt.acquisition_type}
          onChangeText={(v) => updateTxt('acquisition_type', v)}
          onBlur={() => saveFld('acquisition_type', txt.acquisition_type)}
        />
        <FieldInput
          label={t('type_forms.museum_object.purchase_price')}
          value={txt.purchase_price}
          onChangeText={(v) => updateTxt('purchase_price', v)}
          onBlur={() => saveFld('purchase_price', txt.purchase_price)}
        />
        <FieldInput
          label={t('type_forms.museum_object.insurance_value')}
          value={txt.insurance_value}
          onChangeText={(v) => updateTxt('insurance_value', v)}
          onBlur={() => saveFld('insurance_value', txt.insurance_value)}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('type_forms.museum_object.permanent_loan')}</Text>
          <Switch
            value={permanentLoan}
            onValueChange={(v) => {
              setPermanentLoan(v);
              onChange({ ...data, permanent_loan: v });
            }}
            trackColor={{ false: 'rgba(116,185,255,0.1)', true: '#0984E3' }}
            thumbColor="#FFFFFF"
          />
        </View>
        {permanentLoan && (
          <DateField
            label={t('type_forms.museum_object.permanent_loan_until')}
            value={permanentLoanUntil}
            onChange={(v) => {
              setPermanentLoanUntil(v);
              onChange({ ...data, permanent_loan_until: v });
            }}
            t={t}
          />
        )}
      </Section>

      {/* ── Section 6: Provenance ────────────────────────────────────── */}
      <Section
        title={t('type_forms.museum_object.section_provenance')}
        filled={provenanceFilled}
        total={4}
        initialOpen={false}
      >
        <FieldInput
          label={t('type_forms.museum_object.provenance')}
          value={provenance}
          onChangeText={setProvenance}
          onBlur={() => save({ provenance: provenance || undefined })}
          multiline
        />
        <FieldInput
          label={t('type_forms.museum_object.historical_collections')}
          value={txt.historical_collections}
          onChangeText={(v) => updateTxt('historical_collections', v)}
          onBlur={() => saveFld('historical_collections', txt.historical_collections)}
          multiline
        />
        <FieldInput
          label={t('type_forms.museum_object.historical_inventory_numbers')}
          value={txt.historical_inventory_numbers}
          onChangeText={(v) => updateTxt('historical_inventory_numbers', v)}
          onBlur={() => saveFld('historical_inventory_numbers', txt.historical_inventory_numbers)}
        />
        <FieldInput
          label={t('type_forms.museum_object.provenance_narrative')}
          value={txt.provenance_narrative}
          onChangeText={(v) => updateTxt('provenance_narrative', v)}
          onBlur={() => saveFld('provenance_narrative', txt.provenance_narrative)}
          multiline
        />
      </Section>

      {/* ── Section 7: Research & Bibliography ───────────────────────── */}
      <Section
        title={t('type_forms.museum_object.section_research')}
        filled={researchFilled}
        total={4}
        initialOpen={false}
      >
        <FieldInput
          label={t('type_forms.museum_object.scientific_notes')}
          value={txt.scientific_notes}
          onChangeText={(v) => updateTxt('scientific_notes', v)}
          onBlur={() => saveFld('scientific_notes', txt.scientific_notes)}
          multiline
        />
        <FieldInput
          label={t('type_forms.museum_object.bibliography')}
          value={txt.bibliography}
          onChangeText={(v) => updateTxt('bibliography', v)}
          onBlur={() => saveFld('bibliography', txt.bibliography)}
          multiline
        />
        <FieldInput
          label={t('type_forms.museum_object.mentioned_in')}
          value={txt.mentioned_in}
          onChangeText={(v) => updateTxt('mentioned_in', v)}
          onBlur={() => saveFld('mentioned_in', txt.mentioned_in)}
        />
        <FieldInput
          label={t('type_forms.museum_object.internet_comment')}
          value={txt.internet_comment}
          onChangeText={(v) => updateTxt('internet_comment', v)}
          onBlur={() => saveFld('internet_comment', txt.internet_comment)}
        />
      </Section>

      {/* ── Section 8: Administration ────────────────────────────────── */}
      <Section
        title={t('type_forms.museum_object.section_admin')}
        filled={adminFilled}
        total={4}
        initialOpen={false}
      >
        <FieldInput
          label={t('type_forms.museum_object.registrar_data')}
          value={txt.registrar_data}
          onChangeText={(v) => updateTxt('registrar_data', v)}
          onBlur={() => saveFld('registrar_data', txt.registrar_data)}
          multiline
        />
        <FieldInput
          label={t('type_forms.museum_object.admin_notes')}
          value={txt.admin_notes}
          onChangeText={(v) => updateTxt('admin_notes', v)}
          onBlur={() => saveFld('admin_notes', txt.admin_notes)}
          multiline
        />
        <FieldInput
          label={t('type_forms.museum_object.general_notes')}
          value={txt.general_notes}
          onChangeText={(v) => updateTxt('general_notes', v)}
          onBlur={() => saveFld('general_notes', txt.general_notes)}
          multiline
        />
        <FieldInput
          label={t('type_forms.museum_object.rights_status')}
          value={txt.rights_status}
          onChangeText={(v) => updateTxt('rights_status', v)}
          onBlur={() => saveFld('rights_status', txt.rights_status)}
        />
      </Section>

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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    flex: 1,
  },
});
