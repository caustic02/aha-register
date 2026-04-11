import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import type { RegisterObject, Media, PersonRole } from '../db/types';
import type { ExportConfig, ExportSections, ExportFields } from '../hooks/useExportConfig';
import type { ColorPalette } from '../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExportPerson {
  name: string;
  role: PersonRole | string;
  birth_year: number | null;
  death_year: number | null;
}

export interface ExportableObject {
  object: RegisterObject;
  media: Media[];
  persons: ExportPerson[];
}

// ── Privacy helpers ───────────────────────────────────────────────────────────

function stripAnonymous(data: ExportableObject): ExportableObject {
  if (data.object.privacy_tier !== 'anonymous') return data;
  return {
    object: {
      ...data.object,
      latitude: null,
      longitude: null,
      altitude: null,
      coordinate_accuracy: null,
      coordinate_source: null,
    },
    media: data.media,
    persons: [],
  };
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatIso(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ');
}

// ── Export: JSON ──────────────────────────────────────────────────────────────

export function exportAsJSON(data: ExportableObject): string {
  const safe = stripAnonymous(data);
  const obj = safe.object;

  const mediaExport = safe.media.map((m) => ({
    fileName: m.file_name,
    fileType: m.file_type,
    mimeType: m.mime_type,
    fileSize: m.file_size,
    sha256Hash: m.sha256_hash,
    caption: m.caption,
    privacyTier: m.privacy_tier,
    isPrimary: m.is_primary === 1,
    createdAt: m.created_at,
  }));

  const personsExport = safe.persons.map((p) => ({
    name: p.name,
    role: p.role,
    birthYear: p.birth_year,
    deathYear: p.death_year,
  }));

  const record = {
    title: obj.title,
    objectType: obj.object_type,
    status: obj.status,
    description: obj.description,
    inventoryNumber: obj.inventory_number,
    latitude: obj.latitude,
    longitude: obj.longitude,
    altitude: obj.altitude,
    coordinateAccuracy: obj.coordinate_accuracy,
    coordinateSource: obj.coordinate_source,
    evidenceClass: obj.evidence_class,
    legalHold: obj.legal_hold === 1,
    privacyTier: obj.privacy_tier,
    eventStart: obj.event_start,
    eventEnd: obj.event_end,
    typeSpecificData: obj.type_specific_data
      ? JSON.parse(obj.type_specific_data)
      : null,
    createdAt: obj.created_at,
    updatedAt: obj.updated_at,
    media: mediaExport,
    persons: personsExport,
    _export: {
      exportDate: new Date().toISOString(),
      exportFormat: 'json',
      appVersion: '0.1.0',
      platform: Platform.OS,
    },
  };

  return JSON.stringify(record, null, 2);
}

// ── Export: CSV ───────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'title',
  'objectType',
  'status',
  'description',
  'inventoryNumber',
  'latitude',
  'longitude',
  'coordinateSource',
  'evidenceClass',
  'legalHold',
  'privacyTier',
  'eventStart',
  'eventEnd',
  'createdAt',
  'updatedAt',
  'persons',
  'mediaCount',
  'primaryImageFilename',
  'sha256Hash',
];

export function exportAsCSV(data: ExportableObject): string {
  const safe = stripAnonymous(data);
  const obj = safe.object;

  const personsStr = safe.persons
    .map((p) => `${p.role}: ${p.name}`)
    .join('; ');

  const primaryMedia =
    safe.media.find((m) => m.is_primary === 1) ?? safe.media[0];

  const values: string[] = [
    obj.title,
    obj.object_type,
    obj.status,
    obj.description ?? '',
    obj.inventory_number ?? '',
    obj.latitude != null ? String(obj.latitude) : '',
    obj.longitude != null ? String(obj.longitude) : '',
    obj.coordinate_source ?? '',
    obj.evidence_class ?? '',
    obj.legal_hold === 1 ? 'true' : 'false',
    obj.privacy_tier,
    obj.event_start ?? '',
    obj.event_end ?? '',
    obj.created_at,
    obj.updated_at,
    personsStr,
    String(safe.media.length),
    primaryMedia?.file_name ?? '',
    primaryMedia?.sha256_hash ?? '',
  ];

  const header = CSV_HEADERS.map(csvEscape).join(',');
  const row = values.map(csvEscape).join(',');
  return `${header}\n${row}\n`;
}

