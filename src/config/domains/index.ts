/**
 * Domain configuration registry.
 *
 * Each domain is a JSON file defining available export formats,
 * field categories, and per-field defaults. The hook and stepper
 * read from here instead of hardcoding field lists.
 */

import museumCollectionData from './museum_collection.json';
import ahaMarketplaceData from './aha_marketplace.json';
import generalData from './general.json';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FieldConfig {
  id: string;
  label: string;
  label_de: string;
  defaultOn: boolean;
}

export interface FieldCategory {
  id: string;
  label: string;
  label_de: string;
  fields: FieldConfig[];
}

export interface DomainExportFormat {
  id: string;
  label: string;
  label_de: string;
  description: string;
  description_de: string;
  templateId: string | null;
}

export interface DomainConfig {
  id: string;
  label: string;
  label_de: string;
  exportFormats: DomainExportFormat[];
  fieldCategories: FieldCategory[];
}

// ── Registry ─────────────────────────────────────────────────────────────────

const DOMAINS: Record<string, DomainConfig> = {
  museum_collection: museumCollectionData as DomainConfig,
  aha_marketplace: ahaMarketplaceData as DomainConfig,
  general: generalData as DomainConfig,
};

/**
 * Get domain configuration by ID.
 * Falls back to 'general' if the domain is not found.
 */
export function getDomainConfig(domainId: string): DomainConfig {
  return DOMAINS[domainId] ?? DOMAINS.general;
}

/** All registered domain IDs. */
export const AVAILABLE_DOMAINS = Object.keys(DOMAINS);

/** All domain configs for domain selector UI. */
export function getAllDomainConfigs(): DomainConfig[] {
  return Object.values(DOMAINS);
}
