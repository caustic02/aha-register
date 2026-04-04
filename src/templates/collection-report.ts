/**
 * aha! Register — Collection Report HTML Template
 *
 * Generates a multi-page PDF report for a collection:
 *   - Cover page
 *   - One condensed page per object
 *   - Summary table
 */

import type { ObjectExportData } from '../services/exportTemplate';
import type { ColorPalette } from '../theme';

// ── Translation function type ───────────────────────────────────────────────

type TFunc = (key: string, options?: Record<string, unknown>) => string;

// ── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function parseTypeData(tsd: string | null): Record<string, unknown> {
  if (!tsd) return {};
  try { return JSON.parse(tsd) as Record<string, unknown>; } catch { return {}; }
}

function fmtArr(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  return v.join(', ');
}

function fmtDims(v: unknown, t: TFunc): string | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const parts: string[] = [];
  if (d.height != null) parts.push(`${t('pdf.dim_height')} ${d.height}`);
  if (d.width != null) parts.push(`${t('pdf.dim_width')} ${d.width}`);
  if (d.depth != null) parts.push(`${t('pdf.dim_depth')} ${d.depth}`);
  if (parts.length === 0) return null;
  const unit = typeof d.unit === 'string' ? ` ${d.unit}` : '';
  return parts.join(' × ') + unit;
}

// ── CSS ─────────────────────────────────────────────────────────────────────

