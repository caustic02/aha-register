import * as Crypto from 'expo-crypto';

/** Returns a UUID v4 string using expo-crypto. */
export function generateId(): string {
  return Crypto.randomUUID();
}
