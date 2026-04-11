import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import type { AuditTrailEntry, RegisterObject } from '../db/types';
import type { ColorPalette } from '../theme';
import i18n from '../i18n';
import { getMediaForObject } from './mediaService';
import { getCollectionsForObject, getCollectionById } from './collectionService';
import { getSetting, SETTING_KEYS } from './settingsService';
import {
  type MediaWithBase64,
  type ObjectExportData,
} from './exportTemplate';
import { generateObjectReportHTML } from '../templates/object-report';
import { generateCollectionReportHTML } from '../templates/collection-report';
import { APP_CONFIG } from '../config/constants';

async function generateQrSvg(objectId: string, colors: ColorPalette): Promise<string | undefined> {
  try {
    return await QRCode.toString(
      `${APP_CONFIG.WEB_APP_BASE_URL}/verify/${objectId}`,
      {
        type: 'svg',
        width: 88,
        margin: 1,
        color: { dark: colors.accent, light: '#FFFFFF' },
      },
    );
  } catch {
    return undefined;
  }
}

async function loadObjectExportData(
  db: SQLiteDatabase,
  objectId: string,
  institutionName: string | null,
  colors: ColorPalette,
): Promise<ObjectExportData | null> {
  const obj = await db.getFirstAsync<RegisterObject>(
    'SELECT * FROM objects WHERE id = ?',
    [objectId],
  );
  if (!obj) return null;

  const [mediaRows, auditTrail, collections, qrSvg] = await Promise.all([
    getMediaForObject(db, objectId),
    db.getAllAsync<AuditTrailEntry>(
      'SELECT * FROM audit_trail WHERE record_id = ? ORDER BY created_at ASC',
      [objectId],
    ),
    getCollectionsForObject(db, objectId),
    generateQrSvg(objectId, colors),
  ]);

  // Convert media files to base64 for embedding in HTML
  const media: MediaWithBase64[] = [];
  for (const m of mediaRows) {
    try {
      const file = new File(m.preview_uri ?? m.file_path);
      const base64Data = await file.base64();
      media.push({ ...m, base64Data });
    } catch {
      // File missing — skip this media item
    }
  }

  return { object: obj, media, auditTrail, collections, institutionName, qrSvg };
}

/**
 * Generates a PDF for a single object and returns the file URI.
 */
export async function exportObjectToPDF(
  db: SQLiteDatabase,
  objectId: string,
  colors: ColorPalette,
): Promise<string> {
  const institutionName = await getSetting(db, SETTING_KEYS.INSTITUTION_NAME);
  const data = await loadObjectExportData(db, objectId, institutionName, colors);
  if (!data) throw new Error('Object not found');

  const t = i18n.getFixedT(i18n.language);
  const html = generateObjectReportHTML(data, t, colors);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Generates a PDF for an entire collection (all objects concatenated)
 * and returns the file URI.
 */
export async function exportCollectionToPDF(
  db: SQLiteDatabase,
  collectionId: string,
  colors: ColorPalette,
): Promise<string> {
  const result = await getCollectionById(db, collectionId);
  if (!result) throw new Error('Collection not found');

  const institutionName = await getSetting(db, SETTING_KEYS.INSTITUTION_NAME);

  const objectsData: ObjectExportData[] = [];
  for (const obj of result.objects) {
    const data = await loadObjectExportData(db, obj.id, institutionName, colors);
    if (data) objectsData.push(data);
  }

  const t = i18n.getFixedT(i18n.language);
  const html = generateCollectionReportHTML(
    result.collection.name,
    objectsData,
    institutionName,
    t,
    result.collection.description,
    colors,
  );
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Generates a PDF for multiple objects (batch export) and returns the file URI.
 */
export async function exportBatchToPDF(
  db: SQLiteDatabase,
  objectIds: string[],
  title: string,
  colors: ColorPalette,
): Promise<string> {
  const institutionName = await getSetting(db, SETTING_KEYS.INSTITUTION_NAME);

  const objectsData: ObjectExportData[] = [];
  for (const id of objectIds) {
    const data = await loadObjectExportData(db, id, institutionName, colors);
    if (data) objectsData.push(data);
  }

  const t = i18n.getFixedT(i18n.language);
  const html = generateCollectionReportHTML(title, objectsData, institutionName, t, undefined, colors);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Opens the native share sheet for a PDF file.
 */
export async function sharePDF(pdfUri: string): Promise<void> {
  await Sharing.shareAsync(pdfUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}
