import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';

export function CollectionsScreen() {
  useDatabase(); // verify DB access
  const { t } = useAppTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('common.search')}</Text>
      <Text style={styles.subtitle}>Collections</Text>
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
});
