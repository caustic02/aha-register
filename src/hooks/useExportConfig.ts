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

export interface ExportConfig {
  format: ExportFormat;
  template: ExportTier;
  selectedImageIds: string[];
  useIsolated: boolean;
  showDimensions: boolean;
  sections: ExportSections;
  showAiBadges: boolean;
  includeBranding: boolean;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

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
    setFlag,
  };
}
