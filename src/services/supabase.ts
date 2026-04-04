import { createClient } from '@supabase/supabase-js';
import { SecureStorage, migrateAuthTokens } from '../utils/secure-storage';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

// Migrate existing plaintext tokens from AsyncStorage → SecureStore.
// This runs once, is idempotent, and is awaited before any auth call
// via ensureMigrated() below.
const migrationPromise = migrateAuthTokens();

// This client uses the anon key and respects RLS policies.
// All queries are scoped to the authenticated user's permissions.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Await this before the first auth operation (e.g. getSession) to ensure
 * tokens have been migrated from AsyncStorage to SecureStore.
 */
export function ensureMigrated(): Promise<void> {
  return migrationPromise;
}
