import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing } from '../theme';
import { NavigationContainer } from '@react-navigation/native';
import type { SQLiteDatabase } from 'expo-sqlite';
import i18n from 'i18next';

import { initDatabase } from '../db/database';
import { DatabaseProvider } from '../contexts/DatabaseContext';
import { MainTabs } from '../navigation/MainTabs';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { getSetting, setSetting, SETTING_KEYS } from '../services/settingsService';
import { getSession, onAuthStateChange } from '../services/auth';
import { ensureMigrated } from '../services/supabase';
import { SyncEngine } from '../sync/engine';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { AuthScreen } from '../screens/AuthScreen';
import TrustScreen from '../screens/TrustScreen';

export default function AppShell() {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [showTrust, setShowTrust] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const syncEngineRef = useRef<SyncEngine | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const [mainTabsKey, setMainTabsKey] = useState(0);

  useEffect(() => {
    if (!authenticated) return;

    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current === 'background' && next === 'active') {
        setMainTabsKey((k) => k + 1);
      }
      appStateRef.current = next;
    });

    return () => sub.remove();
  }, [authenticated]);

  useEffect(() => {
    initDatabase()
      .then(async (database) => {
        const [savedLang, obComplete] = await Promise.all([
          getSetting(database, SETTING_KEYS.LANGUAGE),
          getSetting(database, SETTING_KEYS.ONBOARDING_COMPLETE),
        ]);
        if (savedLang) {
          i18n.changeLanguage(savedLang);
        }
        setOnboardingComplete(obComplete === 'true');
        setDb(database);

        // Ensure auth tokens migrated from AsyncStorage → SecureStore
        await ensureMigrated();

        // Check existing auth session
        const session = await getSession();
        if (session) {
          setAuthenticated(true);
          // Start auto-sync
          const engine = new SyncEngine(database);
          engine.startAutoSync();
          engine.triggerSync();
          syncEngineRef.current = engine;
        }
        setAuthChecked(true);
      })
      .catch((err) => setError(String(err)));
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (!db) return;

    const subscription = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setAuthenticated(true);
        if (!syncEngineRef.current) {
          const engine = new SyncEngine(db);
          engine.startAutoSync();
          engine.triggerSync();
          syncEngineRef.current = engine;
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthenticated(false);
        syncEngineRef.current?.stopAutoSync();
        syncEngineRef.current = null;
      }
    });

    return () => {
      subscription.unsubscribe();
      syncEngineRef.current?.stopAutoSync();
    };
  }, [db]);

  /** Slides done → advance to TrustScreen */
  const handleSlidesComplete = useCallback(() => {
    setShowTrust(true);
  }, []);

  /** Skip from slides → bypass TrustScreen, go directly to SignIn */
  const handleSkipToSignIn = useCallback(async () => {
    if (db) await setSetting(db, SETTING_KEYS.ONBOARDING_COMPLETE, 'true');
    setOnboardingComplete(true);
  }, [db]);

  /** TrustScreen Continue or Skip → advance to SignIn */
  const handleTrustAdvance = useCallback(async () => {
    if (db) await setSetting(db, SETTING_KEYS.ONBOARDING_COMPLETE, 'true');
    setOnboardingComplete(true);
  }, [db]);

  const handleAuthenticated = useCallback(() => {
    setAuthenticated(true);
  }, []);

  const handleSkipAuth = useCallback(() => {
    // User skips auth — sync stays disabled, app works locally
    setAuthenticated(true); // allow entry to main app
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!db || !authChecked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loading}>aha! Register</Text>
      </View>
    );
  }

  return (
    <DatabaseProvider db={db}>
      {!onboardingComplete && !showTrust ? (
        <OnboardingScreen
          onFinish={handleSlidesComplete}
          onSkip={handleSkipToSignIn}
        />
      ) : !onboardingComplete && showTrust ? (
        <TrustScreen
          onContinue={handleTrustAdvance}
          onSkip={handleTrustAdvance}
        />
      ) : !authenticated ? (
        <AuthScreen
          onAuthenticated={handleAuthenticated}
          onSkip={handleSkipAuth}
        />
      ) : (
        <NavigationContainer>
          <SyncStatusBar />
          <MainTabs key={mainTabsKey} />
        </NavigationContainer>
      )}
    </DatabaseProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    color: colors.accent,
    fontSize: typography.size.lg,
    marginTop: spacing.lg,
    fontWeight: typography.weight.semibold,
  },
  error: { color: colors.danger, fontSize: typography.size.base, textAlign: 'center', padding: spacing.xxl },
});
