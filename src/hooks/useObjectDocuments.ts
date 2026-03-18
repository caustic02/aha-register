/**
 * Hook to fetch document scan media for an object.
 *
 * Groups raw scans with their deskewed derivatives by parent_media_id.
 * Returns one entry per raw scan, with the deskewed URI for display
 * and the raw scan's OCR data.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useDatabase } from '../contexts/DatabaseContext';
import type { Media, OcrSource } from '../db/types';

export interface DocumentEntry {
  /** Raw scan media ID (evidence record with SHA-256 hash) */
  rawMediaId: string;
  /** Deskewed media ID (derivative, for display) */
  deskewedMediaId: string | null;
  /** URI for display: deskewed if available, otherwise raw */
  displayUri: string;
  /** OCR text from the raw scan record */
  ocrText: string | null;
  /** OCR confidence (0–100) */
  ocrConfidence: number | null;
  /** OCR source: 'none' | 'on_device' | 'cloud' */
  ocrSource: OcrSource;
  /** When the scan was created */
  createdAt: string;
}

export function useObjectDocuments(objectId: string) {
  const db = useDatabase();
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await db.getAllAsync<Media>(
        `SELECT * FROM media
         WHERE object_id = ? AND media_type IN ('document_scan', 'document_deskewed')
         ORDER BY created_at DESC`,
        [objectId],
      );

      // Group: raw scans are parents, deskewed are children
      const rawScans = rows.filter((r) => r.media_type === 'document_scan');
      const deskewed = rows.filter((r) => r.media_type === 'document_deskewed');

      const entries: DocumentEntry[] = rawScans.map((raw) => {
        const deskewedMedia = deskewed.find(
          (d) => d.parent_media_id === raw.id,
        );
        return {
          rawMediaId: raw.id,
          deskewedMediaId: deskewedMedia?.id ?? null,
          displayUri: deskewedMedia?.file_path ?? raw.file_path,
          ocrText: raw.ocr_text ?? null,
          ocrConfidence: raw.ocr_confidence ?? null,
          ocrSource: (raw.ocr_source as OcrSource) ?? 'none',
          createdAt: raw.created_at,
        };
      });

      setDocuments(entries);
    } finally {
      setLoading(false);
    }
  }, [db, objectId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { documents, loading, refresh };
}
