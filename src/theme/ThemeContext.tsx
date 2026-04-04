import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
// import { useColorScheme } from 'react-native'; // re-enable when light mode is ready
import * as SecureStore from 'expo-secure-store';
// lightColors kept in index.ts for future use — not imported until light mode is enabled
import { colors as darkColors, type ColorPalette } from './index';

// ── Types ────────────────────────────────────────────────────────────────────

export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  colors: ColorPalette;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const STORAGE_KEY = 'theme_preference';

// ── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  mode: 'dark',
  preference: 'system',
  setPreference: () => {},
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // const systemScheme = useColorScheme(); // re-enable when light mode is ready
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Load saved preference (non-blocking — app renders immediately with default)
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((val) => {
        if (val === 'light' || val === 'dark' || val === 'system') {
          setPreferenceState(val);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    SecureStore.setItemAsync(STORAGE_KEY, pref).catch(() => {});
  }, []);

  // Force dark mode until all screens are converted to useTheme()
  const mode: ThemeMode = 'dark';

  const resolvedColors = useMemo(
    () => darkColors,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: resolvedColors, mode, preference, setPreference }),
    [resolvedColors, mode, preference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
