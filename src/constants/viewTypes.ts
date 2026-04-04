import type { RegisterViewType } from '../db/types';

export interface ViewTypeDefinition {
  key: RegisterViewType;
  labelKey: string; // i18n key under 'view_types'
  icon: string; // lucide icon name
}

/**
 * Registerbogen standard views for museum object documentation.
 * 6 standard views + detail. Order follows museum convention.
 */
export const VIEW_TYPES: readonly ViewTypeDefinition[] = [
  { key: 'ansicht_front', labelKey: 'view_types.ansicht_front', icon: 'eye' },
  { key: 'ansicht_rechts', labelKey: 'view_types.ansicht_rechts', icon: 'chevron-right' },
  { key: 'ansicht_links', labelKey: 'view_types.ansicht_links', icon: 'chevron-left' },
  { key: 'ansicht_hinten', labelKey: 'view_types.ansicht_hinten', icon: 'arrow-left' },
  { key: 'aufsicht', labelKey: 'view_types.aufsicht', icon: 'arrow-down' },
  { key: 'untersicht', labelKey: 'view_types.untersicht', icon: 'arrow-up' },
  { key: 'detail', labelKey: 'view_types.detail', icon: 'search' },
] as const;

/** The 6 standard Registerbogen views (excludes detail) */
export const STANDARD_VIEW_TYPES = VIEW_TYPES.filter(
  (v) => v.key !== 'detail',
) as ViewTypeDefinition[];

/** Default view type for the first photo captured */
export const DEFAULT_FIRST_VIEW: RegisterViewType = 'ansicht_front';
