import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors as darkColors, lightColors, type ColorPalette } from './index';

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
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  // Load saved preference
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((val) => {
        if (val === 'light' || val === 'dark' || val === 'system') {
          setPreferenceState(val);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    SecureStore.setItemAsync(STORAGE_KEY, pref).catch(() => {});
  }, []);

  const mode: ThemeMode = useMemo(() => {
    if (preference === 'system') return systemScheme === 'light' ? 'light' : 'dark';
    return preference;
  }, [preference, systemScheme]);

  const resolvedColors = useMemo(
    () => (mode === 'light' ? lightColors : darkColors),
    [mode],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: resolvedColors, mode, preference, setPreference }),
    [resolvedColors, mode, preference, setPreference],
  );

  // Don't render until we've loaded the preference to avoid flash
  if (!loaded) return null;

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
