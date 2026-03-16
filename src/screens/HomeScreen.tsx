import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  Card,
  Divider,
  EmptyState,
  ListItem,
  SectionHeader,
} from '../components/ui';
import {
  AddPhotoIcon,
  ObjectsTabIcon,
  SyncIcon,
} from '../theme/icons';
import { colors, spacing, typography } from '../theme';
import { formatRelativeDate } from '../utils/format-date';
import type { HomeStackParamList } from '../navigation/HomeStack';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

interface Stats {
  totalObjects: number;
  pendingSync: number;
  totalPhotos: number;
}

interface RecentObject {
  id: string;
  title: string;
  object_type: string;
  created_at: string;
  file_path: string | null;
}

interface TypeCount {
  object_type: string;
  count: number;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <Card style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

// ── Type Card ─────────────────────────────────────────────────────────────────

interface TypeCardProps {
  label: string;
  count: number;
}

function TypeCard({ label, count }: TypeCardProps) {
  return (
    <Card style={styles.typeCard}>
      <Text style={styles.typeCount}>{count}</Text>
      <Text style={styles.typeLabel} numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [stats, setStats] = useState<Stats>({
    totalObjects: 0,
    pendingSync: 0,
    totalPhotos: 0,
  });
  const [recent, setRecent] = useState<RecentObject[]>([]);
  const [byType, setByType] = useState<TypeCount[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [totalRow, syncRow, photoRow, recentRows, typeRows] =
        await Promise.all([
          db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM objects',
          ),
          db
            .getFirstAsync<{ count: number }>(
              "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'",
            )
            .catch((): { count: number } => ({ count: 0 })),
          db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM media',
          ),
          db.getAllAsync<RecentObject>(
            `SELECT o.id, o.title, o.object_type, o.created_at, m.file_path
             FROM objects o
             LEFT JOIN media m ON m.object_id = o.id AND m.is_primary = 1
             ORDER BY o.created_at DESC
             LIMIT 5`,
          ),
          db.getAllAsync<TypeCount>(
            'SELECT object_type, COUNT(*) as count FROM objects GROUP BY object_type ORDER BY count DESC',
          ),
        ]);

      setStats({
        totalObjects: totalRow?.count ?? 0,
        pendingSync: syncRow?.count ?? 0,
        totalPhotos: photoRow?.count ?? 0,
      });
      setRecent(recentRows);
      setByType(typeRows);
    } catch {
      // Silently ignore; state stays at defaults
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData]),
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Sync status banner ──────────────────────────────────────────────── */}
      {!loading && stats.pendingSync > 0 && (
        <View style={styles.syncBanner}>
          <SyncIcon size={14} color={colors.warning} />
          <Text style={styles.syncBannerText}>
            {t('home.pendingSyncBanner', { count: stats.pendingSync })}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('home.title')}</Text>
          {!loading && (
            <Text style={styles.headerSubtitle}>
              {t('home.objectCount', { count: stats.totalObjects })}
            </Text>
          )}
        </View>

        {/* ── 2. Quick stats ───────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            icon={<ObjectsTabIcon size={20} color={colors.primary} />}
            value={stats.totalObjects}
            label={t('home.statObjects')}
          />
          <StatCard
            icon={
              <SyncIcon
                size={20}
                color={
                  stats.pendingSync > 0 ? colors.warning : colors.textTertiary
                }
              />
            }
            value={stats.pendingSync}
            label={t('home.statPending')}
          />
          <StatCard
            icon={<AddPhotoIcon size={20} color={colors.textTertiary} />}
            value={stats.totalPhotos}
            label={t('home.statPhotos')}
          />
        </View>

        <Divider />

        {/* ── 3. Recent captures ───────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <SectionHeader title={t('home.recentCaptures')} />
        </View>
        {!loading && recent.length === 0 ? (
          <View style={styles.emptyState}>
            <EmptyState
              icon={<ObjectsTabIcon size={32} color={colors.textTertiary} />}
              title={t('home.emptyTitle')}
              message={t('home.emptyMessage')}
            />
          </View>
        ) : (
          recent.map((item) => (
            <ListItem
              key={item.id}
              title={item.title}
              subtitle={formatRelativeDate(item.created_at)}
              thumbnail={item.file_path ? { uri: item.file_path } : undefined}
              badge={{
                label: t(`object_types.${item.object_type}`),
                variant: 'neutral',
              }}
              onPress={() =>
                navigation.navigate('ObjectDetail', { objectId: item.id })
              }
            />
          ))
        )}

        {/* ── 4. By type ───────────────────────────────────────────────────── */}
        {byType.length > 0 && (
          <>
            <Divider />
            <View style={styles.sectionHeader}>
              <SectionHeader title={t('home.byType')} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeScrollContent}
            >
              {byType.map((tc) => (
                <TypeCard
                  key={tc.object_type}
                  label={t(`object_types.${tc.object_type}`)}
                  count={tc.count}
                />
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Sync banner
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.warningLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  syncBannerText: {
    ...typography.caption,
    color: colors.warning,
  },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.sm },
  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  statIcon: {
    marginBottom: 2,
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Section header wrapper
  sectionHeader: {
    paddingHorizontal: spacing.lg,
  },
  // Empty state
  emptyState: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  // Type scroll
  typeScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  typeCard: {
    width: 96,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  typeCount: {
    ...typography.h3,
    color: colors.primary,
  },
  typeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
