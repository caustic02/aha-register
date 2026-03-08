import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';

export function ObjectListScreen() {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM objects').then(
      (row) => setCount(row?.c ?? 0),
    );
  }, [db]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('common.search')}</Text>
      <Text style={styles.count}>{count} objects</Text>
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
  count: { color: '#636E72', fontSize: 14, marginTop: 8 },
});