function buildCSS(C: ColorPalette): string {
  return `
@page { size: A4; margin: 18mm 20mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9.5pt;
  color: ${C.textPrimary};
  line-height: 1.45;
  background: ${C.surface};
}
code, .mono { font-family: 'Courier New', Courier, monospace; font-size: 8.5pt; word-break: break-all; }
.accent-bar { height: 8pt; background: ${C.accent}; width: 100%; margin-bottom: 14pt; }
.accent-bar-sm { height: 5pt; background: ${C.accent}; width: 100%; margin-bottom: 10pt; }
.page-break { page-break-after: always; }

/* Cover page */
.cover {
  min-height: 70vh; display: flex; flex-direction: column;
  justify-content: center; align-items: flex-start;
}
.cover-brand { display: flex; align-items: baseline; gap: 4pt; margin-bottom: 30pt; }
.brand-aha { font-style: italic; font-weight: 800; font-size: 28pt; color: ${C.accent}; }
.brand-register { font-size: 16pt; color: ${C.textSecondary}; font-weight: 400; }
.cover-badge {
  background: ${C.accent}; color: #FFFFFF;
  font-size: 8pt; font-weight: 700; letter-spacing: 1.5pt; text-transform: uppercase;
  padding: 4pt 10pt; border-radius: 3pt; margin-bottom: 18pt;
}
.cover-title { font-size: 26pt; font-weight: 800; color: ${C.textPrimary}; margin-bottom: 8pt; line-height: 1.1; }
.cover-desc { font-size: 11pt; color: ${C.textSecondary}; margin-bottom: 20pt; max-width: 400pt; line-height: 1.5; }
.cover-meta { display: flex; gap: 24pt; margin-bottom: 30pt; }
.cover-meta-item {}
.cover-meta-label { font-size: 8pt; color: ${C.textMuted}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8pt; margin-bottom: 3pt; }
.cover-meta-value { font-size: 14pt; font-weight: 700; color: ${C.textPrimary}; }
.cover-footer {
  width: 100%; padding-top: 16pt; border-top: 1pt solid ${C.border};
  display: flex; justify-content: space-between; align-items: center;
}
.cover-institution { font-size: 9.5pt; color: ${C.textSecondary}; }
.cover-url { font-size: 9pt; color: ${C.textMuted}; }

/* Object condensed card */
.obj-card {
  display: flex; gap: 14pt; margin-bottom: 14pt;
  padding-bottom: 14pt; border-bottom: 1pt solid ${C.border};
}
.obj-card-image { flex: 0 0 120pt; }
.obj-card-img { width: 120pt; height: 90pt; object-fit: contain; border: 1pt solid ${C.border}; border-radius: 6pt; background: ${C.background}; display: block; }
.obj-card-placeholder {
  width: 120pt; height: 90pt; border: 1pt solid ${C.border}; border-radius: 6pt;
  background: ${C.background}; display: flex; align-items: center; justify-content: center;
  font-size: 8pt; color: ${C.textMuted};
}
.obj-card-body { flex: 1; }
.obj-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8pt; margin-bottom: 6pt; }
.obj-card-index { font-size: 8pt; color: ${C.textMuted}; font-weight: 600; }
.obj-card-inv {
  font-size: 8pt; color: ${C.accent}; font-weight: 600;
  background: ${C.accentLight}; border: 0.5pt solid ${C.accent};
  padding: 2pt 7pt; border-radius: 4pt; white-space: nowrap;
}
.obj-card-type { font-size: 8pt; color: ${C.textMuted}; margin-bottom: 2pt; }
.obj-card-title { font-size: 12pt; font-weight: 700; color: ${C.textPrimary}; margin-bottom: 6pt; }
.obj-card-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12pt; }
.obj-field { display: flex; gap: 5pt; padding: 3pt 0; border-bottom: 0.5pt solid ${C.border}; }
.obj-field:last-child { border-bottom: none; }
.obj-field-label { font-size: 7.5pt; color: ${C.textMuted}; width: 55pt; flex-shrink: 0; }
.obj-field-value { font-size: 8pt; color: ${C.textPrimary}; font-weight: 500; flex: 1; }

/* Section headers */
.section-header { margin-bottom: 7pt; }
.section-title { font-size: 11pt; font-weight: 700; color: ${C.textPrimary}; }
.section-underline { height: 2pt; background: ${C.accent}; border-radius: 2pt; margin-top: 3pt; }

/* Summary table */
.summary-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.summary-table th {
  text-align: left; padding: 5pt 7pt; font-size: 8pt; font-weight: 700;
  color: ${C.textSecondary}; text-transform: uppercase; letter-spacing: 0.5pt;
  border-bottom: 1.5pt solid ${C.accent}; background: ${C.accentLight};
}
.summary-table td { padding: 5pt 7pt; border-bottom: 0.5pt solid ${C.border}; vertical-align: top; }
.summary-table tr:nth-child(even) td { background: ${C.background}; }
.summary-table .num { font-weight: 700; color: ${C.accent}; }

/* Page footer */
.page-footer {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 10pt; padding-top: 8pt; border-top: 0.5pt solid ${C.border};
  font-size: 7.5pt; color: ${C.textMuted};
}

/* Compact header for object pages */
.compact-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12pt;
}
.compact-brand { display: flex; align-items: baseline; gap: 4pt; }
.compact-brand .brand-aha { font-style: italic; font-weight: 800; font-size: 13pt; color: ${C.accent}; }
.compact-brand .brand-register { font-size: 9pt; color: ${C.textSecondary}; }
.compact-coll-name { font-size: 9pt; color: ${C.textSecondary}; font-style: italic; }
`;
}

// ── Cover page ───────────────────────────────────────────────────────────────

function buildCoverPage(
  collectionName: string,
  description: string | null,
  objectCount: number,
  institutionName: string | null,
  now: string,
  t: TFunc,
  _C: ColorPalette,
): string {
  return `
  <div class="accent-bar"></div>
  <div class="cover">
    <div class="cover-brand">
      <span class="brand-aha">aha!</span>
      <span class="brand-register">Register</span>
    </div>
    <div class="cover-badge">${esc(t('pdf.collection_report_badge'))}</div>
    <div class="cover-title">${esc(collectionName)}</div>
    ${description ? `<div class="cover-desc">${esc(description)}</div>` : ''}
    <div class="cover-meta">
      <div class="cover-meta-item">
        <div class="cover-meta-label">${esc(t('pdf.cover_objects'))}</div>
        <div class="cover-meta-value">${objectCount}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">${esc(t('pdf.cover_created'))}</div>
        <div class="cover-meta-value" style="font-size:12pt;">${now}</div>
      </div>
      ${institutionName ? `
      <div class="cover-meta-item">
        <div class="cover-meta-label">${esc(t('pdf.cover_institution'))}</div>
        <div class="cover-meta-value" style="font-size:12pt;">${esc(institutionName)}</div>
      </div>` : ''}
    </div>
    <div class="cover-footer">
      <span class="cover-institution">${institutionName ? esc(institutionName) : 'aha! Register'}</span>
      <span class="cover-url">aharegister.com</span>
    </div>
  </div>
  <div class="page-break"></div>`;
}

