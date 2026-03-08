import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { SQLiteDatabase } from 'expo-sqlite';
import i18n from 'i18next';

import { initDatabase } from '../db/database';
import { DatabaseProvider } from '../contexts/DatabaseContext';
import { MainTabs } from '../navigation/MainTabs';
import { getSetting, SETTING_KEYS } from '../services/settingsService';
import { OnboardingScreen } from '../screens/OnboardingScreen';

export default function AppShell() {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

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
      })
      .catch((err) => setError(String(err)));
  }, []);

  const handleOnboardingFinish = useCallback(() => {
    setOnboardingComplete(true);
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#74B9FF" />
        <Text style={styles.loading}>aha! Register</Text>
      </View>
    );
  }

  return (
    <DatabaseProvider db={db}>
      {onboardingComplete ? (
        <NavigationContainer>
          <MainTabs />
        </NavigationContainer>
      ) : (
        <OnboardingScreen onFinish={handleOnboardingFinish} />
      )}
    </DatabaseProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#08080F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    color: '#74B9FF',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600',
  },
  error: { color: '#FF6B6B', fontSize: 16, textAlign: 'center', padding: 24 },
});