// ── Export: PDF ───────────────────────────────────────────────────────────────
//
// Professional A4 object data sheet. The layout adapts to the ExportConfig
// template tier (quick / standard / detailed). When called without config
// the standard template is used as default.

const VIEW_LABELS: Record<string, string> = {
  front: 'Front',
  back: 'Back',
  top: 'Top',
  bottom: 'Bottom',
  left_side: 'Left side',
  right_side: 'Right side',
  detail: 'Detail',
  detail_signature: 'Signature / mark',
  detail_damage: 'Condition detail',
  detail_label: 'Label / tag',
  overall: 'Overall / in situ',
  interior: 'Interior',
  document_scan: 'Document scan',
};

function buildPdfCSS(colors: ColorPalette): string {
  return `
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4;margin:20mm 18mm 22mm 18mm}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10pt;color:${colors.text};line-height:1.45;background:#fff}

  /* ── Header band ── */
  .hdr{display:flex;flex-direction:row;justify-content:space-between;align-items:flex-start;padding-bottom:10pt;border-bottom:2pt solid ${colors.primary};margin-bottom:14pt}
  .hdr-left{flex:1}
  .hdr-inst{font-size:9pt;color:${colors.primary};font-weight:600;letter-spacing:.3pt;text-transform:uppercase}
  .hdr-title{font-size:16pt;font-weight:700;color:${colors.text};margin-top:4pt;line-height:1.2}
  .hdr-accn{font-size:9pt;color:${colors.textSecondary};margin-top:2pt;font-family:'Courier New',monospace}
  .hdr-right{text-align:right;font-size:8pt;color:${colors.textSecondary};white-space:nowrap;padding-top:2pt}

  /* ── Images ── */
  .img-row{display:flex;flex-direction:row;gap:8pt;margin-bottom:14pt}
  .img-primary{flex:0 0 42%}
  .img-secondary{flex:1;display:flex;flex-direction:column;gap:6pt}
  .img-box{position:relative;border:.5pt solid ${colors.border};border-radius:3pt;overflow:hidden;background:${colors.surface}}
  .img-box img{width:100%;display:block;object-fit:contain}
  .img-box.primary img{max-height:240pt}
  .img-box.thumb img{max-height:110pt}
  .img-lbl{font-size:8pt;font-style:italic;color:${colors.textSecondary};text-align:center;padding:3pt 4pt;background:${colors.surface}}
  .img-full-row{display:flex;flex-wrap:wrap;gap:8pt;margin-bottom:14pt}
  .img-grid-item{width:23%;border:.5pt solid ${colors.border};border-radius:3pt;overflow:hidden}
  .img-grid-item img{width:100%;height:120pt;object-fit:contain;display:block;background:${colors.surface}}
  .img-center{text-align:center;margin-bottom:14pt}
  .img-center img{max-width:65%;max-height:300pt;object-fit:contain;border:.5pt solid ${colors.border};border-radius:3pt}

  /* ── Sections ── */
  .section{margin-bottom:12pt}
  h2{font-size:11pt;font-weight:700;color:${colors.text};text-transform:uppercase;letter-spacing:.6pt;border-bottom:.75pt solid ${colors.border};padding-bottom:3pt;margin-bottom:6pt}
  table{width:100%;border-collapse:collapse;font-size:10pt}
  td{padding:3pt 6pt;vertical-align:top;border-bottom:.4pt solid #eee}
  td.lbl{width:130pt;font-size:9pt;font-weight:600;color:${colors.textSecondary}}
  td.val{color:${colors.text}}
  td.val.empty{color:#999;font-style:italic}
  .ai-badge{display:inline-block;font-size:7pt;font-weight:600;color:${colors.ai};background:${colors.aiLight};border-radius:3pt;padding:1pt 4pt;margin-left:4pt;vertical-align:middle}

  /* ── Two-column layout ── */
  .cols{display:flex;flex-direction:row;gap:16pt}
  .cols .col{flex:1}

  /* ── Description ── */
  .desc{font-size:10pt;color:${colors.text};white-space:pre-wrap;line-height:1.5;margin-bottom:4pt}

  /* ── Footer ── */
  .footer{display:flex;flex-direction:row;justify-content:space-between;align-items:baseline;margin-top:16pt;padding-top:8pt;border-top:.75pt solid ${colors.border};font-size:7pt;color:${colors.textTertiary}}
  .footer-center{text-align:center;flex:1}
  .footer code{font-family:'Courier New',monospace;font-size:6.5pt;word-break:break-all}

  /* ── Page break utility ── */
  .page-break{page-break-before:always;margin-top:0}
`;
}

