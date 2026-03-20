/**
 * aha! Register — Object Report HTML Template
 *
 * Generates a two-page A4 Karteikarte-style PDF report for a single object.
 * Rendered via expo-print (headless WebKit) → no JS execution, only HTML/CSS.
 */

import type { ObjectExportData } from '../services/exportTemplate';
import { colors } from '../theme';

// ── Theme colors (imported from centralized design system) ──────────────────

const C = colors;

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

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 19).replace('T', ' ');
}

function fmtGps(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return '—';
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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

function statusDot(status: string | null | undefined): string {
  // Color mapping uses raw DB values (always German strings)
  const map: Record<string, string> = {
    'ausgestellt': C.accent,
    'nicht ausgestellt': C.danger,
    'in Restaurierung': C.warning,
    'Depot': C.textMuted,
  };
  const col = status ? (map[status] ?? C.textMuted) : C.textMuted;
  return `<span style="display:inline-block;width:7pt;height:7pt;border-radius:50%;background:${col};margin-right:5pt;vertical-align:middle;flex-shrink:0;"></span>`;
}

function translateDisplayStatus(rawStatus: string, t: TFunc): string {
  const keyMap: Record<string, string> = {
    'ausgestellt': 'type_forms.museum_object.display_status_ausgestellt',
    'nicht ausgestellt': 'type_forms.museum_object.display_status_nicht_ausgestellt',
    'in Restaurierung': 'type_forms.museum_object.display_status_in_restaurierung',
    'Depot': 'type_forms.museum_object.display_status_depot',
  };
  const key = keyMap[rawStatus];
  return key ? t(key) : rawStatus;
}

// ── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,700&display=swap');
@page { size: A4; margin: 18mm 20mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'DM Sans', -apple-system, system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9.5pt;
  color: ${C.textPrimary};
  line-height: 1.45;
  background: #FFFFFF;
}
code, .mono {
  font-family: 'Courier New', Courier, monospace;
  font-size: 8.5pt;
  word-break: break-all;
}

/* ── Accent bar ── */
.accent-bar { height: 4pt; background: ${C.primary}; width: 100%; margin-bottom: 12pt; }
.accent-bar-sm { height: 3pt; background: ${C.primary}; width: 100%; margin-bottom: 10pt; }

/* ── Header ── */
.report-header {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 10pt; border-bottom: 0.5pt solid ${C.primary};
  margin-bottom: 14pt;
}
.header-brand { display: flex; align-items: baseline; gap: 4pt; }
.brand-aha { font-style: italic; font-weight: 700; font-size: 18pt; color: ${C.primary}; }
.brand-register { font-size: 10pt; color: ${C.textSecondary}; font-weight: 400; }
.header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4pt; }
.header-badge {
  background: ${C.accent}; color: #FFFFFF;
  font-size: 7pt; font-weight: 700; letter-spacing: 1.5pt;
  padding: 3pt 10pt; border-radius: 2pt; text-transform: uppercase;
}
.header-institution { font-size: 8pt; color: ${C.textSecondary}; font-weight: 500; }

/* ── Title row ── */
.title-row {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12pt; margin-bottom: 14pt;
  padding-bottom: 10pt; border-bottom: 0.5pt solid ${C.border};
}
.title-block { flex: 1; }
.obj-type-label {
  font-size: 7.5pt; font-weight: 700; color: ${C.primary};
  text-transform: uppercase; letter-spacing: 1.5pt; margin-bottom: 3pt;
}
.obj-title { font-size: 16pt; font-weight: 700; color: ${C.textPrimary}; margin-bottom: 3pt; line-height: 1.2; }
.obj-subtitle { font-size: 9.5pt; color: ${C.textSecondary}; line-height: 1.4; }
.inv-badge {
  background: #FFFFFF; border: 1.5pt solid ${C.accent}; color: ${C.accent};
  font-family: 'Courier New', Courier, monospace;
  font-size: 9pt; font-weight: 600; padding: 4pt 10pt;
  border-radius: 3pt; white-space: nowrap; flex-shrink: 0;
  letter-spacing: 0.3pt;
}

