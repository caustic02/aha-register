import i18n from 'i18next';

/**
 * Returns a human-readable label for an internal enum/key value.
 * Falls back to a title-cased version of the key if no i18n match exists.
 *
 * Categories map to i18n namespaces:
 *   object_type      → object_types.<key>
 *   coordinate_source → labels.coordinate_source.<key>
 *   status           → labels.status.<key>
 *   privacy_tier     → privacy.<key>
 *   evidence_class   → evidence.<key>
 */
export function getDisplayLabel(
  key: string | null | undefined,
  category: string,
): string {
  if (key == null || key === '') return '';

  const i18nKey = CATEGORY_PREFIX[category]
    ? `${CATEGORY_PREFIX[category]}.${key}`
    : `${category}.${key}`;

  const translated = i18n.t(i18nKey, { defaultValue: '' });
  if (translated && translated !== i18nKey) return translated;

  // Fallback: title-case the raw key (replace _ with space, capitalize words)
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const CATEGORY_PREFIX: Record<string, string> = {
  object_type: 'object_types',
  coordinate_source: 'labels.coordinate_source',
  status: 'labels.status',
  privacy_tier: 'privacy',
  evidence_class: 'evidence',
};