// ── Image loading helper ────────────────────────────────────────────────────

interface ImageData {
  base64: string;
  mime: string;
  viewType: string | null;
  id: string;
}

const MAX_PDF_IMAGE_PX = 1200;
const PDF_IMAGE_QUALITY = 0.7;

async function loadImageBase64(media: Media): Promise<ImageData | null> {
  try {
    const sourceUri = media.preview_uri ?? media.file_path;
    const file = new File(sourceUri);
    if (!file.exists) return null;

    // Resize to max 1200px wide and compress for PDF embedding.
    // Prefer the preview tier (800px) as source — closer to target size.
    const resized = await manipulateAsync(
      sourceUri,
      [{ resize: { width: MAX_PDF_IMAGE_PX } }],
      { compress: PDF_IMAGE_QUALITY, format: SaveFormat.JPEG },
    );
    const resizedFile = new File(resized.uri);
    const base64 = await resizedFile.base64();
    return {
      base64,
      mime: 'image/jpeg',
      viewType: media.view_type ?? null,
      id: media.id,
    };
  } catch {
    return null;
  }
}

function imgTag(img: ImageData, alt: string): string {
  return `<img src="data:${img.mime};base64,${img.base64}" alt="${escapeHtml(alt)}" />`;
}

function viewLabel(viewType: string | null): string {
  if (!viewType) return '';
  return VIEW_LABELS[viewType] ?? viewType.replace(/_/g, ' ');
}

// ── Dimension formatter ─────────────────────────────────────────────────────

function formatDimensions(tsd: Record<string, unknown>): string | null {
  const dims = tsd.dimensions as
    | { height?: number; width?: number; depth?: number; unit?: string }
    | undefined;
  if (!dims) return null;
  const unit = dims.unit ?? 'cm';
  const parts: string[] = [];
  if (dims.height != null) parts.push(`H ${dims.height}`);
  if (dims.width != null) parts.push(`W ${dims.width}`);
  if (dims.depth != null) parts.push(`D ${dims.depth}`);
  if (parts.length === 0) return null;
  return `${parts.join(' \u00d7 ')} ${unit}`;
}

// ── Table row builder ───────────────────────────────────────────────────────

function _row(label: string, value: string | null | undefined, aiBadge?: boolean): string {
  if (value == null || value.trim().length === 0) return '';
  const badge = aiBadge ? '<span class="ai-badge">AI</span>' : '';
  return `<tr><td class="lbl">${escapeHtml(label)}</td><td class="val">${escapeHtml(value)}${badge}</td></tr>`;
}

// ── Field-level helpers (for toggle-aware sections) ─────────────────────────

/** Extract a string (or join an array) from type_specific_data. */
function tsdStr(tsd: Record<string, unknown>, key: string): string | null {
  const v = tsd[key];
  if (typeof v === 'string' && v.trim().length > 0) return v;
  if (Array.isArray(v)) {
    const joined = (v as string[]).filter(Boolean).join(', ');
    return joined.length > 0 ? joined : null;
  }
  return null;
}

/** Like row(), but shows "Not recorded" for null/empty values. */
function fieldRow(
  label: string,
  value: string | null | undefined,
  aiBadge?: boolean,
): string {
  if (value == null || value.trim().length === 0) {
    return `<tr><td class="lbl">${escapeHtml(label)}</td><td class="val empty">Not recorded</td></tr>`;
  }
  const badge = aiBadge ? '<span class="ai-badge">AI</span>' : '';
  return `<tr><td class="lbl">${escapeHtml(label)}</td><td class="val">${escapeHtml(value)}${badge}</td></tr>`;
}

interface FieldDef {
  id: string;
  label: string;
  value: string | null;
  ai?: boolean;
}

/** Build a section from field definitions, respecting per-field toggles. */
function buildSectionHtml(
  categoryId: string,
  sectionLabel: string,
  fieldDefs: FieldDef[],
  sections: ExportSections,
  fields: ExportFields,
  showAi: boolean,
): string {
  if (!sections[categoryId]) return '';
  const visible = fieldDefs.filter((f) => fields[f.id] !== false);
  if (visible.length === 0) return '';
  const rows = visible.map((f) =>
    fieldRow(f.label, f.value, showAi && f.ai),
  );
  return `<div class="section"><h2>${escapeHtml(sectionLabel)}</h2><table>${rows.join('')}</table></div>`;
}