/* ── Main two-column layout ── */
.main-columns { display: flex; gap: 14pt; margin-bottom: 16pt; }
.col-image { flex: 0 0 55%; }
.col-facts { flex: 1; }

/* ── Image ── */
.image-wrapper {
  position: relative; background: ${C.background};
  border: 0.5pt solid ${C.border}; border-radius: 4pt; overflow: hidden;
  margin-bottom: 6pt;
}
.primary-img { width: 100%; max-height: 200pt; object-fit: contain; display: block; }
.image-placeholder {
  width: 100%; height: 150pt; display: flex; align-items: center; justify-content: center;
  background: ${C.background}; color: ${C.textMuted}; font-size: 9pt;
}
.img-count-badge {
  position: absolute; bottom: 6pt; right: 6pt;
  background: rgba(0,0,0,0.55); color: #FFFFFF;
  font-size: 7pt; font-weight: 600; padding: 2pt 7pt; border-radius: 10pt;
}
.thumb-strip { display: flex; gap: 5pt; }
.thumb { flex: 1; max-width: 60pt; height: 40pt; object-fit: cover; border-radius: 3pt; border: 0.5pt solid ${C.border}; }
.thumb-more {
  flex: 1; max-width: 60pt; height: 40pt; border-radius: 3pt; border: 0.5pt solid ${C.border};
  background: ${C.background}; display: flex; align-items: center; justify-content: center;
  font-size: 8pt; color: ${C.textSecondary}; font-weight: 600;
}

/* ── Facts card ── */
.facts-card {
  background: #FFFFFF; border: 0.5pt solid ${C.border};
  border-radius: 4pt; padding: 10pt 12pt; height: 100%;
}
.fact-row { display: flex; gap: 6pt; padding: 5pt 0; border-bottom: 0.5pt solid rgba(0,0,0,0.06); align-items: flex-start; }
.fact-row:last-child { border-bottom: none; }
.fact-label {
  font-size: 7.5pt; color: ${C.primary}; font-weight: 700; width: 72pt;
  flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.8pt; padding-top: 1pt;
}
.fact-value { font-size: 9pt; color: ${C.textPrimary}; font-weight: 500; flex: 1; display: flex; align-items: center; }

/* ── Section headers ── */
.section { margin-bottom: 16pt; }
.section-header {
  margin-bottom: 8pt;
  border-left: 3pt solid ${C.accent};
  padding-left: 8pt;
}
.section-title {
  font-size: 8pt; font-weight: 700; color: ${C.primary};
  text-transform: uppercase; letter-spacing: 1.5pt;
}

/* ── Data grid (two columns) ── */
.data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14pt; }
.data-row { display: flex; gap: 6pt; padding: 4pt 0; border-bottom: 0.5pt solid rgba(0,0,0,0.06); }
.data-label {
  font-size: 7.5pt; color: ${C.primary}; width: 72pt; flex-shrink: 0;
  padding-top: 1pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8pt;
}
.data-value { font-size: 9pt; color: ${C.textPrimary}; font-weight: 500; flex: 1; }

/* ── Provenance ── */
.prov-section { margin-bottom: 12pt; }
.prov-row { margin-bottom: 6pt; }
.prov-label {
  font-size: 7.5pt; font-weight: 700; color: ${C.primary};
  text-transform: uppercase; letter-spacing: 0.8pt; margin-bottom: 2pt;
}
.prov-text { font-size: 9pt; color: ${C.textPrimary}; line-height: 1.5; }

