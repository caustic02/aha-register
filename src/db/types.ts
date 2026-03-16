// ── Union types ──────────────────────────────────────────────────────────────

export type ObjectType =
  | 'museum_object'
  | 'site'
  | 'incident'
  | 'specimen'
  | 'architectural_element'
  | 'environmental_sample'
  | 'conservation_record';

export type PrivacyTier = 'public' | 'confidential' | 'anonymous';

export type EvidenceClass = 'primary' | 'corroborative' | 'contextual';

export type SyncAction = 'insert' | 'update' | 'delete';

export type SyncStatus = 'pending' | 'syncing' | 'failed';

export type PersonType = 'individual' | 'collective' | 'unknown';

export type PersonRole =
  | 'artist'
  | 'collaborator'
  | 'fabricator'
  | 'programmer'
  | 'curator'
  | 'donor'
  | 'restorer'
  | 'photographer'
  | 'publisher'
  | 'commissioner'
  | 'unknown';

export type LicenseType =
  | 'CC-BY'
  | 'CC-BY-NC'
  | 'CC-BY-SA'
  | 'CC0'
  | 'all-rights-reserved'
  | 'institution-specific'
  | 'TK-label';

export type TranscriptionStatus = 'none' | 'draft' | 'ai_generated' | 'verified';

// ── JSONB type-specific data templates ───────────────────────────────────────

export interface MuseumObjectData {
  material?: string[];
  technique?: string[];
  dimensions?: { height?: number; width?: number; depth?: number; unit?: string };
  period?: string;
  culture?: string;
  provenance?: string;
  condition?: string;
  inscription?: string;
}

export interface SiteData {
  site_classification?: string;
  period_from?: string;
  period_to?: string;
  survey_method?: string;
  land_use?: string;
  threats?: string[];
  protection_status?: string;
}

export interface IncidentData {
  incident_type?: string;
  date_reported?: string;
  date_occurred?: string;
  severity?: string;
  perpetrator_info?: string;
  law_enforcement_notified?: boolean;
  case_number?: string;
  recovery_status?: string;
}

export interface SpecimenData {
  taxon?: string;
  specimen_type?: string;
  collection_method?: string;
  preservation_method?: string;
  storage_requirements?: string;
  genetic_data_available?: boolean;
}

export interface ArchitecturalElementData {
  element_type?: string;
  style?: string;
  construction_material?: string[];
  construction_date?: string;
  structural_condition?: string;
  load_bearing?: boolean;
  restoration_history?: string[];
}

export interface EnvironmentalSampleData {
  sample_type?: string;
  collection_method?: string;
  storage_conditions?: string;
  analysis_method?: string;
  results?: string;
  contamination_level?: string;
  ph_level?: number;
  temperature?: number;
}

export interface ConservationRecordData {
  treatment_type?: string;
  conservator?: string;
  date_started?: string;
  date_completed?: string;
  materials_used?: string[];
  before_condition?: string;
  after_condition?: string;
  recommendations?: string;
  next_review_date?: string;
}

export type TypeSpecificData =
  | MuseumObjectData
  | SiteData
  | IncidentData
  | SpecimenData
  | ArchitecturalElementData
  | EnvironmentalSampleData
  | ConservationRecordData;

// ── Table row interfaces ─────────────────────────────────────────────────────

export interface Institution {
  id: string;
  name: string;
  institution_type: string | null;
  address: string | null;
  contact_info: string | null; // JSON
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  institution_id: string | null;
  name: string;
  site_type: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export type ObjectStatus = 'draft' | 'active' | 'archived' | 'under_review';

export type MediaFileType = 'image' | 'video' | 'audio' | 'document' | '3d_scan';

export interface RegisterObject {
  id: string;
  institution_id: string | null;
  site_id: string | null;
  object_type: ObjectType;
  status: ObjectStatus;
  title: string;
  description: string | null;
  inventory_number: string | null;
  // Geospatial
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  coordinate_accuracy: number | null;
  coordinate_source: string | null;
  // Evidence
  evidence_class: EvidenceClass | null;
  legal_hold: number; // 0 or 1
  privacy_tier: PrivacyTier;
  // Temporal
  event_start: string | null;
  event_end: string | null;
  // Type-specific
  type_specific_data: string | null; // JSON
  created_at: string;
  updated_at: string;
}

export interface Media {
  id: string;
  object_id: string | null;
  file_path: string;
  file_name: string;
  file_type: MediaFileType;
  mime_type: string;
  file_size: number | null;
  sha256_hash: string | null;
  caption: string | null;
  privacy_tier: PrivacyTier;
  is_primary: number; // 0 or 1
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Copyright / licensing (added v1.3)
  rights_holder?: string | null;
  license_type?: LicenseType | null;
  license_uri?: string | null;
  usage_restrictions?: string | null;
}

export interface Annotation {
  id: string;
  object_id: string | null;
  user_id: string | null;
  annotation_type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface VocabularyTerm {
  id: string;
  authority: string;
  term_id: string;
  label: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  institution_id: string | null;
  name: string;
  collection_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectCollection {
  id: string;
  object_id: string;
  collection_id: string;
  added_at: string;
  added_by: string | null;
  notes: string | null;
  display_order: number;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface Location {
  id: string;
  site_id: string | null;
  name: string;
  location_type: string | null;
  parent_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegisterDocument {
  id: string;
  object_id: string | null;
  title: string;
  file_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  sha256_hash: string | null;
  document_type: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Transcription (added v1.3)
  transcription?: string | null;
  transcription_status?: TranscriptionStatus;
}

export interface User {
  id: string;
  email: string | null;
  display_name: string;
  role: string;
  institution_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  institution_id: string | null;
  name: string;
  sort_name: string | null;
  birth_year: number | null;
  death_year: number | null;
  nationality: string | null;
  ulan_uri: string | null;
  gnd_uri: string | null;
  biography: string | null;
  person_type: PersonType;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced' | 'error' | 'conflict';
}

export interface ObjectPerson {
  id: string;
  object_id: string;
  person_id: string;
  role: PersonRole;
  display_order: number;
  notes: string | null;
  created_at: string;
}

export interface AuditTrailEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  user_id: string | null;
  old_values: string | null;  // JSON
  new_values: string | null;  // JSON
  device_info: string | null; // JSON
  evidence_context: string | null; // JSON
  created_at: string;
}

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  action: SyncAction;
  payload: string | null; // JSON
  status: SyncStatus;
  retry_count: number;
  created_at: string;
  updated_at: string;
}
