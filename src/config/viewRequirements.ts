/**
 * Domain-specific view requirements for guided capture and export.
 *
 * Each domain defines which photographic views are required (minimum for
 * a complete record), recommended (improves the record), and which view
 * is the default primary/"hero" image.
 */
import type { ViewType, Media } from '../db/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ViewRequirements {
  /** Minimum views for a complete record */
  required: ViewType[];
  /** Additional views that improve the record */
  recommended: ViewType[];
  /** Default primary/"hero" view for this domain */
  primary: ViewType;
}

export interface ViewInventory {
  /** view_types that have at least one photo */
  captured: ViewType[];
  /** Required views not yet captured */
  missing_required: ViewType[];
  /** Recommended views not yet captured */
  missing_recommended: ViewType[];
  /** Percentage of required views captured (0–100) */
  completeness: number;
  /** Best candidate for primary display image */
  primary_image: Media | null;
}

// ── Domain configs ───────────────────────────────────────────────────────────

const VIEW_REQUIREMENTS: Record<string, ViewRequirements> = {
  fine_art_painting: {
    required: ['front', 'back'],
    recommended: ['detail', 'detail_signature', 'detail_damage', 'overall'],
    primary: 'front',
  },
  fine_art_sculpture: {
    required: ['front', 'back', 'left_side', 'right_side'],
    recommended: ['top', 'detail', 'detail_signature', 'overall'],
    primary: 'front',
  },
  ceramics: {
    required: ['front', 'bottom', 'top'],
    recommended: ['detail', 'detail_signature', 'detail_damage', 'interior'],
    primary: 'top',
  },
  textiles: {
    required: ['front', 'back'],
    recommended: ['detail', 'detail_damage'],
    primary: 'front',
  },
  furniture: {
    required: ['front', 'back', 'top'],
    recommended: ['left_side', 'right_side', 'bottom', 'detail', 'detail_damage', 'detail_label', 'interior'],
    primary: 'front',
  },
  archaeology: {
    required: ['front', 'back', 'top', 'bottom'],
    recommended: ['left_side', 'right_side', 'detail', 'detail_label'],
    primary: 'front',
  },
  natural_history: {
    required: ['front', 'back', 'top'],
    recommended: ['left_side', 'right_side', 'detail', 'bottom'],
    primary: 'front',
  },
  ethnography: {
    required: ['front', 'back'],
    recommended: ['detail', 'detail_label', 'overall', 'interior'],
    primary: 'front',
  },
  photography_works_on_paper: {
    required: ['front', 'back'],
    recommended: ['detail', 'detail_signature', 'detail_damage', 'overall'],
    primary: 'front',
  },
  human_rights: {
    required: ['front', 'overall'],
    recommended: ['back', 'detail', 'detail_damage', 'detail_label'],
    primary: 'front',
  },
  conservation: {
    required: ['front', 'back', 'detail_damage'],
    recommended: ['top', 'bottom', 'left_side', 'right_side', 'detail', 'detail_label'],
    primary: 'front',
  },
  general: {
    required: ['front', 'back'],
    recommended: ['detail', 'top'],
    primary: 'front',
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the view requirements for a domain, falling back to 'general'.
 */
export function getViewRequirements(domain: string): ViewRequirements {
  return VIEW_REQUIREMENTS[domain] ?? VIEW_REQUIREMENTS.general;
}

/**
 * Computes the view inventory for an object given its media records and domain.
 *
 * Only considers 'original' media (not derivatives, not document scans/deskewed).
 */
export function getViewInventory(
  domain: string,
  mediaRecords: Media[],
): ViewInventory {
  const reqs = getViewRequirements(domain);

  // Only count original object captures (not derivatives or document media)
  const objectMedia = mediaRecords.filter(
    (m) =>
      !m.media_type ||
      m.media_type === 'original',
  );

  // Collect unique captured view types
  const capturedSet = new Set<ViewType>();
  for (const m of objectMedia) {
    if (m.view_type) {
      capturedSet.add(m.view_type);
    }
  }
  const captured = [...capturedSet];

  const missing_required = reqs.required.filter((v) => !capturedSet.has(v));
  const missing_recommended = reqs.recommended.filter((v) => !capturedSet.has(v));

  const requiredCount = reqs.required.length;
  const capturedRequiredCount = requiredCount - missing_required.length;
  const completeness =
    requiredCount > 0 ? Math.round((capturedRequiredCount / requiredCount) * 100) : 100;

  // Primary image selection: tagged primary view → first front → is_primary → first capture
  const primaryViewMedia = objectMedia.find((m) => m.view_type === reqs.primary);
  const frontMedia = objectMedia.find((m) => m.view_type === 'front');
  const isPrimaryMedia = objectMedia.find((m) => m.is_primary === 1);
  const primary_image =
    primaryViewMedia ?? frontMedia ?? isPrimaryMedia ?? objectMedia[0] ?? null;

  return {
    captured,
    missing_required,
    missing_recommended,
    completeness,
    primary_image,
  };
}
