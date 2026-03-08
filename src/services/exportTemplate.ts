import type {
  AuditTrailEntry,
  Media,
  ObjectType,
  RegisterObject,
} from '../db/types';
import type { CollectionForObject } from './collectionService';

export interface MediaWithBase64 extends Media {
  base64Data: string;
}

export interface ObjectExportData {
  object: RegisterObject;
  media: MediaWithBase64[];
  auditTrail: AuditTrailEntry[];
  collections: CollectionForObject[];
  institutionName: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ');
}

function formatAuditChanges(entry: AuditTrailEntry): string {
  const parts: string[] = [];
  if (entry.new_values) {
    try {
      const vals = JSON.parse(entry.new_values);
      const keys = Object.keys(vals);
      if (keys.length <= 3) {
        parts.push(keys.join(', '));
      } else {
        parts.push(`${keys.length} fields`);
      }
    } catch {
      parts.push('data');
    }
  }
  if (entry.old_values) {
    try {
      const vals = JSON.parse(entry.old_values);
      const keys = Object.keys(vals);
      if (parts.length === 0) {
        parts.push(keys.join(', '));
      }
    } catch {
      // ignore
    }
  }
  return parts.join(' ') || '\u2014';
}

function buildImagesSection(media: MediaWithBase64[]): string {
  if (media.length === 0) return '';

  const primary = media.find((m) => m.is_primary === 1) ?? media[0];
  const others = media.filter((m) => m.id !== primary.id);

  let html = `
    <div class="section">
      <h2>Documentation Images</h2>
      <div class="primary-image">
        <img src="data:${primary.mime_type};base64,${primary.base64Data}" alt="${escapeHtml(primary.file_name)}" />
        <p class="image-caption">${escapeHtml(primary.file_name)} &mdash; SHA-256: <code>${primary.sha256_hash?.slice(0, 16) ?? 'N/A'}...</code></p>
      </div>`;

  if (others.length > 0) {
    html += '<div class="image-grid">';
    for (const m of others) {
      html += `
        <div class="grid-image">
          <img src="data:${m.mime_type};base64,${m.base64Data}" alt="${escapeHtml(m.file_name)}" />
          <p class="image-caption">${escapeHtml(m.file_name)}<br/><code>${m.sha256_hash?.slice(0, 16) ?? 'N/A'}...</code></p>
        </div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/** Field label maps for each object type, used by the export PDF. */
const TYPE_FIELD_LABELS: Record<ObjectType, Record<string, string>> = {
  museum_object: {
    material: 'Materials',
    technique: 'Technique',
    dimensions: 'Dimensions',
    period: 'Period',
    culture: 'Culture',
    provenance: 'Provenance',
    condition: 'Condition',
    inscription: 'Inscription',
  },
  site: {
    site_classification: 'Site Classification',
    period_from: 'Period From',
    period_to: 'Period To',
    survey_method: 'Survey Method',
    land_use: 'Land Use',
    threats: 'Threats',
    protection_status: 'Protection Status',
  },
  incident: {
    incident_type: 'Incident Type',
    date_reported: 'Date Reported',
    date_occurred: 'Date Occurred',
    severity: 'Severity',
    perpetrator_info: 'Perpetrator Info',
    law_enforcement_notified: 'Law Enforcement Notified',
    case_number: 'Case Number',
    recovery_status: 'Recovery Status',
  },
  specimen: {
    taxon: 'Taxon',
    specimen_type: 'Specimen Type',
    collection_method: 'Collection Method',
    preservation_method: 'Preservation Method',
    storage_requirements: 'Storage Requirements',
    genetic_data_available: 'Genetic Data Available',
  },
  architectural_element: {
    element_type: 'Element Type',
    style: 'Style',
    construction_material: 'Construction Materials',
    construction_date: 'Construction Date',
    structural_condition: 'Structural Condition',
    load_bearing: 'Load Bearing',
    restoration_history: 'Restoration History',
  },
  environmental_sample: {
    sample_type: 'Sample Type',
    collection_method: 'Collection Method',
    storage_conditions: 'Storage Conditions',
    analysis_method: 'Analysis Method',
    results: 'Results',
    contamination_level: 'Contamination Level',
    ph_level: 'pH Level',
    temperature: 'Temperature',
  },
  conservation_record: {
    treatment_type: 'Treatment Type',
    conservator: 'Conservator',
    date_started: 'Date Started',
    date_completed: 'Date Completed',
    materials_used: 'Materials Used',
    before_condition: 'Before Condition',
    after_condition: 'After Condition',
    recommendations: 'Recommendations',
    next_review_date: 'Next Review Date',
  },
};

function formatTsdValue(key: string, value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const joined = value.join(', ');
    return joined || null;
  }
  if (key === 'dimensions' && typeof value === 'object') {
    const dim = value as Record<string, unknown>;
    const parts: string[] = [];
    if (dim.height != null) parts.push(String(dim.height));
    if (dim.width != null) parts.push(String(dim.width));
    if (dim.depth != null) parts.push(String(dim.depth));
    if (parts.length === 0) return null;
    const unit = typeof dim.unit === 'string' ? ` ${dim.unit}` : '';
    return parts.join(' \u00D7 ') + unit;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string' && value.trim()) return value;
  return null;
}

function buildTypeSpecificRows(obj: RegisterObject): string {
  if (!obj.type_specific_data) return '';
  let tsd: Record<string, unknown>;
  try {
    tsd = JSON.parse(obj.type_specific_data);
  } catch {
    return '';
  }
  const labels = TYPE_FIELD_LABELS[obj.object_type];
  if (!labels) return '';

  let rows = '';
  for (const [key, label] of Object.entries(labels)) {
    const formatted = formatTsdValue(key, tsd[key]);
    if (formatted) {
      rows += `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(formatted)}</td></tr>`;
    }
  }
  return rows;
}

function buildMetadataSection(obj: RegisterObject): string {
  const objectTypeLabel = obj.object_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const typeSpecific = buildTypeSpecificRows(obj);

  return `
    <div class="section">
      <h2>Object Metadata</h2>
      <table>
        <tr><td>Title</td><td><strong>${escapeHtml(obj.title)}</strong></td></tr>
        <tr><td>Object Type</td><td>${escapeHtml(objectTypeLabel)}</td></tr>
        <tr><td>Status</td><td>${escapeHtml(obj.status)}</td></tr>
        ${obj.inventory_number ? `<tr><td>Inventory Number</td><td>${escapeHtml(obj.inventory_number)}</td></tr>` : ''}
        ${obj.description ? `<tr><td>Description</td><td>${escapeHtml(obj.description)}</td></tr>` : ''}
        ${typeSpecific}
        <tr><td>Created</td><td>${formatDate(obj.created_at)}</td></tr>
        <tr><td>Updated</td><td>${formatDate(obj.updated_at)}</td></tr>
      </table>
    </div>`;
}

function buildLocationSection(obj: RegisterObject): string {
  if (obj.latitude == null) return '';

  const mapsUrl = `https://www.google.com/maps?q=${obj.latitude},${obj.longitude}`;

  return `
    <div class="section">
      <h2>Location Data</h2>
      <table>
        <tr><td>Latitude</td><td>${obj.latitude.toFixed(6)}</td></tr>
        <tr><td>Longitude</td><td>${obj.longitude?.toFixed(6) ?? 'N/A'}</td></tr>
        ${obj.altitude != null ? `<tr><td>Altitude</td><td>${obj.altitude.toFixed(1)}m</td></tr>` : ''}
        ${obj.coordinate_source ? `<tr><td>Source</td><td>${escapeHtml(obj.coordinate_source)}</td></tr>` : ''}
        ${obj.coordinate_accuracy != null ? `<tr><td>Accuracy</td><td>\u00B1${obj.coordinate_accuracy.toFixed(1)}m</td></tr>` : ''}
        <tr><td>Map</td><td><a href="${mapsUrl}">Open in Google Maps</a></td></tr>
      </table>
    </div>`;
}

function buildEvidenceSection(obj: RegisterObject): string {
  return `
    <div class="section">
      <h2>Evidence &amp; Privacy</h2>
      <table>
        <tr><td>Privacy Tier</td><td>${escapeHtml(obj.privacy_tier)}</td></tr>
        ${obj.evidence_class ? `<tr><td>Evidence Class</td><td>${escapeHtml(obj.evidence_class)}</td></tr>` : ''}
        <tr><td>Legal Hold</td><td>${obj.legal_hold ? 'Yes' : 'No'}</td></tr>
        ${obj.event_start ? `<tr><td>Event Start</td><td>${escapeHtml(obj.event_start)}</td></tr>` : ''}
        ${obj.event_end ? `<tr><td>Event End</td><td>${escapeHtml(obj.event_end)}</td></tr>` : ''}
      </table>
    </div>`;
}

function buildCollectionsSection(collections: CollectionForObject[]): string {
  if (collections.length === 0) return '';

  const rows = collections
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.collection_type)}</td><td>${c.added_at.slice(0, 10)}</td></tr>`,
    )
    .join('');

  return `
    <div class="section">
      <h2>Collections</h2>
      <table>
        <tr class="table-header"><td>Name</td><td>Type</td><td>Added</td></tr>
        ${rows}
      </table>
    </div>`;
}

function buildAuditSection(auditTrail: AuditTrailEntry[]): string {
  if (auditTrail.length === 0) return '';

  const rows = auditTrail
    .map(
      (e) =>
        `<tr>
          <td>${formatDate(e.created_at)}</td>
          <td>${escapeHtml(e.action)}</td>
          <td>${escapeHtml(e.table_name)}</td>
          <td>${escapeHtml(e.user_id ?? 'system')}</td>
          <td>${escapeHtml(formatAuditChanges(e))}</td>
        </tr>`,
    )
    .join('');

  return `
    <div class="section page-break">
      <h2>Provenance Chain</h2>
      <table class="audit-table">
        <tr class="table-header">
          <td>Timestamp</td><td>Action</td><td>Table</td><td>User</td><td>Details</td>
        </tr>
        ${rows}
      </table>
    </div>`;
}

function buildHashesSection(
  media: MediaWithBase64[],
  objectId: string,
): string {
  const rows = media
    .map(
      (m) =>
        `<tr>
          <td>${escapeHtml(m.file_name)}</td>
          <td><code>${m.sha256_hash ?? 'N/A'}</code></td>
        </tr>`,
    )
    .join('');

  return `
    <div class="section">
      <h2>File Integrity Hashes</h2>
      <table>
        <tr class="table-header"><td>File</td><td>SHA-256</td></tr>
        ${rows}
      </table>
      <p class="hash-id">Object UUID: <code>${objectId}</code></p>
    </div>`;
}

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    line-height: 1.5;
    padding: 0;
  }
  .report-header {
    text-align: center;
    padding: 32pt 0 20pt;
    border-bottom: 2pt solid #1a1a1a;
    margin-bottom: 20pt;
  }
  .report-header h1 {
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: 1pt;
    margin-bottom: 4pt;
  }
  .report-header .subtitle {
    font-size: 13pt;
    color: #444;
    margin-bottom: 4pt;
  }
  .report-header .meta {
    font-size: 9pt;
    color: #666;
  }
  .section {
    margin-bottom: 20pt;
  }
  .page-break {
    page-break-before: always;
  }
  h2 {
    font-size: 14pt;
    font-weight: 600;
    border-bottom: 1pt solid #ccc;
    padding-bottom: 4pt;
    margin-bottom: 10pt;
    color: #222;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8pt;
    font-size: 10pt;
  }
  table td {
    padding: 5pt 8pt;
    border-bottom: 0.5pt solid #e0e0e0;
    vertical-align: top;
  }
  table td:first-child {
    width: 140pt;
    color: #555;
    font-weight: 500;
  }
  .table-header td {
    font-weight: 600;
    color: #333;
    border-bottom: 1pt solid #999;
    background: #f5f5f5;
  }
  .audit-table td:first-child { width: auto; }
  .audit-table td { font-size: 9pt; }
  code {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    word-break: break-all;
  }
  .primary-image {
    text-align: center;
    margin-bottom: 12pt;
  }
  .primary-image img {
    max-width: 100%;
    max-height: 320pt;
    object-fit: contain;
  }
  .image-caption {
    font-size: 9pt;
    color: #666;
    margin-top: 4pt;
  }
  .image-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8pt;
  }
  .grid-image {
    width: 48%;
    text-align: center;
  }
  .grid-image img {
    max-width: 100%;
    max-height: 180pt;
    object-fit: contain;
  }
  .hash-id {
    margin-top: 8pt;
    font-size: 10pt;
    color: #444;
  }
  .footer {
    margin-top: 24pt;
    padding-top: 12pt;
    border-top: 1pt solid #ccc;
    font-size: 9pt;
    color: #666;
    text-align: center;
  }
  .footer .verify {
    font-style: italic;
    margin-top: 4pt;
  }
  a { color: #0066cc; text-decoration: none; }
`;

