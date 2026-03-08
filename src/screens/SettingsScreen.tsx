import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';

const APP_VERSION = '0.1.0';

export function SettingsScreen() {
  useDatabase(); // verify DB access
  const { t } = useAppTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('common.done')}</Text>
      <Text style={styles.subtitle}>Settings</Text>
      <Text style={styles.version}>v{APP_VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  subtitle: { color: '#636E72', fontSize: 14, marginTop: 8 },
  version: { color: '#636E72', fontSize: 12, marginTop: 16 },
});
