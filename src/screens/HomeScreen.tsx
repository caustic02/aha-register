import React, { useCallback, useState } from 'react';
import {
  Pressable,
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
  EmptyState,
  ListItem,
  SectionHeader,
} from '../components/ui';
import {
  CaptureTabIcon,
  ClockIcon,
  DownloadIcon,
  FilterIcon,
  ObjectsTabIcon,
  PackageIcon,
  PhotoIcon,
  SyncIcon,
} from '../theme/icons';
import { colors, radii, spacing, touch, typography } from '../theme';
import { SkeletonList, SkeletonLoader } from '../components/SkeletonLoader';
import { formatRelativeDate } from '../utils/format-date';
import { getSetting, SETTING_KEYS } from '../services/settingsService';
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
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [totalRow, syncRow, photoRow, recentRows, instName] =
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
          getSetting(db, SETTING_KEYS.INSTITUTION_NAME),
        ]);

      setStats({
        totalObjects: totalRow?.count ?? 0,
        pendingSync: syncRow?.count ?? 0,
        totalPhotos: photoRow?.count ?? 0,
      });
      setRecent(recentRows);
      setInstitutionName(instName);
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

  const navigateToCapture = useCallback(() => {
    navigation.getParent()?.navigate('Capture');
  }, [navigation]);

  const navigateToCollection = useCallback(() => {
    navigation.getParent()?.navigate('Collections');
  }, [navigation]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {t('home.title')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {institutionName || t('home.personalCollection')}
          </Text>
        </View>

        {/* ── 2. Sync Status Bar (conditional) ───────────────────────────── */}
        {!loading && stats.pendingSync > 0 && (
          <View style={styles.syncBanner}>
            <SyncIcon size={14} color={colors.statusWarning} />
            <Text style={styles.syncBannerText}>
              {t('home.pendingSyncBanner', { count: stats.pendingSync })}
            </Text>
          </View>
        )}

        {/* ── 3. Primary CTA Card ────────────────────────────────────────── */}
        <Pressable
          style={styles.ctaCard}
          onPress={navigateToCapture}
          accessibilityLabel={t('home.captureCtaTitle')}
          accessibilityRole="button"
        >
          <CaptureTabIcon size={spacing['3xl']} color={colors.primary} />
          <View style={styles.ctaTextWrap}>
            <Text style={styles.ctaTitle}>{t('home.captureCtaTitle')}</Text>
            <Text style={styles.ctaSubtitle}>
              {t('home.captureCtaSubtitle')}
            </Text>
          </View>
        </Pressable>

        {/* ── 4. Quick Stats Row ──────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.statsRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.statCard, styles.statCardSkeleton]}>
                <SkeletonLoader width={20} height={20} borderRadius={radii.full} />
                <SkeletonLoader width="70%" height={20} borderRadius={radii.sm} />
                <SkeletonLoader width="50%" height={12} borderRadius={radii.sm} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.statsRow}>
            <Pressable
              style={styles.statCard}
              onPress={navigateToCollection}
              accessibilityLabel={`${stats.totalObjects} ${t('home.statObjects')}`}
              accessibilityRole="button"
            >
              <ObjectsTabIcon size={20} color={colors.primary} />
              <Text style={styles.statValue}>{stats.totalObjects}</Text>
              <Text style={styles.statLabel}>{t('home.statObjects')}</Text>
            </Pressable>

            <View style={styles.statCard}>
              <ClockIcon
                size={20}
                color={stats.pendingSync > 0 ? colors.statusWarning : colors.textTertiary}
              />
              <Text style={styles.statValue}>{stats.pendingSync}</Text>
              <Text style={styles.statLabel}>{t('home.statPending')}</Text>
            </View>

            <View style={styles.statCard}>
              <PhotoIcon size={20} color={colors.textTertiary} />
              <Text style={styles.statValue}>{stats.totalPhotos}</Text>
              <Text style={styles.statLabel}>{t('home.statPhotos')}</Text>
            </View>
          </View>
        )}

        {/* ── 5. Recent Objects ───────────────────────────────────────────── */}
        <View style={styles.sectionWrap}>
          <SectionHeader
            title={t('home.recentCaptures')}
            action={recent.length > 0 ? t('home.viewAll') : undefined}
            onAction={
              recent.length > 0
                ? () => navigation.navigate('ObjectList')
                : undefined
            }
          />
        </View>

        {loading ? (
          <SkeletonList count={3} />
        ) : recent.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<PackageIcon size={spacing['3xl']} color={colors.textTertiary} />}
              title={t('home.emptyTitle')}
              message={t('home.emptyMessage')}
            />
          </View>
        ) : (
          recent.map((item) => (
            <ListItem
              key={item.id}
              title={item.title || t('objects.placeholder_title')}
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

        {/* ── 6. Quick Actions ───────────────────────────────────────────── */}
        {!loading && stats.totalObjects > 0 && (
          <>
            <View style={styles.sectionWrap}>
              <SectionHeader title={t('home.quickActions')} />
            </View>
            <View style={styles.actionsRow}>
              <Pressable
                style={styles.actionCard}
                onPress={navigateToCollection}
                accessibilityLabel={t('home.exportCollection')}
                accessibilityRole="button"
              >
                <DownloadIcon size={20} color={colors.primary} />
                <Text style={styles.actionLabel}>
                  {t('home.exportCollection')}
                </Text>
              </Pressable>
              <Pressable
                style={styles.actionCard}
                onPress={navigateToCollection}
                accessibilityLabel={t('home.browseByType')}
                accessibilityRole="button"
              >
                <FilterIcon size={20} color={colors.primary} />
                <Text style={styles.actionLabel}>
                  {t('home.browseByType')}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
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
  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.lg },
  bottomSpacer: { height: spacing.xl },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Sync banner
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radii.sm,
  },
  syncBannerText: {
    ...typography.caption,
    color: colors.statusWarning,
  },

  // Primary CTA
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.ctaSurface,
    borderWidth: 1,
    borderColor: colors.ctaBorder,
    borderRadius: radii.lg,
    minHeight: touch.minTarget,
  },
  ctaTextWrap: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  ctaTitle: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  ctaSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    minHeight: touch.minTarget,
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statCardSkeleton: {
    gap: spacing.xs,
  },

  // Section wrapper
  sectionWrap: {
    paddingHorizontal: spacing.lg,
  },

  // Empty state
  emptyWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  // Quick actions
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    minHeight: touch.minTarget,
  },
  actionLabel: {
    ...typography.bodySmall,
    color: colors.text,
  },
});
