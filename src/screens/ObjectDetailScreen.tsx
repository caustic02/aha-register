import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { File } from 'expo-file-system';
import { deleteObject, updateReviewStatus } from '../services/objectService';
import type { CaptureMetadata } from '../services/metadata';
import {
  Badge,
  Button,
  Card,
  Divider,
  IconButton,
  MetadataRow,
  SectionHeader,
} from '../components/ui';
import {
  BackIcon,
  DeleteIcon,
  EditIcon,
  ExportIcon,
  ForwardIcon,
  WarningIcon,
} from '../theme/icons';
import { colors, radii, spacing, touch, typography } from '../theme';
import { SkeletonLoader } from '../components/SkeletonLoader';
import type { RegisterObject, Media, ObjectPerson } from '../db/types';
import { ExportStepperModal, type ExportSource } from '../components/ExportStepperModal';
import type { ExportableObject } from '../services/export-service';
import { getDisplayLabel } from '../utils/displayLabels';

// ── Types ─────────────────────────────────────────────────────────────────────

// Minimal param list — any stack with ObjectDetail: { objectId: string } satisfies this.
type ObjectDetailParamList = { ObjectDetail: { objectId: string } };
type Props = NativeStackScreenProps<ObjectDetailParamList, 'ObjectDetail'>;