// ── Condensed object page ────────────────────────────────────────────────────

function buildObjectPage(
  data: ObjectExportData,
  index: number,
  total: number,
  collectionName: string,
  now: string,
  t: TFunc,
  C: ColorPalette,
): string {
  const { object: obj, media } = data;
  const tsd = parseTypeData(obj.type_specific_data);
  const primary = media.find((m) => m.is_primary === 1) ?? media[0] ?? null;

  const material = fmtArr(tsd.material) ?? (typeof tsd.material === 'string' ? tsd.material : null);
  const technique = fmtArr(tsd.technique) ?? null;
  const dims = fmtDims(tsd.dimensions, t);
  const condition = typeof tsd.condition === 'string' ? t(`type_forms.condition.${tsd.condition}`) : null;
  const period = typeof tsd.period === 'string' ? tsd.period : null;
  const datierung = obj.event_start
    ? obj.event_end ? `${fmt(obj.event_start)} – ${fmt(obj.event_end)}` : fmt(obj.event_start)
    : typeof tsd.date_exact === 'string' ? tsd.date_exact : null;
  const herkunft = typeof tsd.place_of_origin === 'string' ? tsd.place_of_origin : null;
  const owner = typeof tsd.owner === 'string' ? tsd.owner : null;

  function field(label: string, value: string | null): string {
    if (!value) return '';
    return `<div class="obj-field">
      <span class="obj-field-label">${label}</span>
      <span class="obj-field-value">${esc(value)}</span>
    </div>`;
  }

  const sha256Short = primary?.sha256_hash ? primary.sha256_hash.slice(0, 20) + '…' : '—';

  return `
  <div class="accent-bar-sm"></div>
  <div class="compact-header">
    <div class="compact-brand">
      <span class="brand-aha">aha!</span>
      <span class="brand-register">Register</span>
    </div>
    <span class="compact-coll-name">${esc(collectionName)} &nbsp;|&nbsp; ${index} / ${total}</span>
  </div>

  <div class="obj-card">
    <div class="obj-card-image">
      ${primary
        ? `<img class="obj-card-img" src="data:${primary.mime_type};base64,${primary.base64Data}" />`
        : `<div class="obj-card-placeholder">${esc(t('pdf.no_image_short'))}</div>`}
    </div>
    <div class="obj-card-body">
      <div class="obj-card-header">
        <div>
          <div class="obj-card-type">${esc(t(`object_types.${obj.object_type}`))}</div>
          <div class="obj-card-title">${esc(obj.title)}</div>
        </div>
        ${obj.inventory_number ? `<div class="obj-card-inv">${esc(obj.inventory_number)}</div>` : ''}
      </div>
      <div class="obj-card-fields">
        ${field(t('pdf.label_material'), material)}
        ${field(t('pdf.label_technique'), technique)}
        ${field(t('pdf.label_dimensions'), dims)}
        ${field(t('pdf.label_condition'), condition)}
        ${field(t('pdf.label_captured'), datierung)}
        ${field(t('pdf.label_period'), period)}
        ${field(t('pdf.fact_origin'), herkunft)}
        ${field(t('pdf.label_owner'), owner)}
      </div>
    </div>
  </div>

  ${obj.description ? `<p style="font-size:9pt;color:${C.textSecondary};margin-bottom:8pt;line-height:1.5;">${esc(obj.description)}</p>` : ''}

  <div style="display:flex;gap:14pt;align-items:flex-start;margin-top:4pt;">
    <div style="flex:1;">
      <div style="font-size:7.5pt;color:${C.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.8pt;margin-bottom:3pt;">${esc(t('pdf.label_sha256'))}</div>
      <div class="mono" style="font-size:8pt;">${sha256Short}</div>
    </div>
    <div>
      <div style="font-size:7.5pt;color:${C.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.8pt;margin-bottom:3pt;">${esc(t('pdf.label_captured'))}</div>
      <div style="font-size:8pt;color:${C.textPrimary};">${obj.created_at.slice(0, 10)}</div>
    </div>
    <div>
      <div style="font-size:7.5pt;color:${C.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.8pt;margin-bottom:3pt;">${esc(t('pdf.tamper_events'))}</div>
      <div style="font-size:8pt;color:${C.textPrimary};">${data.auditTrail.length}</div>
    </div>
  </div>

  <div class="page-footer">
    <span>${esc(collectionName)} &nbsp;|&nbsp; ${esc(t('pdf.generated_by'))} &nbsp;|&nbsp; ${now}</span>
    <span>aharegister.com</span>
  </div>`;
}