/* ── Tamper evidence footer ── */
.tamper-footer {
  background: rgba(30,45,61,0.05); border: 1pt solid rgba(30,45,61,0.15);
  border-radius: 4pt; padding: 10pt 12pt;
  display: flex; gap: 10pt; align-items: flex-start;
  margin-top: 14pt;
}
.tamper-info { flex: 1; }
.tamper-title {
  font-size: 7.5pt; font-weight: 700; color: ${C.primary};
  text-transform: uppercase; letter-spacing: 1.5pt; margin-bottom: 4pt;
}
.tamper-hash { font-family: 'Courier New', Courier, monospace; font-size: 8pt; color: ${C.textPrimary}; word-break: break-all; margin-bottom: 4pt; }
.tamper-meta { display: flex; gap: 14pt; }
.tamper-meta-item { font-size: 7.5pt; color: ${C.textSecondary}; }
.tamper-meta-item strong { color: ${C.textPrimary}; }
.qr-box {
  width: 44pt; height: 44pt; border: 1pt solid ${C.primary}; border-radius: 3pt;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.qr-box svg { width: 100%; height: 100%; }

/* ── Page footer ── */
.page-footer {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 12pt; padding-top: 8pt; border-top: 0.5pt solid ${C.border};
  font-size: 7.5pt; color: ${C.textMuted};
}

/* ── Page 2 specific ── */
.page-break { page-break-after: always; }
.narrative { font-size: 9.5pt; color: ${C.textPrimary}; line-height: 1.6; }
.activity-card {
  background: rgba(30,45,61,0.04); border: 0.5pt solid rgba(30,45,61,0.12);
  border-radius: 4pt; padding: 8pt 12pt; margin-bottom: 10pt;
}
.activity-date { font-size: 7.5pt; color: ${C.primary}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 3pt; }
.activity-text { font-size: 9pt; color: ${C.textPrimary}; }
.bib-list { list-style: none; padding: 0; }
.bib-item { display: flex; gap: 7pt; padding: 5pt 0; border-bottom: 0.5pt solid rgba(0,0,0,0.06); align-items: flex-start; }
.bib-dot { width: 5pt; height: 5pt; border-radius: 50%; background: ${C.accent}; flex-shrink: 0; margin-top: 4pt; }
.bib-text { font-size: 9pt; color: ${C.textPrimary}; line-height: 1.45; }

/* ── Audit timeline ── */
.timeline { position: relative; }
.tl-item { display: flex; gap: 10pt; padding-bottom: 7pt; position: relative; }
.tl-left { display: flex; flex-direction: column; align-items: center; width: 12pt; flex-shrink: 0; }
.tl-dot { width: 7pt; height: 7pt; border-radius: 50%; background: ${C.accent}; flex-shrink: 0; }
.tl-line { flex: 1; width: 0.5pt; background: ${C.border}; min-height: 8pt; }
.tl-content { flex: 1; padding-bottom: 3pt; }
.tl-date { font-size: 7.5pt; color: ${C.textMuted}; font-weight: 600; }
.tl-action { font-size: 9pt; color: ${C.textPrimary}; font-weight: 500; }
.tl-detail { font-size: 8pt; color: ${C.textSecondary}; }

/* ── Compact page 2 header ── */
.compact-header {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 8pt; border-bottom: 0.5pt solid ${C.primary};
  margin-bottom: 14pt;
}
.compact-brand { display: flex; align-items: baseline; gap: 4pt; }
.compact-brand .brand-aha { font-style: italic; font-weight: 700; font-size: 14pt; color: ${C.primary}; }
.compact-brand .brand-register { font-size: 9pt; color: ${C.textSecondary}; }
.compact-title-block { text-align: right; }
.compact-obj-title { font-size: 10pt; font-weight: 600; color: ${C.textPrimary}; }
.compact-inv { font-family: 'Courier New', Courier, monospace; font-size: 8pt; color: ${C.textMuted}; }
`;

// ── QR code element ──────────────────────────────────────────────────────────

function qrElement(qrSvg?: string): string {
  if (qrSvg) {
    return `<div class="qr-box">${qrSvg}</div>`;
  }
  return `<div class="qr-box" style="font-size:6pt;color:${C.textMuted};text-align:center;">QR</div>`;
}

// ── Page 1 builder ───────────────────────────────────────────────────────────

function buildPage1(data: ObjectExportData, now: string, t: TFunc): string {
  const { object: obj, media, auditTrail, collections } = data;
  const tsd = parseTypeData(obj.type_specific_data);
  const primary = media.find((m) => m.is_primary === 1) ?? media[0] ?? null;
  const others = media.filter((m) => m !== primary);

  // ── Title block ──
  const shortTitle = typeof tsd.short_title === 'string' ? tsd.short_title : null;
  const tsdDesc = typeof tsd.description === 'string' ? tsd.description : null;
  const subtitle = shortTitle ?? tsdDesc ?? obj.description;

  // ── Facts ──
  const collectionName = collections[0]?.name ?? (typeof tsd.department === 'string' ? tsd.department : null);
  const datierung = obj.event_start
    ? obj.event_end ? `${fmt(obj.event_start)} – ${fmt(obj.event_end)}` : fmt(obj.event_start)
    : typeof tsd.date_exact === 'string' ? esc(tsd.date_exact) : null;
  const herkunft = typeof tsd.place_of_origin === 'string' ? tsd.place_of_origin : null;
  const hersteller = typeof tsd.maker_role === 'string' ? tsd.maker_role : null;
  const displayStatus = typeof tsd.display_status === 'string' ? tsd.display_status : null;
  const standort = typeof tsd.storage_location === 'string' ? tsd.storage_location : null;

  // ── Image section ──
  const imageHtml = primary
    ? `<div class="image-wrapper">
        <img class="primary-img" src="data:${primary.mime_type};base64,${primary.base64Data}" />
        ${media.length > 1 ? `<div class="img-count-badge">${t('pdf.photos_count', { count: media.length })}</div>` : ''}
       </div>
       <div class="thumb-strip">
         ${others.slice(0, 3).map((m) => `<img class="thumb" src="data:${m.mime_type};base64,${m.base64Data}" />`).join('')}
         ${others.length > 3 ? `<div class="thumb-more">+${others.length - 3}</div>` : ''}
       </div>`
    : `<div class="image-wrapper"><div class="image-placeholder">${t('pdf.no_image')}</div></div>`;

  // ── Objektdaten grid ──
  const material = fmtArr(tsd.material);
  const technique = fmtArr(tsd.technique);
  const dims = fmtDims(tsd.dimensions, t);
  const owner = typeof tsd.owner === 'string' ? tsd.owner : null;
  const insurance = typeof tsd.insurance_value === 'string' ? tsd.insurance_value : null;
  const classification = typeof tsd.classification === 'string' ? tsd.classification : null;

  function dataRow(label: string, value: string | null): string {
    if (!value) return '';
    return `<div class="data-row"><span class="data-label">${label}</span><span class="data-value">${esc(value)}</span></div>`;
  }

  const dataItems = [
    dataRow(t('pdf.label_material'), material),
    dataRow(t('pdf.label_technique'), technique),
    dataRow(t('pdf.label_dimensions'), dims),
    dataRow(t('pdf.label_condition'), typeof tsd.condition === 'string' ? tsd.condition : null),
    dataRow(t('pdf.label_owner'), owner),
    dataRow(t('pdf.label_insurance_value'), insurance),
    dataRow(t('pdf.label_classification'), classification),
    dataRow(t('pdf.label_period'), typeof tsd.period === 'string' ? tsd.period : null),
    dataRow(t('pdf.label_culture'), typeof tsd.culture === 'string' ? tsd.culture : null),
    dataRow(t('pdf.label_inscription'), typeof tsd.inscription === 'string' ? tsd.inscription : null),
  ].filter(Boolean);

  // ── Provenance ──
  const provNarrative = typeof tsd.provenance_narrative === 'string' ? tsd.provenance_narrative : null;
  const provenance = typeof tsd.provenance === 'string' ? tsd.provenance : null;
  const histColl = typeof tsd.historical_collections === 'string' ? tsd.historical_collections : null;
  const histInv = typeof tsd.historical_inventory_numbers === 'string' ? tsd.historical_inventory_numbers : null;
  const acquisition = typeof tsd.acquisition_type === 'string' ? tsd.acquisition_type : null;
  const permLoan = tsd.permanent_loan === true
    ? t('pdf.loan_yes') + (typeof tsd.permanent_loan_until === 'string' ? ` ${t('pdf.loan_until', { date: fmt(tsd.permanent_loan_until) })}` : '')
    : null;

  const showProv = provNarrative || provenance || histColl || histInv || acquisition || permLoan;

  // ── SHA-256 (primary media) ──
  const sha256 = primary?.sha256_hash ?? '—';
  const sha256Display = sha256.length > 32 ? sha256.slice(0, 32) + '…' : sha256;

  return `
  <!-- ACCENT BAR -->
  <div class="accent-bar"></div>

  <!-- HEADER -->
  <div class="report-header">
    <div class="header-brand">
      ${data.institutionName ? `<span class="header-institution">${esc(data.institutionName)}</span>` : `<span class="brand-aha">aha!</span><span class="brand-register">Register</span>`}
    </div>
    <div class="header-right">
      <div class="header-badge">${esc(t('pdf.object_report_badge'))}</div>
    </div>
  </div>

  <!-- TITLE ROW -->
  <div class="title-row">
    <div class="title-block">
      <div class="obj-type-label">${esc(t(`object_types.${obj.object_type}`))}</div>
      <div class="obj-title">${esc(obj.title)}</div>
      ${subtitle ? `<div class="obj-subtitle">${esc(subtitle)}</div>` : ''}
    </div>
    ${obj.inventory_number ? `<div class="inv-badge">${esc(obj.inventory_number)}</div>` : ''}
  </div>

  <!-- MAIN COLUMNS -->
  <div class="main-columns">
    <div class="col-image">${imageHtml}</div>
    <div class="col-facts">
      <div class="facts-card">
        <div class="fact-row">
          <span class="fact-label">${esc(t('pdf.fact_collection'))}</span>
          <span class="fact-value">${collectionName ? esc(collectionName) : '&mdash;'}</span>
        </div>
        <div class="fact-row">
          <span class="fact-label">${esc(t('pdf.fact_dating'))}</span>
          <span class="fact-value">${datierung ?? '&mdash;'}</span>
        </div>
        <div class="fact-row">
          <span class="fact-label">${esc(t('pdf.fact_origin'))}</span>
          <span class="fact-value">${herkunft ? esc(herkunft) : '&mdash;'}</span>
        </div>
        <div class="fact-row">
          <span class="fact-label">${esc(t('pdf.fact_maker'))}</span>
          <span class="fact-value">${hersteller ? esc(hersteller) : '&mdash;'}</span>
        </div>
        <div class="fact-row">
          <span class="fact-label">${esc(t('pdf.fact_presence'))}</span>
          <span class="fact-value">${displayStatus ? statusDot(displayStatus) + esc(translateDisplayStatus(displayStatus, t)) : '&mdash;'}</span>
        </div>
        <div class="fact-row">
          <span class="fact-label">${esc(t('pdf.fact_location'))}</span>
          <span class="fact-value">${standort ? esc(standort) : '&mdash;'}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- OBJEKTDATEN -->
  ${dataItems.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <div class="section-title">${esc(t('pdf.section_object_data'))}</div>
    </div>
    <div class="data-grid">${dataItems.join('')}</div>
  </div>` : ''}

  <!-- PROVENIENZ & ERWERBUNG -->
  ${showProv ? `
  <div class="section">
    <div class="section-header">
      <div class="section-title">${esc(t('pdf.section_provenance'))}</div>
    </div>
    ${acquisition ? `<div class="prov-row"><div class="prov-label">${esc(t('pdf.label_acquisition'))}</div><div class="prov-text">${esc(acquisition)}</div></div>` : ''}
    ${permLoan ? `<div class="prov-row"><div class="prov-label">${esc(t('pdf.label_permanent_loan'))}</div><div class="prov-text">${esc(permLoan)}</div></div>` : ''}
    ${(provNarrative || provenance) ? `<div class="prov-row"><div class="prov-label">${esc(t('pdf.label_provenance'))}</div><div class="prov-text">${esc(provNarrative ?? provenance ?? '')}</div></div>` : ''}
    ${histColl ? `<div class="prov-row"><div class="prov-label">${esc(t('pdf.label_hist_collection'))}</div><div class="prov-text">${esc(histColl)}</div></div>` : ''}
    ${histInv ? `<div class="prov-row"><div class="prov-label">${esc(t('pdf.label_hist_inventory'))}</div><div class="prov-text">${esc(histInv)}</div></div>` : ''}
  </div>` : ''}

  <!-- TAMPER EVIDENCE FOOTER -->
  <div class="tamper-footer">
    <div class="tamper-info">
      <div class="tamper-title">${esc(t('pdf.tamper_title'))}</div>
      <div class="tamper-hash mono">${sha256Display}</div>
      <div class="tamper-meta">
        <div class="tamper-meta-item"><strong>${esc(t('pdf.tamper_capture'))}</strong><br/>${fmtTs(obj.created_at)}</div>
        <div class="tamper-meta-item"><strong>${esc(t('pdf.tamper_gps'))}</strong><br/>${fmtGps(obj.latitude, obj.longitude)}</div>
        <div class="tamper-meta-item"><strong>${esc(t('pdf.tamper_events'))}</strong><br/>${auditTrail.length}</div>
      </div>
    </div>
    ${qrElement(data.qrSvg)}
  </div>

  <!-- PAGE FOOTER -->
  <div class="page-footer">
    <span>${esc(t('pdf.generated_by'))} &nbsp;|&nbsp; ${now} &nbsp;|&nbsp; ${esc(t('pdf.page_of', { current: 1, total: 2 }))}</span>
    <span>aharegister.com</span>
  </div>`;
}

// ── Page 2 builder ───────────────────────────────────────────────────────────

function buildPage2(data: ObjectExportData, now: string, t: TFunc): string {
  const { object: obj, media, auditTrail } = data;
  const tsd = parseTypeData(obj.type_specific_data);
  const primary = media.find((m) => m.is_primary === 1) ?? media[0] ?? null;

  // ── Beschreibung ──
  const descText = obj.description ?? (typeof tsd.description === 'string' ? tsd.description : null);
  const scientificNotes = typeof tsd.scientific_notes === 'string' ? tsd.scientific_notes : null;

  // ── Latest activity ──
  const latestActivity = auditTrail.length > 0 ? auditTrail[auditTrail.length - 1] : null;

  // ── Literatur ──
  const bibliography = typeof tsd.bibliography === 'string' ? tsd.bibliography : null;
  const mentionedIn = typeof tsd.mentioned_in === 'string' ? tsd.mentioned_in : null;
  const internetComment = typeof tsd.internet_comment === 'string' ? tsd.internet_comment : null;
  const bibLines = [bibliography, mentionedIn, internetComment].filter(Boolean) as string[];

  // ── SHA-256 (primary media) ──
  const sha256 = primary?.sha256_hash ?? '—';
  const sha256Display = sha256.length > 32 ? sha256.slice(0, 32) + '…' : sha256;

  // ── Audit trail (last 20 entries) ──
  const recentAudit = auditTrail.slice(-20);

  function fmtAuditAction(action: string): string {
    const keyMap: Record<string, string> = {
      insert: 'pdf.audit_insert',
      update: 'pdf.audit_update',
      delete: 'pdf.audit_delete',
      sync_conflict: 'pdf.audit_sync_conflict',
    };
    const key = keyMap[action];
    return key ? t(key) : action;
  }

  return `
  <!-- PAGE BREAK -->
  <div class="page-break"></div>

  <!-- ACCENT BAR (compact) -->
  <div class="accent-bar-sm"></div>

  <!-- COMPACT HEADER -->
  <div class="compact-header">
    <div class="compact-brand">
      <span class="brand-aha">aha!</span>
      <span class="brand-register">Register</span>
    </div>
    <div class="compact-title-block">
      <div class="compact-obj-title">${esc(obj.title)}</div>
      ${obj.inventory_number ? `<div class="compact-inv">${esc(obj.inventory_number)}</div>` : ''}
    </div>
  </div>

  <!-- BESCHREIBUNG -->
  ${descText || scientificNotes ? `
  <div class="section">
    <div class="section-header">
      <div class="section-title">${esc(t('pdf.section_description'))}</div>
    </div>
    ${descText ? `<p class="narrative">${esc(descText)}</p>` : ''}
    ${scientificNotes ? `<p class="narrative" style="margin-top:8pt;color:${C.textSecondary};">${esc(scientificNotes)}</p>` : ''}
  </div>` : ''}

  <!-- LATEST ACTIVITY -->
  ${latestActivity ? `
  <div class="activity-card">
    <div class="activity-date">${fmtTs(latestActivity.created_at)}</div>
    <div class="activity-text">${fmtAuditAction(latestActivity.action)} — ${esc(latestActivity.table_name)}${latestActivity.user_id ? ` (${esc(latestActivity.user_id.slice(0, 8))}&hellip;)` : ''}</div>
  </div>` : ''}

  <!-- LITERATUR & QUELLEN -->
  ${bibLines.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <div class="section-title">${esc(t('pdf.section_bibliography'))}</div>
    </div>
    <ul class="bib-list">
      ${bibLines.map((line) => `
        <li class="bib-item">
          <div class="bib-dot"></div>
          <span class="bib-text">${esc(line)}</span>
        </li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- AUDIT TRAIL TIMELINE -->
  ${recentAudit.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <div class="section-title">${esc(t('pdf.section_audit_trail'))}</div>
    </div>
    <div class="timeline">
      ${recentAudit.map((entry, i) => `
        <div class="tl-item">
          <div class="tl-left">
            <div class="tl-dot"></div>
            ${i < recentAudit.length - 1 ? '<div class="tl-line"></div>' : ''}
          </div>
          <div class="tl-content">
            <div class="tl-date">${fmtTs(entry.created_at)}</div>
            <div class="tl-action">${fmtAuditAction(esc(entry.action))}</div>
            ${entry.user_id ? `<div class="tl-detail">${esc(t('pdf.label_user'))}: ${esc(entry.user_id.slice(0, 12))}&hellip;</div>` : ''}
          </div>
        </div>`).join('')}
    </div>
    ${auditTrail.length > 20 ? `<p style="font-size:8pt;color:${C.textMuted};margin-top:6pt;">${esc(t('pdf.audit_showing', { shown: recentAudit.length, total: auditTrail.length }))}</p>` : ''}
  </div>` : ''}

  <!-- TAMPER EVIDENCE FOOTER -->
  <div class="tamper-footer">
    <div class="tamper-info">
      <div class="tamper-title">${esc(t('pdf.tamper_title'))}</div>
      <div class="tamper-hash mono">${sha256Display}</div>
      <div class="tamper-meta">
        <div class="tamper-meta-item"><strong>${esc(t('pdf.tamper_object_uuid'))}</strong><br/><span class="mono">${obj.id}</span></div>
        <div class="tamper-meta-item"><strong>${esc(t('pdf.tamper_total_events'))}</strong><br/>${auditTrail.length}</div>
      </div>
    </div>
    ${qrElement(data.qrSvg)}
  </div>

  <!-- PAGE FOOTER -->
  <div class="page-footer">
    <span>${esc(t('pdf.generated_by'))} &nbsp;|&nbsp; ${now} &nbsp;|&nbsp; ${esc(t('pdf.page_of', { current: 2, total: 2 }))}</span>
    <span>aharegister.com</span>
  </div>`;
}

// ── Main export ──────────────────────────────────────────────────────────────

export function generateObjectReportHTML(data: ObjectExportData, t: TFunc): string {
  const locale = t('pdf.date_locale');
  const now = new Date().toLocaleDateString(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="${t('pdf.html_lang')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${CSS}</style>
</head>
<body>
  ${buildPage1(data, now, t)}
  ${buildPage2(data, now, t)}
</body>
</html>`;
}
