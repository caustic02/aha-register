import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { AuditTrailEntry, RegisterObject } from '../db/types';
import { getMediaForObject } from './mediaService';
import { getCollectionsForObject, getCollectionById } from './collectionService';
import { getSetting, SETTING_KEYS } from './settingsService';
import {
  type MediaWithBase64,
  type ObjectExportData,
} from './exportTemplate';
import { generateObjectReportHTML } from '../templates/object-report';
import { generateCollectionReportHTML } from '../templates/collection-report';

async function loadObjectExportData(
  db: SQLiteDatabase,
  objectId: string,
  institutionName: string | null,
): Promise<ObjectExportData | null> {
  const obj = await db.getFirstAsync<RegisterObject>(
    'SELECT * FROM objects WHERE id = ?',
    [objectId],
  );
  if (!obj) return null;

  const [mediaRows, auditTrail, collections] = await Promise.all([
    getMediaForObject(db, objectId),
    db.getAllAsync<AuditTrailEntry>(
      'SELECT * FROM audit_trail WHERE record_id = ? ORDER BY created_at ASC',
      [objectId],
    ),
    getCollectionsForObject(db, objectId),
  ]);

  // Convert media files to base64 for embedding in HTML
  const media: MediaWithBase64[] = [];
  for (const m of mediaRows) {
    try {
      const file = new File(m.file_path);
      const base64Data = await file.base64();
      media.push({ ...m, base64Data });
    } catch {
      // File missing — skip this media item
    }
  }

  return { object: obj, media, auditTrail, collections, institutionName };
}

/**
 * Generates a PDF for a single object and returns the file URI.
 */
export async function exportObjectToPDF(
  db: SQLiteDatabase,
  objectId: string,
): Promise<string> {
  const institutionName = await getSetting(db, SETTING_KEYS.INSTITUTION_NAME);
  const data = await loadObjectExportData(db, objectId, institutionName);
  if (!data) throw new Error('Object not found');

  const html = generateObjectReportHTML(data);
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
): Promise<string> {
  const result = await getCollectionById(db, collectionId);
  if (!result) throw new Error('Collection not found');

  const institutionName = await getSetting(db, SETTING_KEYS.INSTITUTION_NAME);

  const objectsData: ObjectExportData[] = [];
  for (const obj of result.objects) {
    const data = await loadObjectExportData(db, obj.id, institutionName);
    if (data) objectsData.push(data);
  }

  const html = generateCollectionReportHTML(
    result.collection.name,
    objectsData,
    institutionName,
    result.collection.description,
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
): Promise<string> {
  const institutionName = await getSetting(db, SETTING_KEYS.INSTITUTION_NAME);

  const objectsData: ObjectExportData[] = [];
  for (const id of objectIds) {
    const data = await loadObjectExportData(db, id, institutionName);
    if (data) objectsData.push(data);
  }

  const html = generateCollectionReportHTML(title, objectsData, institutionName);
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
