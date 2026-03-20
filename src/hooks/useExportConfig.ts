/**
 * Export configuration state hook.
 *
 * Manages the full config for the 5-step export stepper.
 * Template selection pre-fills defaults from exportTemplates.ts;
 * user overrides persist within the session.
 */
import { useCallback, useState } from 'react';
import { getExportTemplate, type ExportTier } from '../config/exportTemplates';
import type { Media } from '../db/types';
import { getViewInventory } from '../config/viewRequirements';

// ── Types ────────────────────────────────────────────────────────────────────

export type ExportFormat = 'pdf_datasheet' | 'pdf_condition' | 'json' | 'csv';

export interface ExportSections {
  identification: boolean;
  physical: boolean;
  classification: boolean;
  condition: boolean;
  provenance: boolean;
  documents: boolean;
}

/** Every individually toggleable field in the export. */
export interface ExportFields {
  // Identification
  accession_number: boolean;
  inventory_number: boolean;
  title: boolean;
  alt_titles: boolean;
  object_type: boolean;
  creator: boolean;
  artist_attribution: boolean;
  date_period: boolean;
  place_of_origin: boolean;
  description: boolean;
  // Physical
  materials: boolean;
  technique: boolean;
  dimensions: boolean;
  weight: boolean;
  inscriptions: boolean;
  color_notes: boolean;
  parts_count: boolean;
  fragility: boolean;
  // Classification
  aat_terms: boolean;
  style_period: boolean;
  subject_matter: boolean;
  cultural_context: boolean;
  domain_specialization: boolean;
  // Condition
  condition_summary: boolean;
  condition_rating: boolean;
  condition_date: boolean;
  damage_notes: boolean;
  conservation_history: boolean;
  handling_requirements: boolean;
  environmental_sensitivity: boolean;
  // Provenance
  ownership_history: boolean;
  acquisition_method: boolean;
  acquisition_date: boolean;
  source_donor: boolean;
  credit_line: boolean;
  legal_status: boolean;
  export_restrictions: boolean;
  deaccession_status: boolean;
  // Location
  current_location: boolean;
  building_room_shelf: boolean;
  storage_requirements: boolean;
  climate_requirements: boolean;
  // Media
  primary_photo: boolean;
  all_photos: boolean;
  isolated_images: boolean;
  document_scans: boolean;
  // Capture verification
  sha256_hash: boolean;
  gps_coordinates: boolean;
  capture_timestamp: boolean;
  device_info: boolean;
  coordinate_source: boolean;
  evidence_class: boolean;
  privacy_tier: boolean;
  // Valuation
  insurance_value: boolean;
  appraisal_date: boolean;
  fair_market_value: boolean;
  replacement_value: boolean;
  // Legal
  legal_hold: boolean;
  berkeley_protocol: boolean;
  restricted_access: boolean;
}

/** Maps each category to its field keys. */
export const CATEGORY_FIELDS: Record<string, (keyof ExportFields)[]> = {
  identification: [
    'accession_number', 'inventory_number', 'title', 'alt_titles',
    'object_type', 'creator', 'artist_attribution', 'date_period',
    'place_of_origin', 'description',
  ],
  physical: [
    'materials', 'technique', 'dimensions', 'weight',
    'inscriptions', 'color_notes', 'parts_count', 'fragility',
  ],
  classification: [
    'aat_terms', 'style_period', 'subject_matter',
    'cultural_context', 'domain_specialization',
  ],
  condition: [
    'condition_summary', 'condition_rating', 'condition_date',
    'damage_notes', 'conservation_history', 'handling_requirements',
    'environmental_sensitivity',
  ],
  provenance: [
    'ownership_history', 'acquisition_method', 'acquisition_date',
    'source_donor', 'credit_line', 'legal_status',
    'export_restrictions', 'deaccession_status',
  ],
  location: [
    'current_location', 'building_room_shelf',
    'storage_requirements', 'climate_requirements',
  ],
  media: [
    'primary_photo', 'all_photos', 'isolated_images', 'document_scans',
  ],
  capture: [
    'sha256_hash', 'gps_coordinates', 'capture_timestamp',
    'device_info', 'coordinate_source', 'evidence_class', 'privacy_tier',
  ],
  valuation: [
    'insurance_value', 'appraisal_date', 'fair_market_value', 'replacement_value',
  ],
  legal: [
    'legal_hold', 'berkeley_protocol', 'restricted_access',
  ],
};

