import type { SQLiteDatabase } from 'expo-sqlite';
import type { AuditTrailEntry } from './types';
import { generateId } from '../utils/uuid';
import { getSession } from '../services/auth';

export type { AuditTrailEntry };

/**
 * Resolves the current user ID for audit logging.
 * Priority: explicit param > Supabase auth session > 'local' fallback.
 */
export async function resolveUserId(userId?: string): Promise<string> {
  if (userId) return userId;
  try {
    const session = await getSession();
    return session?.user?.id ?? 'local';
  } catch {
    return 'local';
  }
}

export interface LogAuditParams {
  tableName: string;
  recordId: string;
  action: string;
  userId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  deviceInfo?: unknown;
  evidenceContext?: unknown;
}

export async function logAuditEntry(
  db: SQLiteDatabase,
  params: LogAuditParams,
): Promise<void> {
  const id = generateId();
  const now = new Date().toISOString();
  const effectiveUserId = await resolveUserId(params.userId);

  await db.runAsync(
    `INSERT INTO audit_trail
       (id, table_name, record_id, action, user_id, old_values, new_values, device_info, evidence_context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.tableName,
      params.recordId,
      params.action,
      effectiveUserId,
      params.oldValues != null ? JSON.stringify(params.oldValues) : null,
      params.newValues != null ? JSON.stringify(params.newValues) : null,
      params.deviceInfo != null ? JSON.stringify(params.deviceInfo) : null,
      params.evidenceContext != null ? JSON.stringify(params.evidenceContext) : null,
      now,
    ],
  );
}

export async function getAuditHistory(
  db: SQLiteDatabase,
  recordId: string,
): Promise<AuditTrailEntry[]> {
  return db.getAllAsync<AuditTrailEntry>(
    `SELECT * FROM audit_trail WHERE record_id = ? ORDER BY created_at DESC`,
    [recordId],
  );
}
