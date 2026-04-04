import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListChecks } from 'lucide-react-native';
import { BackIcon } from '../theme/icons';
import { useDatabase } from '../contexts/DatabaseContext';
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'ChecklistOverview'>;

interface ObjectTaskSummary {
  object_id: string;
  title: string;
  total: number;
  completed: number;
}

export function ChecklistOverviewScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const db = useDatabase();
  const [items, setItems] = useState<ObjectTaskSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      db.getAllAsync<ObjectTaskSummary>(
        `SELECT
           o.id as object_id,
           o.title,
           COUNT(t.id) as total,
           SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed
         FROM objects o
         LEFT JOIN object_tasks t ON t.object_id = o.id
         GROUP BY o.id
         HAVING total > 0
         ORDER BY (completed * 1.0 / total) ASC, o.created_at DESC`,
      ).then(setItems);
    }, [db]),
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back} hitSlop={touch.hitSlop}>
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Checklists</Text>
        <View style={{ width: touch.minTarget }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {items.length === 0 ? (
          <View style={s.empty}>
            <ListChecks size={48} color={colors.textTertiary} />
            <Text style={s.emptyText}>No checklists yet</Text>
            <Text style={s.emptySub}>Open an object to create tasks</Text>
          </View>
        ) : (
          items.map((item) => {
            const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
            return (
              <Pressable
                key={item.object_id}
                style={s.row}
                onPress={() => navigation.navigate('ObjectDetail', { objectId: item.object_id })}
                accessibilityRole="button"
              >
                <View style={s.rowInfo}>
                  <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.rowSub}>{item.completed}/{item.total} tasks</Text>
                </View>
                <View style={s.pctWrap}>
                  <Text style={[s.pct, pct === 100 && s.pctDone]}>{pct}%</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { width: touch.minTarget, height: touch.minTarget, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: typography.weight.semibold, color: c.text },
  content: { padding: spacing.lg, gap: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: spacing['3xl'] },
  emptyText: { fontSize: 16, fontWeight: typography.weight.medium, color: c.text, marginTop: spacing.md },
  emptySub: { fontSize: 13, color: c.textSecondary, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    minHeight: touch.minTarget,
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: typography.weight.medium, color: c.text },
  rowSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  pctWrap: { marginLeft: spacing.md },
  pct: { fontSize: 16, fontWeight: typography.weight.bold, color: c.textSecondary },
  pctDone: { color: c.heroGreen },
}); }
