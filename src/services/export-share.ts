import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// ── Filename helpers ──────────────────────────────────────────────────────────

function sanitize(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildExportFilename(
  objectTitle: string,
  ext: 'pdf' | 'json' | 'csv',
): string {
  return `aha-register-${sanitize(objectTitle)}-${todayStamp()}.${ext}`;
}

// ── Share ─────────────────────────────────────────────────────────────────────

/**
 * Writes string content to a temporary file and opens the native share sheet.
 * For PDF exports, pass the file URI directly as `content` and set `isPdfUri`
 * to true — no temp file is needed since expo-print already wrote one.
 */
export async function shareExport(
  content: string,
  filename: string,
  mimeType: string,
  isPdfUri = false,
): Promise<void> {
  if (isPdfUri) {
    await Sharing.shareAsync(content, { mimeType, UTI: 'com.adobe.pdf' });
    return;
  }

  const filePath = `${Paths.cache.uri}${filename}`;
  const file = new File(filePath);
  const encoder = new TextEncoder();
  file.write(encoder.encode(content));
  await Sharing.shareAsync(filePath, { mimeType });
}
