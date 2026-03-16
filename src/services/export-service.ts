import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import type { RegisterObject, Media, PersonRole } from '../db/types';
import { colors } from '../theme';

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

const PDF_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 24pt; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11pt;
    color: ${colors.text};
    line-height: 1.5;
    background: ${colors.background};
  }
  .header {
    text-align: center;
    padding: 24pt 0 16pt;
    border-bottom: 2pt solid ${colors.primary};
    margin-bottom: 16pt;
  }
  .header .brand {
    font-size: 18pt;
    font-weight: 700;
    font-style: italic;
    color: ${colors.primary};
  }
  .header .title {
    font-size: 16pt;
    font-weight: 600;
    color: ${colors.text};
    margin-top: 6pt;
  }
  .header .meta {
    font-size: 9pt;
    color: ${colors.textSecondary};
    margin-top: 4pt;
  }
  .section { margin-bottom: 16pt; }
  h2 {
    font-size: 12pt;
    font-weight: 600;
    color: ${colors.primary};
    border-bottom: 1pt solid ${colors.border};
    padding-bottom: 4pt;
    margin-bottom: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; font-size: 10pt; }
  td {
    padding: 5pt 8pt;
    border-bottom: 0.5pt solid ${colors.border};
    vertical-align: top;
  }
  td:first-child {
    width: 140pt;
    color: ${colors.textSecondary};
    font-weight: 500;
  }
  .primary-img {
    text-align: center;
    margin-bottom: 12pt;
  }
  .primary-img img {
    max-width: 100%;
    max-height: 300pt;
    object-fit: contain;
    border-radius: 4pt;
  }
  .description {
    font-size: 10pt;
    color: ${colors.text};
    white-space: pre-wrap;
  }
  code {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    word-break: break-all;
  }
  .footer {
    margin-top: 20pt;
    padding-top: 10pt;
    border-top: 1pt solid ${colors.border};
    font-size: 9pt;
    color: ${colors.textSecondary};
    text-align: center;
  }
  .footer .tagline { font-style: italic; margin-top: 3pt; }
`;

export async function exportAsPDF(
  data: ExportableObject,
): Promise<string> {
  const safe = stripAnonymous(data);
  const obj = safe.object;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Read primary image as base64
  const primaryMedia =
    safe.media.find((m) => m.is_primary === 1) ?? safe.media[0];
  let imageHtml = '';
  if (primaryMedia) {
    try {
      const file = new File(primaryMedia.file_path);
      const base64 = await file.base64();
      imageHtml = `
        <div class="primary-img">
          <img src="data:${primaryMedia.mime_type};base64,${base64}"
               alt="${escapeHtml(primaryMedia.file_name)}" />
        </div>`;
    } catch {
      // File missing — skip image
    }
  }

  // Basic information rows
  const infoRows: string[] = [];
  const addRow = (label: string, value: string | null | undefined) => {
    if (value != null && value.trim().length > 0) {
      infoRows.push(`<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`);
    }
  };

  const typeLabel = obj.object_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  addRow('Title', obj.title);
  addRow('Object Type', typeLabel);
  addRow('Inventory Number', obj.inventory_number);
  addRow('Status', obj.status);
  addRow('Privacy Tier', obj.privacy_tier);
  addRow('Evidence Class', obj.evidence_class);
  if (obj.event_start) {
    const dateRange = [obj.event_start, obj.event_end].filter(Boolean).join(' \u2013 ');
    addRow('Date', dateRange);
  }

  // Parse type-specific data
  if (obj.type_specific_data) {
    try {
      const tsd = JSON.parse(obj.type_specific_data) as Record<string, unknown>;
      for (const [key, value] of Object.entries(tsd)) {
        if (value == null) continue;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        if (Array.isArray(value)) {
          addRow(label, value.join(', '));
        } else if (typeof value === 'object') {
          addRow(label, JSON.stringify(value));
        } else {
          addRow(label, String(value));
        }
      }
    } catch {
      // Invalid JSON — skip
    }
  }

  // Description section
  let descriptionHtml = '';
  if (obj.description && obj.description.trim().length > 0) {
    descriptionHtml = `
      <div class="section">
        <h2>Description</h2>
        <p class="description">${escapeHtml(obj.description)}</p>
      </div>`;
  }

  // Persons section
  let personsHtml = '';
  if (safe.persons.length > 0) {
    const rows = safe.persons
      .map((p) => {
        const years =
          p.birth_year != null || p.death_year != null
            ? ` (${p.birth_year ?? '?'}\u2013${p.death_year ?? '?'})`
            : '';
        return `<tr><td>${escapeHtml(p.role)}</td><td>${escapeHtml(p.name)}${escapeHtml(years)}</td></tr>`;
      })
      .join('');
    personsHtml = `
      <div class="section">
        <h2>Persons</h2>
        <table>${rows}</table>
      </div>`;
  }

  // Capture metadata section
  const captureRows: string[] = [];
  captureRows.push(
    `<tr><td>Capture Date</td><td>${formatIso(obj.created_at)}</td></tr>`,
  );
  if (obj.latitude != null && obj.longitude != null) {
    captureRows.push(
      `<tr><td>GPS Coordinates</td><td>${obj.latitude.toFixed(6)}, ${obj.longitude.toFixed(6)}</td></tr>`,
    );
    if (obj.coordinate_accuracy != null) {
      captureRows.push(
        `<tr><td>Accuracy</td><td>\u00b1${obj.coordinate_accuracy.toFixed(1)} m</td></tr>`,
      );
    }
  }
  if (obj.coordinate_source) {
    captureRows.push(
      `<tr><td>Coordinate Source</td><td>${escapeHtml(obj.coordinate_source)}</td></tr>`,
    );
  }
  captureRows.push(`<tr><td>Object UUID</td><td><code>${obj.id}</code></td></tr>`);
  if (primaryMedia?.sha256_hash) {
    captureRows.push(
      `<tr><td>SHA-256</td><td><code>${primaryMedia.sha256_hash}</code></td></tr>`,
    );
  }
  captureRows.push(
    `<tr><td>Platform</td><td>${Platform.OS}</td></tr>`,
  );

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${PDF_CSS}</style></head>
<body>
  <div class="header">
    <div class="brand">aha! Register</div>
    <div class="title">${escapeHtml(obj.title)}</div>
    <div class="meta">Exported ${now}</div>
  </div>

  ${imageHtml}

  <div class="section">
    <h2>Basic Information</h2>
    <table>${infoRows.join('')}</table>
  </div>

  ${descriptionHtml}
  ${personsHtml}

  <div class="section">
    <h2>Capture Metadata</h2>
    <table>${captureRows.join('')}</table>
  </div>

  <div class="footer">
    <p>Generated by <strong>aha! Register</strong> \u2014 Tamper-evident documentation</p>
    <p class="tagline">${now}</p>
  </div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}
