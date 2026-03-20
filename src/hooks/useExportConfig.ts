/**
 * Export configuration state hook.
 *
 * Field definitions, categories, and export formats are loaded from
 * domain JSON configs (src/config/domains/). This hook manages the
 * runtime toggle state — it does NOT define the field inventory.
 */
import { useCallback, useMemo, useState } from 'react';
import { getExportTemplate, type ExportTier } from '../config/exportTemplates';
import { getDomainConfig, type DomainConfig } from '../config/domains';
import type { Media } from '../db/types';
import { getViewInventory } from '../config/viewRequirements';

// ── Types ────────────────────────────────────────────────────────────────────

export type ExportFormat = string;

export interface ExportSections {
  [categoryId: string]: boolean;
}

/** Flat map of field ID → on/off. Populated from domain config. */
export type ExportFields = Record<string, boolean>;

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildFieldDefaults(domain: DomainConfig): ExportFields {
  const f: Record<string, boolean> = {};
  for (const cat of domain.fieldCategories) {
    for (const field of cat.fields) {
      f[field.id] = field.defaultOn;
    }
  }
  return f;
}

function buildSectionDefaults(domain: DomainConfig): ExportSections {
  const s: Record<string, boolean> = {};
  for (const cat of domain.fieldCategories) {
    s[cat.id] = cat.fields.some((f) => f.defaultOn);
  }
  return s;
}

function buildDefault(domain: DomainConfig): ExportConfig {
  const defaultFormat = domain.exportFormats[0]?.id ?? 'pdf_datasheet';
  return {
    format: defaultFormat,
    template: 'standard',
    selectedImageIds: [],
    useIsolated: true,
    showDimensions: false,
    sections: buildSectionDefaults(domain),
    fields: buildFieldDefaults(domain),
    showAiBadges: false,
    includeBranding: true,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useExportConfig(domainId: string = 'museum_collection') {
  const domain = useMemo(() => getDomainConfig(domainId), [domainId]);
  const [config, setConfig] = useState<ExportConfig>(() => buildDefault(domain));

  /** Derived: category → field IDs mapping from the domain config. */
  const categoryFields = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const cat of domain.fieldCategories) {
      m[cat.id] = cat.fields.map((f) => f.id);
    }
    return m;
  }, [domain]);

  const reset = useCallback(
    () => setConfig(buildDefault(domain)),
    [domain],
  );

  const setFormat = useCallback((format: ExportFormat) => {
    setConfig((prev) => ({ ...prev, format }));
  }, []);

  const applyTemplate = useCallback(
    (tier: ExportTier, media: Media[], templateDomain: string) => {
      const tmpl = getExportTemplate(tier);
      const inventory = getViewInventory(templateDomain, media);

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
        sections: buildSectionDefaults(domain),
        fields: buildFieldDefaults(domain),
        showAiBadges: tmpl.showAiBadges,
        includeBranding: true,
      }));
    },
    [domain],
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

  const toggleSection = useCallback((key: string) => {
    if (key === 'identification') return;
    setConfig((prev) => ({
      ...prev,
      sections: { ...prev.sections, [key]: !prev.sections[key] },
    }));
  }, []);

  const toggleField = useCallback((key: string) => {
    setConfig((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: !prev.fields[key] },
    }));
  }, []);

  const toggleCategoryFields = useCallback(
    (category: string, value: boolean) => {
      const keys = categoryFields[category];
      if (!keys) return;
      setConfig((prev) => {
        const next = { ...prev.fields };
        for (const k of keys) next[k] = value;
        return { ...prev, fields: next };
      });
    },
    [categoryFields],
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
    domain,
    categoryFields,
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