export function buildObjectHTML(data: ObjectExportData): string {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const institution = data.institutionName
    ? escapeHtml(data.institutionName)
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  <div class="report-header">
    <h1>aha! Register</h1>
    <div class="subtitle">Object Documentation Report</div>
    <div class="meta">
      ${institution ? `${institution} &mdash; ` : ''}Generated ${now}
    </div>
  </div>

  ${buildImagesSection(data.media)}
  ${buildMetadataSection(data.object)}
  ${buildLocationSection(data.object)}
  ${buildEvidenceSection(data.object)}
  ${buildCollectionsSection(data.collections)}
  ${buildAuditSection(data.auditTrail)}
  ${buildHashesSection(data.media, data.object.id)}

  <div class="footer">
    <p>Generated by aha! Register | aharegister.com</p>
    <p class="verify">Verify integrity by comparing SHA-256 hashes with original records.</p>
  </div>
</body>
</html>`;
}

export function buildCollectionHTML(
  collectionName: string,
  objectsData: ObjectExportData[],
  institutionName: string | null,
): string {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const institution = institutionName ? escapeHtml(institutionName) : '';

  let body = `
  <div class="report-header">
    <h1>aha! Register</h1>
    <div class="subtitle">Collection Report: ${escapeHtml(collectionName)}</div>
    <div class="meta">
      ${institution ? `${institution} &mdash; ` : ''}${objectsData.length} objects &mdash; Generated ${now}
    </div>
  </div>`;

  for (let i = 0; i < objectsData.length; i++) {
    const data = objectsData[i];
    if (i > 0) {
      body += '<div class="page-break"></div>';
    }
    body += `
    <div class="section">
      <h2 style="font-size:16pt; border-bottom: 2pt solid #333;">Object ${i + 1}/${objectsData.length}: ${escapeHtml(data.object.title)}</h2>
    </div>
    ${buildImagesSection(data.media)}
    ${buildMetadataSection(data.object)}
    ${buildLocationSection(data.object)}
    ${buildEvidenceSection(data.object)}
    ${buildAuditSection(data.auditTrail)}
    ${buildHashesSection(data.media, data.object.id)}`;
  }

  body += `
  <div class="footer">
    <p>Generated by aha! Register | aharegister.com</p>
    <p class="verify">Verify integrity by comparing SHA-256 hashes with original records.</p>
  </div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${CSS}</style></head>
<body>${body}</body>
</html>`;
}
