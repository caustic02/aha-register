/**
 * Export template tiers following the Articheck pattern.
 *
 * Three tiers of export detail, each defining which fields, how many
 * images, and which features to include. The view inventory system
 * feeds into image selection for standard and detailed tiers.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ExportTier = 'quick' | 'standard' | 'detailed';

export interface ExportTemplateConfig {
  /** Display name for the tier */
  tier: ExportTier;
  /** Maximum number of PDF pages (0 = unlimited) */
  maxPages: number;
  /** Maximum number of images to include */
  maxImages: number;
  /** Use isolated image as primary if available */
  preferIsolated: boolean;
  /** Include view_type labels under images */
  showViewLabels: boolean;
  /** Field groups to include */
  fieldGroups: ExportFieldGroup[];
  /** Condition detail level */
  condition: 'none' | 'summary' | 'full';
  /** Include provenance section */
  provenance: boolean;
  /** Include Getty AAT term URIs */
  showAatTerms: boolean;
  /** Show AI confidence badges on fields */
  showAiBadges: boolean;
  /** Include document scans */
  includeDocuments: boolean;
  /** Include audit trail summary */
  includeAuditTrail: boolean;
}

export type ExportFieldGroup =
  | 'identification'
  | 'physical'
  | 'classification'
  | 'condition'
  | 'provenance'
  | 'exhibition_history';

// ── Template definitions ─────────────────────────────────────────────────────

const TEMPLATES: Record<ExportTier, ExportTemplateConfig> = {
  quick: {
    tier: 'quick',
    maxPages: 1,
    maxImages: 1,
    preferIsolated: true,
    showViewLabels: false,
    fieldGroups: ['identification'],
    condition: 'none',
    provenance: false,
    showAatTerms: false,
    showAiBadges: false,
    includeDocuments: false,
    includeAuditTrail: false,
  },
  standard: {
    tier: 'standard',
    maxPages: 2,
    maxImages: 4,
    preferIsolated: true,
    showViewLabels: true,
    fieldGroups: ['identification', 'physical', 'classification'],
    condition: 'summary',
    provenance: false,
    showAatTerms: true,
    showAiBadges: false,
    includeDocuments: false,
    includeAuditTrail: false,
  },
  detailed: {
    tier: 'detailed',
    maxPages: 0,
    maxImages: 0,
    preferIsolated: true,
    showViewLabels: true,
    fieldGroups: [
      'identification',
      'physical',
      'classification',
      'condition',
      'provenance',
      'exhibition_history',
    ],
    condition: 'full',
    provenance: true,
    showAatTerms: true,
    showAiBadges: true,
    includeDocuments: true,
    includeAuditTrail: true,
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

export function getExportTemplate(tier: ExportTier): ExportTemplateConfig {
  return TEMPLATES[tier];
}

/** All tiers in presentation order */
export const EXPORT_TIERS: ExportTier[] = ['quick', 'standard', 'detailed'];
