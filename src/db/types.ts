// ── Union types ──────────────────────────────────────────────────────────────

export type ObjectType =
  | 'museum_object'
  | 'site'
  | 'incident'
  | 'specimen'
  | 'architectural_element'
  | 'environmental_sample'
  | 'conservation_record'
  | 'uncategorized';

export type PrivacyTier = 'public' | 'confidential' | 'anonymous';

export type EvidenceClass = 'primary' | 'corroborative' | 'contextual';

export type ReviewStatus = 'needs_review' | 'in_review' | 'complete';

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

export type MediaType = 'original' | 'derivative_isolated' | 'document_scan' | 'document_deskewed';

export type OcrSource = 'none' | 'on_device' | 'cloud';

export type ViewType =
  | 'front'
  | 'back'
  | 'top'
  | 'bottom'
  | 'left_side'
  | 'right_side'
  | 'detail'
  | 'detail_signature'
  | 'detail_damage'
  | 'detail_label'
  | 'overall'
  | 'interior'
  | 'document_scan'
  // Registerbogen multi-view capture types
  | 'ansicht_front'
  | 'ansicht_rechts'
  | 'ansicht_links'
  | 'ansicht_hinten'
  | 'aufsicht'
  | 'untersicht';

/** Registerbogen 6-view subset used in guided multi-view capture */
export type RegisterViewType =
  | 'ansicht_front'
  | 'ansicht_rechts'
  | 'ansicht_links'
  | 'ansicht_hinten'
  | 'aufsicht'
  | 'untersicht'
  | 'detail';

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
  settings: string | null; // JSON
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
  // Review workflow
  review_status: ReviewStatus;
  // Capture protocol tracking
  protocol_id?: string | null;
  protocol_complete?: number;
  shots_completed?: string;
  shots_remaining?: string;
  // Location tagging
  location_building?: string | null;
  location_floor?: string | null;
  location_room?: string | null;
  location_shelf?: string | null;
  location_notes?: string | null;
  // Registerbogen fields (companion app parity)
  mediaId?: string | null;
  alte_inventarnummer?: string | null;
  klassifikation?: string | null;
  material?: string | null;
  technik?: string | null;
  masse_hoehe?: string | null;
  masse_breite?: string | null;
  masse_tiefe?: string | null;
  masse_einheit?: string | null;
  gewicht?: string | null;
  gewicht_einheit?: string | null;
  inschriften?: string | null;
  markierungen?: string | null;
  schlagworte?: string | null;
  erhaltungszustand?: string | null;
  zustandsbeschreibung?: string | null;
  letzter_zustandsbericht?: string | null;
  restaurierungsbedarf?: string | null;
  erwerbungsart?: string | null;
  erwerbungsdatum?: string | null;
  veraeusserer?: string | null;
  provenienzangaben?: string | null;
  belastete_provenienz?: number;
  belastete_provenienz_notizen?: string | null;
  erwerbungspreis?: string | null;
  erwerbungspreis_waehrung?: string | null;
  standort_gebaeude?: string | null;
  standort_etage?: string | null;
  standort_raum?: string | null;
  standort_regal?: string | null;
  standort_hinweise?: string | null;
  aktueller_status?: string | null;
  versicherungswert?: string | null;
  versicherungswert_waehrung?: string | null;
  versicherungspolice?: string | null;
  leihgabe?: number;
  leihgabe_nehmer?: string | null;
  leihgabe_von?: string | null;
  leihgabe_bis?: string | null;
  ausfuhrgenehmigung?: number;
  ausfuhrgenehmigung_referenz?: string | null;
  datensatz_sprache?: string | null;
  verwahrende_einrichtung?: string | null;
  nutzungsrechte_metadaten?: string | null;
  durchmesser?: string | null;
  durchmesser_einheit?: string | null;
  format?: string | null;
  condition_status?: string | null;
  condition_note?: string | null;
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
  // Derivative tracking (B1 object isolation)
  parent_media_id?: string | null;
  media_type?: MediaType;
  // OCR (C1 document scanning)
  ocr_text?: string | null;
  ocr_confidence?: number | null;
  ocr_source?: OcrSource;
  // View inventory (D1)
  view_type?: ViewType | null;
  // Per-view dimensions and notes (Registerbogen multi-view)
  view_dimensions?: string | null;
  view_notes?: string | null;
  // Supabase Storage path for cloud-synced photos
  storage_path?: string | null;
  // Capture protocol shot tracking
  shot_type?: string | null;
  protocol_id?: string | null;
  shot_order?: number | null;
  // Copyright / licensing (added v1.3)
  rights_holder?: string | null;
  license_type?: LicenseType | null;
  license_uri?: string | null;
  usage_restrictions?: string | null;
  // Companion app parity
  alt_text?: string | null;
  // Original file tracking (Supabase parity)
  original_file_path?: string | null;
  original_mime_type?: string | null;
  original_file_size?: number | null;
  // Four-tier image pipeline
  thumbnail_uri?: string | null;
  preview_uri?: string | null;
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

export interface ObjectTask {
  id: string;
  object_id: string;
  title: string;
  completed: number; // 0 or 1
  sort_order: number;
  created_at: string;
  completed_at: string | null;
}

export interface FloorMap {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  image_uri: string;
  image_width: number | null;
  image_height: number | null;
  created_at: string;
  updated_at: string;
}

export interface MapPin {
  id: string;
  floor_map_id: string;
  object_id: string | null;
  x_percent: number;
  y_percent: number;
  label: string | null;
  created_at: string;
}

export interface CaptureProtocolRow {
  id: string;
  name: string;
  name_de: string | null;
  description: string | null;
  description_de: string | null;
  version: string;
  domain: string;
  object_types: string; // JSON array
  shots: string; // JSON array
  completion_rules: string; // JSON
  is_active: number; // 0 or 1
  created_at: string;
  updated_at: string;
}