interface PersonRow extends ObjectPerson {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatCoords(
  lat: number | null,
  lng: number | null,
  acc?: number | null,
): string {
  if (lat == null || lng == null) return '';
  const base = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  return acc != null ? `${base} (\u00b1${acc.toFixed(0)}\u202fm)` : base;
}

function lifespan(birth?: number | null, death?: number | null): string {
  if (birth == null && death == null) return '';
  if (birth != null && death != null) return `${birth}\u2013${death}`;
  if (birth != null) return `b.\u2009${birth}`;
  return `d.\u2009${death}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_BAR_HEIGHT = 64;
const GALLERY_IMG_SIZE = 220;

// ── Component ─────────────────────────────────────────────────────────────────

export function ObjectDetailScreen({ route, navigation }: Props) {
  const { objectId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [object, setObject] = useState<RegisterObject | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [obj, mediaRows, personRows] = await Promise.all([
        db.getFirstAsync<RegisterObject>(
          'SELECT * FROM objects WHERE id = ?',
          [objectId],
        ),
        db.getAllAsync<Media>(
          'SELECT * FROM media WHERE object_id = ? ORDER BY is_primary DESC, sort_order ASC',
          [objectId],
        ),
        db.getAllAsync<PersonRow>(
          `SELECT op.id, op.object_id, op.person_id, op.role, op.display_order,
                  op.notes, op.created_at,
                  p.name, p.birth_year, p.death_year
           FROM object_persons op
           JOIN persons p ON op.person_id = p.id
           WHERE op.object_id = ?
           ORDER BY op.display_order ASC`,
          [objectId],
        ),
      ]);

      setObject(obj ?? null);
      setMedia(mediaRows);
      setPersons(personRows);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [db, objectId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleEdit = () => {
    // TODO: implement edit
  };

  const handleExport = useCallback(() => {
    if (!object) return;
    if (object.legal_hold === 1) {
      Alert.alert(
        t('export.legalHoldTitle'),
        t('export.legalHoldWarning'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('export.legalHoldConfirm'),
            onPress: () => setShowExportModal(true),
          },
        ],
      );
      return;
    }
    setShowExportModal(true);
  }, [object, t]);

  const handleDelete = useCallback(() => {
    if (!object) return;
    Alert.alert(
      t('objects.delete_title'),
      t('objects.delete_confirm', { title: object.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteObject(db, objectId);
              navigation.goBack();
            } catch {
              Alert.alert(t('common.error'));
            }
          },
        },
      ],
    );
  }, [db, navigation, object, objectId, t]);

  const handleStartReview = useCallback(async () => {
    if (!object) return;
    const pm = media.find((m) => m.is_primary === 1) ?? media[0];
    if (!pm) return;
    try {
      // Transition to in_review
      await updateReviewStatus(db, objectId, 'in_review');

      // Build CaptureMetadata from existing object fields
      const meta: CaptureMetadata = {
        latitude: object.latitude ?? undefined,
        longitude: object.longitude ?? undefined,
        altitude: object.altitude ?? undefined,
        accuracy: object.coordinate_accuracy ?? undefined,
        coordinateSource: (object.coordinate_source as 'exif' | 'gps_hardware') ?? undefined,
        timestamp: object.created_at,
        appVersion: '0.1.0',
      };

      // Read image base64 for AI processing
      const file = new File(pm.file_path);
      const imageBase64 = await file.base64();

      // Navigate to AI processing via Capture tab
      navigation.getParent()?.navigate('Capture', {
        screen: 'AIProcessing',
        params: {
          imageUri: pm.file_path,
          imageBase64,
          mimeType: pm.mime_type,
          captureMetadata: meta,
          sha256Hash: pm.sha256_hash ?? undefined,
          existingObjectId: objectId,
        },
      });
    } catch {
      // If anything fails, revert status
      await updateReviewStatus(db, objectId, 'needs_review').catch(() => {});
    }
  }, [object, media, db, objectId, navigation]);

  // ── Derived data for export (must be before early returns) ──────────────────

  const exportData: ExportableObject | null = useMemo(() => {
    if (!object) return null;
    return {
      object,
      media,
      persons: persons.map((p) => ({
        name: p.name,
        role: p.role,
        birth_year: p.birth_year,
        death_year: p.death_year,
      })),
    };
  }, [object, media, persons]);

  const exportSource: ExportSource | null = useMemo(() => {
    if (!exportData) return null;
    return { mode: 'object', data: exportData };
  }, [exportData]);

  // ── Loading / error guards ───────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <IconButton
            icon={<BackIcon size={24} color={colors.text} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back')}
          />
          <View style={styles.skeletonHeaderTitle}>
            <SkeletonLoader width="55%" height={18} />
          </View>
        </View>
        <View style={styles.breadcrumbScroll}>
          <View style={styles.breadcrumbContent}>
            <SkeletonLoader width={180} height={12} />
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.skeletonBody}>
          <SkeletonLoader width={220} height={220} borderRadius={radii.md} />
          <View style={styles.skeletonRows}>
            <SkeletonLoader width="70%" height={14} />
            <SkeletonLoader width="50%" height={14} />
            <SkeletonLoader width="85%" height={14} />
            <SkeletonLoader width="60%" height={14} />
            <SkeletonLoader width="75%" height={14} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !object) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <IconButton
            icon={<BackIcon size={24} color={colors.text} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back')}
          />
        </View>
        <View style={styles.centred}>
          <Text style={styles.errorText}>{error ?? t('objects.not_found')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const typeLabel = t(`object_types.${object.object_type}`);
  const dateRange = [object.event_start, object.event_end]
    .filter(Boolean)
    .join('\u2013');
  const coordString = formatCoords(
    object.latitude,
    object.longitude,
    object.coordinate_accuracy,
  );
  const primaryMedia = media.find((m) => m.is_primary === 1) ?? media[0];

  // Parse AI metadata from type_specific_data JSON
  const extras: Record<string, unknown> = (() => {
    try {
      return object.type_specific_data
        ? (JSON.parse(object.type_specific_data) as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  })();
  const aiDateCreated = typeof extras.dateCreated === 'string' ? extras.dateCreated : null;
  const aiMedium = typeof extras.medium === 'string' ? extras.medium : null;
  const aiDimensions = typeof extras.dimensions === 'string' ? extras.dimensions : null;
  const aiStylePeriod = typeof extras.stylePeriod === 'string' ? extras.stylePeriod : null;
  const aiCultureOrigin = typeof extras.cultureOrigin === 'string' ? extras.cultureOrigin : null;
  const aiCondition = typeof extras.condition === 'string' ? extras.condition : null;
  const aiKeywords = Array.isArray(extras.keywords) ? (extras.keywords as string[]).join(', ') : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <IconButton
          icon={<BackIcon size={24} color={colors.text} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        />
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {object.title}
        </Text>
        <Badge variant="neutral" label={typeLabel} size="sm" />
      </View>

      {/* ── BREADCRUMB ─────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.breadcrumbContent}
        style={styles.breadcrumbScroll}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="link"
          accessibilityLabel={t('objectList.title')}
          hitSlop={touch.hitSlop}
        >
          <Text style={styles.breadcrumbLink}>{t('objectList.title')}</Text>
        </Pressable>
        <ForwardIcon size={12} color={colors.textMuted} style={styles.breadcrumbSep} />
        <Text style={styles.breadcrumbLink}>{typeLabel}</Text>
        <ForwardIcon size={12} color={colors.textMuted} style={styles.breadcrumbSep} />
        <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
          {object.title}
        </Text>
      </ScrollView>

      {/* ── SCROLL BODY ────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 2. IMAGE GALLERY ─────────────────────────────────────────────── */}
        {media.length > 0 && (
          <View style={styles.gallerySection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryContent}
            >
              {media.map((m, idx) => (
                <View key={m.id} style={styles.galleryItem}>
                  <Image
                    source={{ uri: m.file_path }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                    accessibilityLabel={
                      m.caption ?? `${t('objectDetail.photo')} ${idx + 1}`
                    }
                  />
                  {m.is_primary === 1 && (
                    <View style={styles.primaryPip} />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <Divider />

        {/* ── REVIEW BANNER (needs_review or in_review) ────────────────────── */}
        {object.review_status !== 'complete' && (
          <View style={styles.reviewBanner}>
            <View style={styles.reviewBannerHeader}>
              <WarningIcon size={18} color={colors.statusWarning} />
              <Text style={styles.reviewBannerTitle}>
                {t('review.needsReview')}
              </Text>
            </View>
            <Text style={styles.reviewBannerText}>
              {t('review.needsReviewDescription')}
            </Text>
            <Button
              label={t('review.startReview')}
              variant="primary"
              size="md"
              onPress={handleStartReview}
              fullWidth
            />
          </View>
        )}

        {/* ── 3. BASIC INFORMATION ─────────────────────────────────────────── */}
        <Card style={styles.card}>
          <SectionHeader title={t('objectDetail.basicInfo')} />
          <MetadataRow
            label={t('objects.object_type')}
            value={typeLabel}
          />
          {object.inventory_number != null && (
            <MetadataRow
              label={t('objects.inventory_number')}
              value={object.inventory_number}
            />
          )}
          {aiDateCreated != null && (
            <MetadataRow
              label={t('objectDetail.estimatedCreationDate')}
              value={`${aiDateCreated}  (${t('objectDetail.aiEstimate')})`}
            />
          )}
          {dateRange.length > 0 && (
            <MetadataRow label={t('objects.date')} value={dateRange} />
          )}
          {aiMedium != null && (
            <MetadataRow label={t('objectDetail.medium')} value={aiMedium} />
          )}
          {aiDimensions != null && (
            <MetadataRow label={t('objectDetail.dimensions')} value={aiDimensions} />
          )}
          {aiStylePeriod != null && (
            <MetadataRow label={t('objectDetail.stylePeriod')} value={aiStylePeriod} />
          )}
          {aiCultureOrigin != null && (
            <MetadataRow label={t('objectDetail.cultureOrigin')} value={aiCultureOrigin} />
          )}
          {aiCondition != null && (
            <MetadataRow label={t('objectDetail.condition')} value={aiCondition} />
          )}
          {aiKeywords != null && (
            <MetadataRow label={t('objectDetail.keywords')} value={aiKeywords} />
          )}
          {coordString.length > 0 && (
            <MetadataRow
              label={t('location.section_title')}
              value={coordString}
            />
          )}
          {object.coordinate_source != null && (
            <MetadataRow
              label={t('objectDetail.coordinateSource')}
              value={getDisplayLabel(object.coordinate_source, 'coordinate_source')}
            />
          )}
        </Card>

        {/* ── 4. DESCRIPTION ───────────────────────────────────────────────── */}
        {object.description != null &&
          object.description.trim().length > 0 && (
            <>
              <Divider />
              <Card style={styles.card}>
                <SectionHeader title={t('objects.description')} />
                <Text style={styles.descriptionText}>
                  {object.description}
                </Text>
              </Card>
            </>
          )}

        {/* ── 5. PERSONS ───────────────────────────────────────────────────── */}
        {persons.length > 0 && (
          <>
            <Divider />
            <Card style={styles.card}>
              <SectionHeader title={t('objectDetail.associatedPersons')} />
              {persons.map((p) => {
                const years = lifespan(p.birth_year, p.death_year);
                const nameDisplay = years ? `${p.name} (${years})` : p.name;
                return (
                  <MetadataRow
                    key={p.id}
                    label={p.role}
                    value={nameDisplay}
                  />
                );
              })}
            </Card>
          </>
        )}

        {/* ── 6. CAPTURE METADATA ──────────────────────────────────────────── */}
        <Divider />
        <Card style={styles.card}>
          <SectionHeader title={t('objectDetail.captureData')} />
          <MetadataRow
            label={t('objectDetail.captureDate')}
            value={formatDate(object.created_at)}
          />
          <MetadataRow
            label={t('objectDetail.uuid')}
            value={object.id}
            variant="stacked"
          />
          {primaryMedia?.sha256_hash != null && (
            <MetadataRow
              label={t('objectDetail.hash')}
              value={primaryMedia.sha256_hash}
              variant="stacked"
            />
          )}
        </Card>

        {/* Bottom spacer for fixed action bar */}
        <View style={{ height: ACTION_BAR_HEIGHT + spacing.xl }} />
      </ScrollView>

      {/* ── 7. FIXED ACTION BAR ──────────────────────────────────────────────── */}
      <View style={styles.actionBar}>
        <IconButton
          icon={<EditIcon size={22} color={colors.textTertiary} />}
          onPress={handleEdit}
          accessibilityLabel={t('objectDetail.editDisabled')}
          disabled
        />
        <IconButton
          icon={<ExportIcon size={22} color={colors.text} />}
          onPress={handleExport}
          accessibilityLabel={t('export.share')}
        />
        <View style={styles.actionSpacer} />
        <IconButton
          icon={<DeleteIcon size={22} color={colors.error} />}
          onPress={handleDelete}
          accessibilityLabel={t('common.delete')}
        />
      </View>

      {/* ── EXPORT MODAL ──────────────────────────────────────────────────── */}
      <ExportStepperModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        source={exportSource}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text,
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  // Breadcrumb
  breadcrumbScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breadcrumbContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  breadcrumbLink: {
    ...typography.caption,
    color: colors.textMuted,
  },
  breadcrumbSep: {
    marginHorizontal: spacing.xs,
  },
  breadcrumbCurrent: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.sm,
  },
  // Gallery
  gallerySection: {
    marginBottom: spacing.xs,
  },
  galleryContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  galleryItem: {
    position: 'relative',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  galleryImage: {
    width: GALLERY_IMG_SIZE,
    height: GALLERY_IMG_SIZE,
  },
  primaryPip: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  // Review banner
  reviewBanner: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.warningLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  reviewBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  reviewBannerTitle: {
    ...typography.bodyMedium,
    color: colors.statusWarning,
  },
  reviewBannerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // Cards
  card: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  // Description
  descriptionText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  // Skeleton loading state
  skeletonHeaderTitle: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  skeletonBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  skeletonRows: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  // Error state
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
  },
  // Action bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ACTION_BAR_HEIGHT,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  actionSpacer: {
    flex: 1,
  },
});
