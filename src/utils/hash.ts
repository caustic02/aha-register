import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

/**
 * Reads a file from the given path and returns its SHA-256 hash as a hex string.
 * Used at capture time to populate media.sha256_hash.
 */
export async function computeSHA256(filePath: string): Promise<string> {
  const file = new File(filePath);
  const base64 = await file.base64();

  // Hash the base64-encoded content with SHA-256
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );

  return base64ToHex(digest);
}

function base64ToHex(base64: string): string {
  const binary = atob(base64);
  return Array.from(binary)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}
