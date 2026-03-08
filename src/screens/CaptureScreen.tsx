import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';

export function CaptureScreen() {
  useDatabase(); // verify DB access
  const { t } = useAppTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{'\u2295'}</Text>
      <Text style={styles.title}>{t('capture.take_photo')}</Text>
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
  icon: { color: '#74B9FF', fontSize: 48, marginBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
});
