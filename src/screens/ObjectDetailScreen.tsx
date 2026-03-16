import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { deleteObject } from '../services/objectService';
import {
  Badge,
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
} from '../theme/icons';
import { colors, radii, spacing, typography } from '../theme';
import type { RegisterObject, Media, ObjectPerson } from '../db/types';
import { ExportModal } from '../components/ExportModal';
import type { ExportableObject } from '../services/export-service';

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
    console.log('Edit not yet implemented');
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
        </View>
        <View style={styles.centred}>
          <Text style={styles.stateText}>{t('common.loading')}</Text>
        </View>
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {object.title}
        </Text>
        <Badge variant="neutral" label={typeLabel} size="sm" />
      </View>

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
          {dateRange.length > 0 && (
            <MetadataRow label={t('objects.date')} value={dateRange} />
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
              value={object.coordinate_source}
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
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={exportData}
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
  // Loading / error states
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  stateText: {
    ...typography.body,
    color: colors.textSecondary,
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
