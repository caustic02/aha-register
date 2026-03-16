import * as Crypto from 'expo-crypto';
import { SecureStorage } from './secure-storage';

const DB_KEY_STORAGE_KEY = 'register_db_encryption_key';

/**
 * Returns the database encryption key, generating one on first use.
 * The 256-bit key is stored in hardware-backed secure storage
 * (iOS Keychain / Android Keystore) and persists across app updates.
 *
 * If the key is lost (e.g. device wipe), the encrypted database is
 * unrecoverable. This is an inherent property of device-level encryption.
 */
export async function getOrCreateDatabaseKey(): Promise<string> {
  const existingKey = await SecureStorage.getItem(DB_KEY_STORAGE_KEY);
  if (existingKey) {
    return existingKey;
  }

  // Generate 32 random bytes (256 bits), hex-encode → 64-char string
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(new Uint8Array(randomBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await SecureStorage.setItem(DB_KEY_STORAGE_KEY, key);
  return key;
}
