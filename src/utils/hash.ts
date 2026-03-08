import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

/**
 * Reads a file and returns its SHA-256 hash as a hex string.
 * Hashes the raw bytes of the file at the given URI — matches
 * sha256sum / openssl dgst output on the same file.
 */
export async function computeSHA256(filePath: string): Promise<string> {
  const file = new File(filePath);
  const base64 = await file.base64();

  // Decode base64 to raw bytes so we hash actual file content, not the
  // base64 string representation.
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Crypto.digest hashes raw bytes (BufferSource), unlike digestStringAsync
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytes,
  );

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
