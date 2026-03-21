/**
 * Capture protocol registry.
 *
 * Each protocol is a JSON file defining a sequence of required/optional
 * shots for documenting a specific object type. The capture screen and
 * useCaptureProtocol hook read from here.
 */

import museumPaintingData from './museum_painting.json';
import museumSculptureData from './museum_sculpture.json';
import museumGeneralData from './museum_general.json';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProtocolShot {
  id: string;
  order: number;
  label: string;
  label_de: string;
  instruction: string;
  instruction_de: string;
  required: boolean;
  icon: string;
  tips: string[];
  tips_de: string[];
}

export interface CompletionRules {
  minimum_required: number;
  allow_incomplete_save: boolean;
  incomplete_warning: string;
  incomplete_warning_de: string;
}

export interface CaptureProtocol {
  id: string;
  name: string;
  name_de: string;
  description: string;
  description_de: string;
  version: string;
  domain: string;
  object_types: string[];
  shots: ProtocolShot[];
  completion_rules: CompletionRules;
}

// ── Registry ─────────────────────────────────────────────────────────────────

const PROTOCOLS: Record<string, CaptureProtocol> = {
  museum_painting: museumPaintingData as CaptureProtocol,
  museum_sculpture: museumSculptureData as CaptureProtocol,
  museum_general: museumGeneralData as CaptureProtocol,
};

/**
 * Get a protocol by ID.
 * Returns null if the protocol is not found.
 */
export function getProtocol(id: string): CaptureProtocol | null {
  return PROTOCOLS[id] ?? null;
}

/** All registered protocols. */
export function getAllProtocols(): CaptureProtocol[] {
  return Object.values(PROTOCOLS);
}

/**
 * Get protocols matching a given object type.
 * Returns all protocols whose `object_types` includes the type,
 * plus `museum_general` as a fallback (empty object_types = matches any).
 */
export function getProtocolsForObjectType(objectType: string): CaptureProtocol[] {
  const matches: CaptureProtocol[] = [];
  const seen = new Set<string>();

  for (const protocol of Object.values(PROTOCOLS)) {
    if (protocol.object_types.length > 0 && protocol.object_types.includes(objectType)) {
      matches.push(protocol);
      seen.add(protocol.id);
    }
  }

  // Always include museum_general as a fallback
  if (!seen.has('museum_general') && PROTOCOLS.museum_general) {
    matches.push(PROTOCOLS.museum_general);
  }

  return matches;
}

/** All registered protocol IDs. */
export const AVAILABLE_PROTOCOLS = Object.keys(PROTOCOLS);
