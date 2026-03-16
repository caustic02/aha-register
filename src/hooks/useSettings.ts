import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage keys ─────────────────────────────────────────────────────────────

export const SETTINGS_KEYS = {
  AI_ANALYSIS_ENABLED: 'settings.aiAnalysisEnabled',
  SHOW_CONFIDENCE_SCORES: 'settings.showConfidenceScores',
  COLLECTION_DOMAIN: 'settings.collectionDomain',
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type CollectionDomain =
  | 'museum_collection'
  | 'archaeological_site'
  | 'conservation_lab'
  | 'natural_history'
  | 'human_rights'
  | 'general';

interface SettingsState {
  aiAnalysisEnabled: boolean;
  showConfidenceScores: boolean;
  collectionDomain: CollectionDomain;
  /** false until AsyncStorage has been read on first mount */
  loaded: boolean;
}

const DEFAULTS: Omit<SettingsState, 'loaded'> = {
  aiAnalysisEnabled: true,
  showConfidenceScores: true,
  collectionDomain: 'general',
};

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Reads and writes AI and domain settings via AsyncStorage.
 * Other screens (capture flow, review card) can import this hook to check
 * whether AI processing and confidence display are enabled.
 *
 * Keys: see SETTINGS_KEYS.
 */
export function useSettings() {
  const [state, setState] = useState<SettingsState>({
    ...DEFAULTS,
    loaded: false,
  });

  useEffect(() => {
    async function load() {
      try {
        const [ai, confidence, domain] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEYS.AI_ANALYSIS_ENABLED),
          AsyncStorage.getItem(SETTINGS_KEYS.SHOW_CONFIDENCE_SCORES),
          AsyncStorage.getItem(SETTINGS_KEYS.COLLECTION_DOMAIN),
        ]);
        setState({
          aiAnalysisEnabled:
            ai !== null ? ai === 'true' : DEFAULTS.aiAnalysisEnabled,
          showConfidenceScores:
            confidence !== null
              ? confidence === 'true'
              : DEFAULTS.showConfidenceScores,
          collectionDomain:
            (domain as CollectionDomain | null) ?? DEFAULTS.collectionDomain,
          loaded: true,
        });
      } catch {
        setState((prev) => ({ ...prev, loaded: true }));
      }
    }
    load();
  }, []);

  const setAIAnalysisEnabled = useCallback(async (value: boolean) => {
    setState((prev) => ({ ...prev, aiAnalysisEnabled: value }));
    await AsyncStorage.setItem(SETTINGS_KEYS.AI_ANALYSIS_ENABLED, String(value));
  }, []);

  const setShowConfidenceScores = useCallback(async (value: boolean) => {
    setState((prev) => ({ ...prev, showConfidenceScores: value }));
    await AsyncStorage.setItem(
      SETTINGS_KEYS.SHOW_CONFIDENCE_SCORES,
      String(value),
    );
  }, []);

  const setCollectionDomain = useCallback(async (domain: CollectionDomain) => {
    setState((prev) => ({ ...prev, collectionDomain: domain }));
    await AsyncStorage.setItem(SETTINGS_KEYS.COLLECTION_DOMAIN, domain);
  }, []);

  return {
    ...state,
    setAIAnalysisEnabled,
    setShowConfidenceScores,
    setCollectionDomain,
  };
}