// ── Summary table ────────────────────────────────────────────────────────────

function buildSummaryPage(
  collectionName: string,
  objects: ObjectExportData[],
  now: string,
  t: TFunc,
  _C: ColorPalette,
): string {
  const rows = objects.map((d, i) => {
    const tsd = parseTypeData(d.object.type_specific_data);
    const condition = typeof tsd.condition === 'string' ? t(`type_forms.condition.${tsd.condition}`) : '—';
    return `<tr>
      <td class="num">${i + 1}</td>
      <td>${esc(d.object.inventory_number) || '—'}</td>
      <td><strong>${esc(d.object.title)}</strong></td>
      <td>${esc(t(`object_types.${d.object.object_type}`))}</td>
      <td>${condition}</td>
      <td>${d.object.created_at.slice(0, 10)}</td>
    </tr>`;
  }).join('');

  return `
  <div class="accent-bar-sm"></div>
  <div class="compact-header">
    <div class="compact-brand">
      <span class="brand-aha">aha!</span>
      <span class="brand-register">Register</span>
    </div>
    <span class="compact-coll-name">${esc(collectionName)}</span>
  </div>

  <div class="section-header" style="margin-bottom:12pt;">
    <div class="section-title">${esc(t('pdf.summary_title', { count: objects.length }))}</div>
    <div class="section-underline"></div>
  </div>

  <table class="summary-table">
    <thead>
      <tr>
        <th style="width:20pt;">${esc(t('pdf.table_number'))}</th>
        <th style="width:70pt;">${esc(t('pdf.table_inventory'))}</th>
        <th>${esc(t('pdf.table_title'))}</th>
        <th style="width:80pt;">${esc(t('pdf.table_type'))}</th>
        <th style="width:60pt;">${esc(t('pdf.table_condition'))}</th>
        <th style="width:55pt;">${esc(t('pdf.table_captured'))}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="page-footer">
    <span>${esc(collectionName)} &nbsp;|&nbsp; ${objects.length} ${esc(t('pdf.cover_objects'))} &nbsp;|&nbsp; ${esc(t('pdf.generated_by'))} &nbsp;|&nbsp; ${now}</span>
    <span>aharegister.com</span>
  </div>`;
}

// ── Main export ──────────────────────────────────────────────────────────────

export function generateCollectionReportHTML(
  collectionName: string,
  objects: ObjectExportData[],
  institutionName: string | null,
  t: TFunc,
  collectionDescription: string | null | undefined,
  C: ColorPalette,
): string {
  const palette = C;
  const locale = t('pdf.date_locale');
  const now = new Date().toLocaleDateString(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });

  const cover = buildCoverPage(collectionName, collectionDescription ?? null, objects.length, institutionName, now, t, palette);

  const objectPages = objects.map((data, i) => {
    const page = buildObjectPage(data, i + 1, objects.length, collectionName, now, t, palette);
    return i < objects.length - 1 ? page + '\n<div class="page-break"></div>' : page;
  }).join('\n');

  const summaryPage = objects.length > 1
    ? '\n<div class="page-break"></div>\n' + buildSummaryPage(collectionName, objects, now, t, palette)
    : '';

  return `<!DOCTYPE html>
<html lang="${t('pdf.html_lang')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${buildCSS(palette)}</style>
</head>
<body>
  ${cover}
  ${objectPages}
  ${summaryPage}
</body>
</html>`;
}