// ── Main PDF export ─────────────────────────────────────────────────────────

export async function exportAsPDF(
  data: ExportableObject,
  config: ExportConfig | undefined,
  colors: ColorPalette,
): Promise<string> {
  const safe = stripAnonymous(data);
  const obj = safe.object;
  const now = new Date().toISOString().slice(0, 10);
  const template = config?.template ?? 'standard';
  const sections = config?.sections ?? {
    identification: true,
    physical: true,
    classification: true,
    condition: false,
    provenance: false,
    documents: false,
  };
  const showAiBadges = config?.showAiBadges ?? false;

  // ── Parse type-specific data ──────────────────────────────────────────────

  let tsd: Record<string, unknown> = {};
  if (obj.type_specific_data) {
    try {
      tsd = JSON.parse(obj.type_specific_data) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }

  // ── Select and load images ────────────────────────────────────────────────

  const selectedIds = config?.selectedImageIds;
  const useIsolated = config?.useIsolated ?? true;

  // Resolve which media records to include
  let selectedMedia: Media[];
  if (selectedIds && selectedIds.length > 0) {
    selectedMedia = selectedIds
      .map((id) => safe.media.find((m) => m.id === id))
      .filter((m): m is Media => m != null);
  } else {
    // Fallback: primary or first
    const pm = safe.media.find((m) => m.is_primary === 1) ?? safe.media[0];
    selectedMedia = pm ? [pm] : [];
  }

  // If useIsolated, prefer derivative_isolated versions
  if (useIsolated) {
    selectedMedia = selectedMedia.map((m) => {
      const isolated = safe.media.find(
        (d) =>
          d.parent_media_id === m.id &&
          d.media_type === 'derivative_isolated',
      );
      return isolated ?? m;
    });
  }

  // Load images
  const images: ImageData[] = [];
  for (const m of selectedMedia) {
    const img = await loadImageBase64(m);
    if (img) {
      // Use the original's view_type if this is a derivative
      const original = m.parent_media_id
        ? safe.media.find((o) => o.id === m.parent_media_id)
        : m;
      img.viewType = original?.view_type ?? m.view_type ?? null;
      images.push(img);
    }
  }

  // Primary image SHA for footer
  const primaryOriginal =
    safe.media.find((m) => m.is_primary === 1) ?? safe.media[0];
  const primaryHash = primaryOriginal?.sha256_hash ?? null;

  // ── Build HTML sections ───────────────────────────────────────────────────

  const typeLabel = obj.object_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Header
  const headerHtml = `
    <div class="hdr">
      <div class="hdr-left">
        <div class="hdr-inst">aha! Register</div>
        <div class="hdr-title">${escapeHtml(obj.title)}</div>
        ${obj.inventory_number ? `<div class="hdr-accn">${escapeHtml(obj.inventory_number)}</div>` : ''}
      </div>
      <div class="hdr-right">${now}</div>
    </div>`;

  // Images layout varies by template
  let imagesHtml = '';
  if (template === 'quick' && images.length > 0) {
    // Single centered image
    imagesHtml = `
      <div class="img-center">
        ${imgTag(images[0], obj.title)}
        ${images[0].viewType ? `<div class="img-lbl">${viewLabel(images[0].viewType)}</div>` : ''}
      </div>`;
  } else if (images.length > 0) {
    // Standard/detailed: primary + thumbnails
    const [primary, ...rest] = images;
    if (rest.length === 0) {
      imagesHtml = `
        <div class="img-row">
          <div class="img-primary">
            <div class="img-box primary">${imgTag(primary, obj.title)}</div>
            ${primary.viewType ? `<div class="img-lbl">${viewLabel(primary.viewType)}</div>` : ''}
          </div>
        </div>`;
    } else {
      const thumbsHtml = rest
        .slice(0, 3)
        .map(
          (img) =>
            `<div class="img-box thumb">${imgTag(img, viewLabel(img.viewType))}</div>
             <div class="img-lbl">${viewLabel(img.viewType) || '—'}</div>`,
        )
        .join('');
      imagesHtml = `
        <div class="img-row">
          <div class="img-primary">
            <div class="img-box primary">${imgTag(primary, obj.title)}</div>
            ${primary.viewType ? `<div class="img-lbl">${viewLabel(primary.viewType)}</div>` : ''}
          </div>
          <div class="img-secondary">${thumbsHtml}</div>
        </div>`;
    }
  }

  // ── Metadata columns (toggle-aware) ─────────────────────────────────────

  const ai = showAiBadges;
  const fields = config?.fields ?? {};

  // Parse device metadata from type_specific_data
  const deviceData =
    tsd.device != null && typeof tsd.device === 'object'
      ? (tsd.device as Record<string, string>)
      : null;
  const deviceLabel = deviceData
    ? [deviceData.manufacturer, deviceData.model].filter(Boolean).join(' ')
    : null;

  // Media counts for Media section
  const totalPhotos = safe.media.filter(
    (m) => m.file_type === 'image' && (!m.media_type || m.media_type === 'original'),
  ).length;
  const isolatedCount = safe.media.filter(
    (m) => m.media_type === 'derivative_isolated',
  ).length;
  const docScanCount = safe.media.filter(
    (m) => m.media_type === 'document_scan',
  ).length;
  const totalFileSize = safe.media.reduce(
    (sum, m) => sum + (m.file_size ?? 0),
    0,
  );
  const fileSizeStr =
    totalFileSize > 0
      ? totalFileSize > 1_000_000
        ? `${(totalFileSize / 1_000_000).toFixed(1)} MB`
        : `${(totalFileSize / 1_000).toFixed(0)} KB`
      : null;

  // ── Field definitions per category ─────────────────────────────────────

  const identificationFields: FieldDef[] = [
    { id: 'title', label: 'Title', value: obj.title },
    { id: 'object_type', label: 'Object type', value: typeLabel },
    { id: 'inventory_number', label: 'Inventory number', value: obj.inventory_number },
    { id: 'accession_number', label: 'Accession number', value: tsdStr(tsd, 'accessionNumber') },
    { id: 'date_period', label: 'Date / Period', value: obj.event_start
        ? [obj.event_start, obj.event_end].filter(Boolean).join(' \u2013 ')
        : tsdStr(tsd, 'dateCreated'),
      ai: !obj.event_start && tsdStr(tsd, 'dateCreated') != null,
    },
    { id: 'creator', label: 'Creator / Artist', value: safe.persons.length > 0 ? safe.persons.map((p) => p.name).join('; ') : null },
    { id: 'artist_attribution', label: 'Attribution', value: tsdStr(tsd, 'artistAttribution'), ai: true },
    { id: 'alt_titles', label: 'Alternative titles', value: tsdStr(tsd, 'altTitles') },
    { id: 'place_of_origin', label: 'Place of origin', value: tsdStr(tsd, 'placeOfOrigin') ?? tsdStr(tsd, 'cultureOrigin'), ai: true },
    { id: 'description', label: 'Description', value: obj.description },
  ];

  const physicalFields: FieldDef[] = [
    { id: 'materials', label: 'Medium / Materials', value: tsdStr(tsd, 'medium') ?? tsdStr(tsd, 'material'), ai: true },
    { id: 'technique', label: 'Technique', value: tsdStr(tsd, 'technique'), ai: true },
    { id: 'dimensions', label: 'Dimensions', value: formatDimensions(tsd) ?? tsdStr(tsd, 'dimensions') },
    { id: 'weight', label: 'Weight', value: tsdStr(tsd, 'weight') },
    { id: 'inscriptions', label: 'Inscriptions / Markings', value: tsdStr(tsd, 'inscriptions') ?? tsdStr(tsd, 'inscription') },
    { id: 'color_notes', label: 'Colour notes', value: tsdStr(tsd, 'colorNotes') },
    { id: 'parts_count', label: 'Parts count', value: tsdStr(tsd, 'partsCount') },
    { id: 'fragility', label: 'Fragility', value: tsdStr(tsd, 'fragility') },
  ];

  const classificationFields: FieldDef[] = [
    { id: 'aat_terms', label: 'Getty AAT terms', value: tsdStr(tsd, 'aatTerms') ?? tsdStr(tsd, 'classification') },
    { id: 'style_period', label: 'Style / Period', value: tsdStr(tsd, 'stylePeriod') ?? tsdStr(tsd, 'period'), ai: true },
    { id: 'subject_matter', label: 'Subject matter', value: tsdStr(tsd, 'subjectMatter') },
    { id: 'cultural_context', label: 'Cultural context', value: tsdStr(tsd, 'cultureOrigin') ?? tsdStr(tsd, 'culture'), ai: true },
    { id: 'domain_specialization', label: 'Domain specialisation', value: tsdStr(tsd, 'domainSpecialization') },
  ];

  const conditionFields: FieldDef[] = [
    { id: 'condition_summary', label: 'Condition summary', value: tsdStr(tsd, 'condition'), ai: true },
    { id: 'condition_rating', label: 'Condition rating', value: tsdStr(tsd, 'conditionRating') },
    { id: 'condition_date', label: 'Date assessed', value: tsdStr(tsd, 'conditionDate') },
    { id: 'damage_notes', label: 'Damage notes', value: tsdStr(tsd, 'damageNotes') },
    { id: 'conservation_history', label: 'Conservation history', value: tsdStr(tsd, 'conservationHistory') },
    { id: 'handling_requirements', label: 'Handling requirements', value: tsdStr(tsd, 'handlingRequirements') },
    { id: 'environmental_sensitivity', label: 'Environmental sensitivity', value: tsdStr(tsd, 'environmentalSensitivity') },
  ];

  const provenanceFields: FieldDef[] = [
    { id: 'ownership_history', label: 'Ownership history', value: tsdStr(tsd, 'provenance') ?? tsdStr(tsd, 'ownershipHistory') ?? tsdStr(tsd, 'provenance_narrative') },
    { id: 'acquisition_method', label: 'Acquisition method', value: tsdStr(tsd, 'acquisitionMethod') ?? tsdStr(tsd, 'acquisition_type') },
    { id: 'acquisition_date', label: 'Acquisition date', value: tsdStr(tsd, 'acquisitionDate') },
    { id: 'source_donor', label: 'Source / Donor', value: tsdStr(tsd, 'sourceDonor') },
    { id: 'credit_line', label: 'Credit line', value: tsdStr(tsd, 'creditLine') },
    { id: 'legal_status', label: 'Legal status', value: tsdStr(tsd, 'legalStatus') },
    { id: 'export_restrictions', label: 'Export restrictions', value: tsdStr(tsd, 'exportRestrictions') },
    { id: 'deaccession_status', label: 'Deaccession status', value: tsdStr(tsd, 'deaccessionStatus') },
  ];

  const locationFields: FieldDef[] = [
    { id: 'current_location', label: 'Current location', value: tsdStr(tsd, 'currentLocation') ?? tsdStr(tsd, 'storage_location') },
    { id: 'building_room_shelf', label: 'Building / Room / Shelf', value: tsdStr(tsd, 'buildingRoomShelf') },
    { id: 'storage_requirements', label: 'Storage requirements', value: tsdStr(tsd, 'storageRequirements') },
    { id: 'climate_requirements', label: 'Climate requirements', value: tsdStr(tsd, 'climateRequirements') },
  ];

  const captureFields: FieldDef[] = [
    { id: 'sha256_hash', label: 'SHA-256 hash', value: primaryHash },
    { id: 'gps_coordinates', label: 'GPS coordinates', value: obj.latitude != null && obj.longitude != null
        ? `${obj.latitude.toFixed(6)}, ${obj.longitude.toFixed(6)}`
        : null },
    { id: 'capture_timestamp', label: 'Capture timestamp', value: formatIso(obj.created_at) },
    { id: 'device_info', label: 'Device info', value: deviceLabel },
    { id: 'coordinate_source', label: 'Coordinate source', value: obj.coordinate_source },
    { id: 'evidence_class', label: 'Evidence classification', value: obj.evidence_class },
    { id: 'privacy_tier', label: 'Privacy tier', value: obj.privacy_tier },
  ];

  const mediaFields: FieldDef[] = [
    { id: 'primary_photo', label: 'Primary photo', value: primaryOriginal?.file_name ?? null },
    { id: 'all_photos', label: 'All photos', value: totalPhotos > 0 ? `${totalPhotos} image${totalPhotos > 1 ? 's' : ''}${fileSizeStr ? ` (${fileSizeStr})` : ''}` : null },
    { id: 'isolated_images', label: 'Background-removed images', value: isolatedCount > 0 ? `${isolatedCount}` : null },
    { id: 'document_scans', label: 'Document scans', value: docScanCount > 0 ? `${docScanCount}` : null },
  ];

  const valuationFields: FieldDef[] = [
    { id: 'insurance_value', label: 'Insurance value', value: tsdStr(tsd, 'insuranceValue') ?? tsdStr(tsd, 'insurance_value') },
    { id: 'appraisal_date', label: 'Appraisal date', value: tsdStr(tsd, 'appraisalDate') },
    { id: 'fair_market_value', label: 'Fair market value', value: tsdStr(tsd, 'fairMarketValue') },
    { id: 'replacement_value', label: 'Replacement value', value: tsdStr(tsd, 'replacementValue') },
  ];

  const legalFields: FieldDef[] = [
    { id: 'legal_hold', label: 'Legal hold', value: obj.legal_hold === 1 ? 'Active' : 'None' },
    { id: 'berkeley_protocol', label: 'Berkeley Protocol', value: tsdStr(tsd, 'berkeleyProtocol') },
    { id: 'restricted_access', label: 'Restricted access', value: tsdStr(tsd, 'restrictedAccess') },
  ];

  // ── Build columns ─────────────────────────────────────────────────────

  const col1 =
    buildSectionHtml('identification', 'Identification', identificationFields, sections, fields, ai)
    + buildSectionHtml('physical', 'Physical Description', physicalFields, sections, fields, ai)
    + buildSectionHtml('classification', 'Classification', classificationFields, sections, fields, ai);

  const col2 =
    buildSectionHtml('condition', 'Condition', conditionFields, sections, fields, ai)
    + buildSectionHtml('provenance', 'Provenance', provenanceFields, sections, fields, ai)
    + buildSectionHtml('location', 'Location', locationFields, sections, fields, ai)
    + buildSectionHtml('capture', 'Capture Verification', captureFields, sections, fields, ai)
    + buildSectionHtml('media', 'Media & Images', mediaFields, sections, fields, ai)
    + buildSectionHtml('valuation', 'Valuation', valuationFields, sections, fields, ai)
    + buildSectionHtml('legal', 'Legal / Compliance', legalFields, sections, fields, ai);

  // Description (full-width, below columns) — only if identification section + description field are enabled
  let descriptionHtml = '';
  if (
    sections.identification &&
    fields.description !== false &&
    obj.description &&
    obj.description.trim().length > 0 &&
    template !== 'quick'
  ) {
    descriptionHtml = `
      <div class="section">
        <h2>Description</h2>
        <p class="desc">${escapeHtml(obj.description)}</p>
      </div>`;
  }

  // Metadata layout
  let metadataHtml: string;
  if (template === 'quick') {
    metadataHtml = col1 + col2;
  } else {
    metadataHtml = `<div class="cols"><div class="col">${col1}</div><div class="col">${col2}</div></div>`;
  }

  // ── Detailed: extra pages ─────────────────────────────────────────────────

  let extraPages = '';
  if (template === 'detailed') {
    // Additional images grid (beyond the first 4)
    if (images.length > 4) {
      const gridItems = images
        .slice(4)
        .map(
          (img) =>
            `<div class="img-grid-item">${imgTag(img, viewLabel(img.viewType))}
             <div class="img-lbl">${viewLabel(img.viewType) || '—'}</div></div>`,
        )
        .join('');
      extraPages += `<div class="page-break"></div>
        <div class="section"><h2>Additional Images</h2>
        <div class="img-full-row">${gridItems}</div></div>`;
    }

    // Documents with OCR text
    if (sections.documents) {
      const docMedia = safe.media.filter(
        (m) => m.media_type === 'document_scan' && m.ocr_text,
      );
      if (docMedia.length > 0) {
        let docsHtml = '';
        for (const dm of docMedia) {
          docsHtml += `<div class="section">
            <p style="font-size:9pt;color:${colors.textSecondary};margin-bottom:4pt">${viewLabel('document_scan')}</p>
            <p class="desc">${escapeHtml(dm.ocr_text ?? '')}</p>
          </div>`;
        }
        extraPages += `<div class="section"><h2>Documents</h2>${docsHtml}</div>`;
      }
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  const footerHtml = `
    <div class="footer">
      <div>${primaryHash ? `<code>${primaryHash.slice(0, 32)}…</code>` : ''}</div>
      <div class="footer-center">Generated by <strong>aha! Register</strong></div>
      <div>${now}</div>
    </div>`;

  // ── Assemble HTML ─────────────────────────────────────────────────────────

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${buildPdfCSS(colors)}</style></head>
<body>
  ${headerHtml}
  ${imagesHtml}
  ${metadataHtml}
  ${descriptionHtml}
  ${footerHtml}
  ${extraPages}
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}