export interface ExportConfig {
  format: ExportFormat;
  template: ExportTier;
  selectedImageIds: string[];
  useIsolated: boolean;
  showDimensions: boolean;
  sections: ExportSections;
  fields: ExportFields;
  showAiBadges: boolean;
  includeBranding: boolean;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

function allFieldsOn(): ExportFields {
  const f: Record<string, boolean> = {};
  for (const keys of Object.values(CATEGORY_FIELDS)) {
    for (const k of keys) f[k] = true;
  }
  return f as unknown as ExportFields;
}

function buildDefault(): ExportConfig {
  return {
    format: 'pdf_datasheet',
    template: 'standard',
    selectedImageIds: [],
    useIsolated: true,
    showDimensions: false,
    sections: {
      identification: true,
      physical: true,
      classification: true,
      condition: false,
      provenance: false,
      documents: false,
    },
    fields: allFieldsOn(),
    showAiBadges: false,
    includeBranding: true,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useExportConfig() {
  const [config, setConfig] = useState<ExportConfig>(buildDefault);

  const reset = useCallback(() => setConfig(buildDefault()), []);

  const setFormat = useCallback((format: ExportFormat) => {
    setConfig((prev) => ({ ...prev, format }));
  }, []);

  const applyTemplate = useCallback(
    (tier: ExportTier, media: Media[], domain: string) => {
      const tmpl = getExportTemplate(tier);
      const inventory = getViewInventory(domain, media);

      // Select images based on template tier
      const originals = media.filter(
        (m) => !m.media_type || m.media_type === 'original',
      );
      let selectedIds: string[];

      if (tier === 'quick') {
        selectedIds = inventory.primary_image
          ? [inventory.primary_image.id]
          : originals.slice(0, 1).map((m) => m.id);
      } else if (tier === 'standard') {
        const primaryId = inventory.primary_image?.id;
        const others = originals
          .filter((m) => m.id !== primaryId)
          .slice(0, 3);
        selectedIds = [
          ...(primaryId ? [primaryId] : []),
          ...others.map((m) => m.id),
        ];
      } else {
        selectedIds = originals.map((m) => m.id);
      }

      setConfig((prev) => ({
        ...prev,
        template: tier,
        selectedImageIds: selectedIds,
        useIsolated: tmpl.preferIsolated,
        showDimensions: false,
        sections: {
          identification: true,
          physical: tmpl.fieldGroups.includes('physical'),
          classification: tmpl.fieldGroups.includes('classification'),
          condition: tmpl.condition !== 'none',
          provenance: tmpl.provenance,
          documents: tmpl.includeDocuments,
        },
        fields: allFieldsOn(),
        showAiBadges: tmpl.showAiBadges,
        includeBranding: true,
      }));
    },
    [],
  );

  const toggleImage = useCallback((mediaId: string) => {
    setConfig((prev) => {
      const ids = prev.selectedImageIds;
      return {
        ...prev,
        selectedImageIds: ids.includes(mediaId)
          ? ids.filter((id) => id !== mediaId)
          : [...ids, mediaId],
      };
    });
  }, []);

  const toggleSection = useCallback(
    (key: keyof ExportSections) => {
      if (key === 'identification') return;
      setConfig((prev) => ({
        ...prev,
        sections: { ...prev.sections, [key]: !prev.sections[key] },
      }));
    },
    [],
  );

  const toggleField = useCallback((key: keyof ExportFields) => {
    setConfig((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: !prev.fields[key] },
    }));
  }, []);

  const toggleCategoryFields = useCallback(
    (category: string, value: boolean) => {
      const keys = CATEGORY_FIELDS[category];
      if (!keys) return;
      setConfig((prev) => {
        const next = { ...prev.fields };
        for (const k of keys) next[k] = value;
        return { ...prev, fields: next };
      });
    },
    [],
  );

  const setFlag = useCallback(
    <K extends 'useIsolated' | 'showDimensions' | 'showAiBadges' | 'includeBranding'>(
      key: K,
      value: boolean,
    ) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return {
    config,
    reset,
    setFormat,
    applyTemplate,
    toggleImage,
    toggleSection,
    toggleField,
    toggleCategoryFields,
    setFlag,
  };
}
