/**
 * Four-tier image pipeline for the capture flow.
 *
 * Every captured image produces four variants stored under media/{uuid}/:
 *   1. archival  — original bytes (provenance record, SHA-256 source)
 *   2. working   — 1536 px longest edge, JPEG 0.85 (UI display, sync, AI)
 *   3. preview   — 800 px longest edge, JPEG 0.80  (detail hero, PDF inline, AI)
 *   4. thumb     — 256 px longest edge, JPEG 0.70  (cards, lists, search results)
 *
 * Processing order: original → archival copy → working → preview → thumb
 * (cascade downward = faster than resizing from original each time).
 *
 * This is the SINGLE SOURCE OF TRUTH for image downscaling.
 */
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import { computeSHA256 } from './hash';
import { generateId } from './uuid';

// ── Tier constants ───────────────────────────────────────────────────────────

const TIERS = {
  working: { maxDimension: 1536, quality: 0.85 },
  preview: { maxDimension: 800, quality: 0.80 },
  thumb:   { maxDimension: 256, quality: 0.70 },
} as const;

/** Minimum free disk space (bytes) to produce all four tiers. Below this,
 *  only archival is created and used for every tier. */
const MIN_DISK_SPACE_BYTES = 50 * 1024 * 1024; // 50 MB

/** Maximum time for the entire resize cascade before falling back to archival. */
const RESIZE_TIMEOUT_MS = 15_000;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImageVariant {
  uri: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ImagePipelineResult {
  uuid: string;
  thumb: ImageVariant;
  preview: ImageVariant;
  working: ImageVariant;
  archival: ImageVariant & { hash: string };
}

/** Subset threaded through to service-layer INSERT calls. */
export interface ArchivalData {
  archivalUri: string;
  sha256Hash: string;
  originalFileSize: number;
}

/** Tier URIs for service-layer INSERT calls. */
export interface ImageTierData {
  thumbnailUri: string;
  previewUri: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resizeOp(w: number, h: number, maxDim: number) {
  const isPortrait = h > w;
  return isPortrait
    ? { resize: { height: maxDim } }
    : { resize: { width: maxDim } };
}

async function resizeTier(
  sourceUri: string,
  sourceWidth: number,
  sourceHeight: number,
  tier: { maxDimension: number; quality: number },
): Promise<ImageVariant> {
  const op = resizeOp(sourceWidth, sourceHeight, tier.maxDimension);
  const result = await manipulateAsync(sourceUri, [op], {
    compress: tier.quality,
    format: SaveFormat.JPEG,
  });
  const file = new File(result.uri);
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    sizeBytes: file.size ?? 0,
  };
}

/** Move a temp file into the permanent media/{uuid}/ directory. */
function moveToSlot(tempUri: string, uuid: string, name: string): string {
  const dir = `${Paths.document.uri}media/${uuid}/`;
  const destUri = `${dir}${name}`;
  const src = new File(tempUri);
  const dest = new File(destUri);
  const parentDir = dest.parentDirectory;
  if (!parentDir.exists) {
    parentDir.create({ intermediates: true, idempotent: true });
  }
  src.move(dest);
  return destUri;
}

/** Check if free disk space is below the safety threshold. */
async function isLowDiskSpace(): Promise<boolean> {
  try {
    const free = await FileSystem.getFreeDiskStorageAsync();
    return free < MIN_DISK_SPACE_BYTES;
  } catch {
    return false; // can't check → assume OK
  }
}

/** Verify a file exists on disk. Returns false if missing or unreadable. */
function fileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Process a camera capture into four tiers.
 *
 * 1. Check disk space — if low, skip resize tiers
 * 2. Copy/move original → archival (preserves unmodified bytes)
 * 3. Hash archival copy (provenance record)
 * 4. Cascade resize: archival → working → preview → thumb (with timeout)
 * 5. Validate all tier files exist on disk
 *
 * If any step fails, falls back gracefully so the capture flow is never blocked.
 */
export async function processCapture(
  originalUri: string,
  originalWidth?: number,
  originalHeight?: number,
): Promise<ImagePipelineResult> {
  const uuid = generateId();
  const w = originalWidth ?? 0;
  const h = originalHeight ?? 0;

  // ── 1. Disk space guard ────────────────────────────────────────────────
  const lowDisk = await isLowDiskSpace();
  if (lowDisk) {
    console.warn('[image-processing] low disk space — skipping resize tiers');
  }

  // ── 2. Copy/move original to archival slot ─────────────────────────────
  let archivalUri: string;
  let originalSize: number;
  try {
    archivalUri = moveToSlot(originalUri, uuid, 'archival.jpg');
    const archivalFile = new File(archivalUri);
    if (!archivalFile.exists) {
      throw new Error('archival file missing after move');
    }
    originalSize = archivalFile.size ?? 0;
  } catch {
    // Move failed — fall back to copy
    try {
      const dir = `${Paths.document.uri}media/${uuid}/`;
      archivalUri = `${dir}archival.jpg`;
      const srcFile = new File(originalUri);
      const destFile = new File(archivalUri);
      const parentDir = destFile.parentDirectory;
      if (!parentDir.exists) {
        parentDir.create({ intermediates: true, idempotent: true });
      }
      srcFile.copy(destFile);
      originalSize = destFile.size ?? 0;
    } catch (copyErr) {
      console.warn('[image-processing] archival copy failed, using original URI:', copyErr);
      archivalUri = originalUri;
      const f = new File(originalUri);
      originalSize = f.size ?? 0;
    }
  }

  // ── 3. Hash the archival (original) copy ───────────────────────────────
  const hash = await computeSHA256(archivalUri);

  // ── 4. Cascade resize with timeout + disk guard ────────────────────────
  const archivalFallback: ImageVariant = { uri: archivalUri, width: w, height: h, sizeBytes: originalSize };
  let working: ImageVariant = archivalFallback;
  let preview: ImageVariant = archivalFallback;
  let thumb: ImageVariant = archivalFallback;

  if (!lowDisk) {
    try {
      const resizeWork = async (): Promise<{ working: ImageVariant; preview: ImageVariant; thumb: ImageVariant }> => {
        const workingTemp = await resizeTier(archivalUri, w, h, TIERS.working);
        const workingUri = moveToSlot(workingTemp.uri, uuid, 'working.jpg');
        const wk: ImageVariant = { ...workingTemp, uri: workingUri };

        const previewTemp = await resizeTier(wk.uri, wk.width, wk.height, TIERS.preview);
        const previewUri = moveToSlot(previewTemp.uri, uuid, 'preview.jpg');
        const pv: ImageVariant = { ...previewTemp, uri: previewUri };

        const thumbTemp = await resizeTier(pv.uri, pv.width, pv.height, TIERS.thumb);
        const thumbUri = moveToSlot(thumbTemp.uri, uuid, 'thumb.jpg');
        const th: ImageVariant = { ...thumbTemp, uri: thumbUri };

        return { working: wk, preview: pv, thumb: th };
      };

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('resize cascade timed out')), RESIZE_TIMEOUT_MS),
      );

      const result = await Promise.race([resizeWork(), timeout]);
      working = result.working;
      preview = result.preview;
      thumb = result.thumb;
    } catch (err) {
      console.warn('[image-processing] resize cascade failed, using archival for all tiers:', err);
      // working/preview/thumb already set to archivalFallback
    }
  }

  // ── 5. Validate tier files exist on disk ───────────────────────────────
  // If any tier file is missing (silent write failure), cascade fallback.
  if (!fileExists(working.uri)) {
    console.warn('[image-processing] working file missing, falling back to archival');
    working = archivalFallback;
  }
  if (!fileExists(preview.uri)) {
    console.warn('[image-processing] preview file missing, falling back to working');
    preview = fileExists(working.uri) ? working : archivalFallback;
  }
  if (!fileExists(thumb.uri)) {
    console.warn('[image-processing] thumb file missing, falling back to preview');
    thumb = fileExists(preview.uri) ? preview : archivalFallback;
  }

  console.log(
    '[image-processing] pipeline:',
    `archival=${(originalSize / 1024).toFixed(0)}KB`,
    `working=${(working.sizeBytes / 1024).toFixed(0)}KB`,
    `preview=${(preview.sizeBytes / 1024).toFixed(0)}KB`,
    `thumb=${(thumb.sizeBytes / 1024).toFixed(0)}KB`,
    lowDisk ? '(low-disk mode)' : '',
  );

  return {
    uuid,
    thumb,
    preview,
    working,
    archival: { uri: archivalUri, width: w, height: h, sizeBytes: originalSize, hash },
  };
}
