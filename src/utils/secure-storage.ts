import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureError } from './sentry';

// Secure storage for sensitive data (tokens, credentials, API keys).
// Uses iOS Keychain / Android Keystore (hardware-backed encryption).

export const SecureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStore read failed for key: ${key}`, error);
      if (error instanceof Error) captureError(error, { op: 'secureStore.read', key });
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`SecureStore write failed for key: ${key}`, error);
      if (error instanceof Error) captureError(error, { op: 'secureStore.write', key });
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`SecureStore delete failed for key: ${key}`, error);
      if (error instanceof Error) captureError(error, { op: 'secureStore.delete', key });
    }
  },
};

/**
 * One-time migration of Supabase auth tokens from AsyncStorage (plaintext)
 * to SecureStore (hardware-encrypted). Safe to call multiple times — exits
 * immediately once the migration flag is set.
 */
export async function migrateAuthTokens(): Promise<void> {
  const MIGRATION_FLAG = '_auth_storage_migrated';

  const migrated = await SecureStorage.getItem(MIGRATION_FLAG);
  if (migrated) return;

  // Supabase v2 uses `sb-<project-ref>-auth-token` as the storage key.
  // The legacy GoTrueClient default was `supabase.auth.token`.
  const legacyKeys = [
    'sb-fdwmfijtpknwaesyvzbg-auth-token',
    'supabase.auth.token',
  ];

  for (const key of legacyKeys) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        await SecureStorage.setItem(key, value);
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Old storage key might not exist — that's fine
    }
  }

  await SecureStorage.setItem(MIGRATION_FLAG, 'true');
}
