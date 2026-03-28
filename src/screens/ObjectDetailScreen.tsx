import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { useSettings } from '../hooks/useSettings';
import { File } from 'expo-file-system';
import { deleteObject, updateReviewStatus } from '../services/objectService';
import {
  launchDocumentScanner,
  processDocumentScan,
  extractTextOnDevice,
  extractTextFromCloud,
} from '../services/documentScanService';
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
  CollapseIcon,
  DeleteIcon,
  EditIcon,
  ExpandIcon,
  ExportIcon,
  ForwardIcon,
  IsolateIcon,
  ScanIcon,
  WarningIcon,
} from '../theme/icons';
import { colors, radii, spacing, touch, typography } from '../theme';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { ImageViewer } from '../components/ImageViewer';
import { VideoPlayer } from '../components/VideoPlayer';
import { Play } from 'lucide-react-native';
import { AIFieldBadge } from '../components/AIFieldBadge';
import type { RegisterObject, Media, ObjectPerson } from '../db/types';
import { ExportStepperModal, type ExportSource } from '../components/ExportStepperModal';
import type { ExportableObject } from '../services/export-service';
import { getDisplayLabel } from '../utils/displayLabels';
import { useSyncStatuses } from '../hooks/useSyncStatuses';
import { SyncBadge } from '../components/SyncBadge';
import { useObjectDocuments } from '../hooks/useObjectDocuments';
import { getProtocol, type CaptureProtocol } from '../config/protocols';
import { CheckIcon } from '../theme/icons';
import { Camera, QrCode } from 'lucide-react-native';
import { VIEW_TYPES, STANDARD_VIEW_TYPES } from '../constants/viewTypes';
import type { RegisterViewType } from '../db/types';
import type { RootStackParamList } from '../navigation/RootStack';
import { LocationPicker } from '../components/LocationPicker';
import { ObjectChecklist } from '../components/ObjectChecklist';
import { Map as MapIcon } from 'lucide-react-native';
import type { MapPin as MapPinType, FloorMap } from '../db/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'ObjectDetail'>;

interface PersonRow extends ObjectPerson {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
  const { collectionDomain } = useSettings();

  const [object, setObject] = useState<RegisterObject | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [videoPlayerUri, setVideoPlayerUri] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  // Tab navigation for multi-view capture
  // Single stack - no tab nav needed

  // Document scans for this object
  const {
    documents,
    refresh: refreshDocuments,
  } = useObjectDocuments(objectId);

  // Per-object sync status
  const syncStatusMap = useSyncStatuses([objectId]);
  const objectSyncStatus = syncStatusMap.get(objectId) ?? 'synced';

  // Map pin for this object
  const [mapPinInfo, setMapPinInfo] = useState<{ mapName: string; mapId: string } | null>(null);

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

      // Check for map pin (best-effort, don't fail if table doesn't exist yet)
      try {
        const pinRow = await db.getFirstAsync<{ map_id: string; map_name: string }>(
          `SELECT fm.id as map_id, fm.name as map_name
           FROM map_pins mp
           JOIN floor_maps fm ON fm.id = mp.floor_map_id
           WHERE mp.object_id = ?
           LIMIT 1`,
          [objectId],
        );
        setMapPinInfo(pinRow ? { mapName: pinRow.map_name, mapId: pinRow.map_id } : null);
      } catch {
        setMapPinInfo(null);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [db, objectId, t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

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

      // Navigate to AI processing
      navigation.navigate('AIProcessing', {
        imageUri: pm.file_path,
        imageBase64,
        mimeType: pm.mime_type,
        captureMetadata: meta,
        sha256Hash: pm.sha256_hash ?? undefined,
        existingObjectId: objectId,
      });
    } catch {
      // If anything fails, revert status
      await updateReviewStatus(db, objectId, 'needs_review').catch(() => {});
    }
  }, [object, media, db, objectId, navigation]);

  // ── Isolation check ─────────────────────────────────────────────────────────

  const canIsolate = useMemo(() => {
    // Need at least one original media
    const originals = media.filter(
      (m) => !m.media_type || m.media_type === 'original',
    );
    if (originals.length === 0) return false;
    // Check if a derivative already exists for the primary original
    const pm = originals.find((m) => m.is_primary === 1) ?? originals[0];
    const hasDerivative = media.some(
      (m) => m.media_type === 'derivative_isolated' && m.parent_media_id === pm.id,
    );
    return !hasDerivative;
  }, [media]);

  const handleIsolate = useCallback(() => {
    const pm = media.find((m) => m.is_primary === 1) ?? media[0];
    if (!pm) return;
    navigation.navigate('IsolationCompare', {
      objectId,
      mediaId: pm.id,
    });
  }, [media, navigation, objectId]);

  // ── Document scan handler ───────────────────────────────────────────────────

  const handleScanDocument = useCallback(async () => {
    try {
      setScanning(true);

      // 1. Launch native scanner
      const scanResult = await launchDocumentScanner();
      if (!scanResult) {
        // User cancelled
        setScanning(false);
        return;
      }

      // 2. Process: store raw (with hash) + deskewed derivative
      const record = await processDocumentScan(
        db,
        objectId,
        scanResult.scannedImageUri,
        scanResult.scannedImageUri,
      );

      // 3. Run on-device OCR on the deskewed image
      let ocrSuccess = false;
      try {
        const result = await extractTextOnDevice(
          db,
          record.rawMediaId,
          record.deskewedFilePath,
        );
        if (result.text.trim().length > 0) {
          ocrSuccess = true;
          Alert.alert(t('capture.ocr_complete'));
        }
      } catch (onDeviceErr) {
        console.error(
          '[OCR] On-device OCR failed, attempting cloud fallback:',
          onDeviceErr instanceof Error ? onDeviceErr.message : String(onDeviceErr),
        );
      }

      // 4. Cloud fallback — if on-device OCR failed or returned empty text
      if (!ocrSuccess) {
        try {
          console.log('[OCR] Trying cloud OCR fallback via ocr-enhance Edge Function...');
          const cloudResult = await extractTextFromCloud(
            db,
            record.rawMediaId,
            record.deskewedFilePath,
            collectionDomain,
          );
          if (cloudResult.text.trim().length > 0) {
            ocrSuccess = true;
            Alert.alert(t('capture.ocr_complete'));
          }
        } catch (cloudErr) {
          console.error(
            '[OCR] Cloud OCR fallback also failed:',
            cloudErr instanceof Error ? cloudErr.message : String(cloudErr),
          );
        }
      }

      // 5. Show meaningful error if both failed
      if (!ocrSuccess) {
        Alert.alert(t('capture.ocr_failed_detailed'));
      }

      // 6. Refresh the documents list
      await refreshDocuments();
    } catch (err) {
      console.error(
        '[OCR] Document scan flow error:',
        err instanceof Error ? err.message : String(err),
      );
      Alert.alert(t('common.error'));
    } finally {
      setScanning(false);
    }
  }, [db, objectId, t, refreshDocuments, collectionDomain]);

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

  // Group media by shot_type for protocol objects (must be before early returns)
  const isGerman = t('pdf.html_lang') === 'de';
  const mediaGrouped = useMemo(() => {
    if (!object) return null;
    const pId = object.protocol_id;
    if (!pId) return null;
    const pDef = getProtocol(pId);
    if (!pDef) return null;
    const groups: { label: string; items: Media[] }[] = [];
    const sorted = [...pDef.shots].sort((a, b) => a.order - b.order);
    const used = new Set<string>();

    for (const shot of sorted) {
      const matching = media.filter((m) => m.shot_type === shot.id);
      if (matching.length > 0) {
        groups.push({
          label: isGerman ? shot.label_de : shot.label,
          items: matching,
        });
        matching.forEach((m) => used.add(m.id));
      }
    }

    const additional = media.filter((m) => !used.has(m.id));
    if (additional.length > 0) {
      groups.push({
        label: t('protocols.additional_photos'),
        items: additional,
      });
    }

    return groups;
  }, [object, media, isGerman, t]);

  // ── Loading / error guards ───────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
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
      <SafeAreaView style={styles.safe} edges={['top']}>
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

  const isVideoMedia = (m: Media) => m.file_type === 'video' || m.mime_type.startsWith('video/');

  const handleMediaTap = (m: Media) => {
    if (isVideoMedia(m)) {
      setVideoPlayerUri(m.file_path);
    } else {
      setViewerUri(m.file_path);
    }
  };

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

  // Device metadata stored at capture time
  const deviceData =
    extras.device != null && typeof extras.device === 'object'
      ? (extras.device as Record<string, string>)
      : null;
  const captureDeviceLabel =
    deviceData != null
      ? [deviceData.manufacturer, deviceData.model].filter(Boolean).join(' ')
      : null;
  const captureOs = deviceData?.os ?? null;
  const captureAppVersion = deviceData?.appVersion ?? null;
  const captureDeviceId =
    deviceData?.deviceId != null
      ? `${deviceData.deviceId.slice(0, 8)}…`
      : null;

  // Protocol data (fields added in Phase 1 as optional on RegisterObject)
  const protocolId = object.protocol_id;
  const protocolComplete = object.protocol_complete;
  const shotsCompletedRaw = object.shots_completed;
  const shotsRemainingRaw = object.shots_remaining;

  const protocolDef: CaptureProtocol | null = protocolId ? getProtocol(protocolId) : null;
  const shotsCompletedArr: string[] = (() => {
    try { return shotsCompletedRaw ? JSON.parse(shotsCompletedRaw) : []; }
    catch { return []; }
  })();
  const shotsRemainingArr: string[] = (() => {
    try { return shotsRemainingRaw ? JSON.parse(shotsRemainingRaw) : []; }
    catch { return []; }
  })();

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
        {/* ── IDENTIFICATION (top, per museum workflow) ─────────────────── */}
        <Card style={styles.card}>
          <SectionHeader title={t('quickId.title')} />
          <MetadataRow label={t('objects.title')} value={object.title} />
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
        </Card>

        {/* ── 2. IMAGE GALLERY ─────────────────────────────────────────────── */}
        {media.length > 0 && mediaGrouped ? (
          /* Grouped gallery for protocol objects */
          <View style={styles.gallerySection}>
            {mediaGrouped.map((group, gi) => (
              <View key={gi} style={styles.galleryGroup}>
                <Text style={styles.galleryGroupLabel}>{group.label}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.galleryContent}
                >
                  {group.items.map((m, idx) => (
                    <Pressable
                      key={m.id}
                      style={styles.galleryItem}
                      onPress={() => handleMediaTap(m)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        m.caption ?? `${t('objectDetail.photo')} ${idx + 1}`
                      }
                    >
                      <Image
                        source={{ uri: m.file_path }}
                        style={styles.galleryImage}
                        resizeMode="cover"
                      />
                      {isVideoMedia(m) && (
                        <View style={styles.videoPlayOverlay}>
                          <Play size={18} color={colors.white} fill={colors.white} />
                        </View>
                      )}
                      {m.is_primary === 1 && (
                        <View style={styles.primaryPip} />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        ) : media.length > 0 ? (
          /* Flat gallery for freeform objects */
          <View style={styles.gallerySection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryContent}
            >
              {media.map((m, idx) => (
                <Pressable
                  key={m.id}
                  style={styles.galleryItem}
                  onPress={() => handleMediaTap(m)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    m.caption ?? `${t('objectDetail.photo')} ${idx + 1}`
                  }
                >
                  <Image
                    source={{ uri: m.file_path }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                  {isVideoMedia(m) && (
                    <View style={styles.videoPlayOverlay}>
                      <Play size={18} color={colors.white} fill={colors.white} />
                    </View>
                  )}
                  {m.is_primary === 1 && (
                    <View style={styles.primaryPip} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ── MULTI-VIEW GALLERY (Registerbogen) ──────────────────────────── */}
        <View style={styles.viewGallerySection}>
          <SectionHeader title={t('view_checklist.title')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.viewGalleryContent}
          >
            {VIEW_TYPES.map((viewDef) => {
              const captured = media.find(
                (m) => m.view_type === viewDef.key && m.media_type !== 'derivative_isolated',
              );
              return (
                <Pressable
                  key={viewDef.key}
                  style={[
                    styles.viewGalleryItem,
                    captured ? styles.viewGalleryItemCaptured : styles.viewGalleryItemEmpty,
                  ]}
                  onPress={() => {
                    if (captured) {
                      setViewerUri(captured.file_path);
                    } else {
                      navigation.navigate('CaptureCamera', {
                        viewType: viewDef.key as RegisterViewType,
                        objectId: object.id,
                      });
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t(viewDef.labelKey)}
                >
                  {captured ? (
                    <>
                      <Image
                        source={{ uri: captured.file_path }}
                        style={styles.viewGalleryImage}
                        resizeMode="cover"
                      />
                      <View style={styles.viewGalleryCheck}>
                        <CheckIcon size={12} color={colors.white} />
                      </View>
                    </>
                  ) : (
                    <Camera size={20} color={colors.textTertiary} />
                  )}
                  <Text
                    style={[
                      styles.viewGalleryLabel,
                      captured && styles.viewGalleryLabelCaptured,
                    ]}
                    numberOfLines={1}
                  >
                    {t(viewDef.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Per-view dimension inputs for captured views */}
          {media
            .filter((m) => m.view_type && VIEW_TYPES.some((v) => v.key === m.view_type))
            .map((m) => (
              <View key={m.id} style={styles.viewDimensionRow}>
                <Text style={styles.viewDimensionLabel}>
                  {t(`view_types.${m.view_type}`)} - {t('view_checklist.dimensions_label')}
                </Text>
                <TextInput
                  style={styles.viewDimensionInput}
                  placeholder={t('view_checklist.dimensions_placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  defaultValue={m.view_dimensions ?? ''}
                  onEndEditing={(e) => {
                    const val = e.nativeEvent.text.trim();
                    db.runAsync(
                      `UPDATE media SET view_dimensions = ?, updated_at = ? WHERE id = ?`,
                      [val || null, new Date().toISOString(), m.id],
                    ).then(() => {
                      import('../sync/engine').then(({ SyncEngine: SE }) => {
                        new SE(db).queueChange('media', m.id, 'update', { view_dimensions: val || null });
                      });
                    }).catch(() => {});
                  }}
                />
                {m.view_type === 'detail' && (
                  <>
                    <Text style={[styles.viewDimensionLabel, { marginTop: spacing.sm }]}>
                      {t('view_checklist.notes_label')}
                    </Text>
                    <TextInput
                      style={styles.viewDimensionInput}
                      placeholder={t('view_checklist.notes_placeholder')}
                      placeholderTextColor={colors.textTertiary}
                      defaultValue={m.view_notes ?? ''}
                      multiline
                      onEndEditing={(e) => {
                        const val = e.nativeEvent.text.trim();
                        db.runAsync(
                          `UPDATE media SET view_notes = ?, updated_at = ? WHERE id = ?`,
                          [val || null, new Date().toISOString(), m.id],
                        ).then(() => {
                          import('../sync/engine').then(({ SyncEngine: SE }) => {
                            new SE(db).queueChange('media', m.id, 'update', { view_notes: val || null });
                          });
                        }).catch(() => {});
                      }}
                    />
                  </>
                )}
              </View>
            ))}
        </View>

        {/* ── ADD VIDEO BUTTON ─────────────────────────────────────────────── */}
        <Pressable
          style={styles.addVideoBtn}
          onPress={() => navigation.navigate('VideoRecord', { objectId: object.id })}
          accessibilityRole="button"
          accessibilityLabel={t('objectDetail.addVideo')}
        >
          <Play size={18} color={colors.heroGreen} />
          <Text style={styles.addVideoBtnText}>{t('objectDetail.addVideo')}</Text>
        </Pressable>

        <Divider />

        {/* ── SYNC STATUS ──────────────────────────────────────────────────── */}
        <View style={styles.syncBadgeRow}>
          <SyncBadge status={objectSyncStatus} size="md" />
        </View>

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

        {/* ── PROTOCOL STATUS ──────────────────────────────────────────────── */}
        {protocolDef && (
          <Card style={styles.card}>
            <SectionHeader title={t('protocols.documentation_protocol')} />
            <MetadataRow
              label={isGerman ? protocolDef.name_de : protocolDef.name}
              value={
                protocolComplete === 1
                  ? t('protocols.status_complete')
                  : shotsRemainingArr.length > 0
                    ? t('protocols.missing_required', { count: shotsRemainingArr.length })
                    : t('protocols.status_incomplete')
              }
            />
            {protocolDef.shots
              .sort((a, b) => a.order - b.order)
              .map((shot) => {
                const isDone = shotsCompletedArr.includes(shot.id);
                const shotLabel = isGerman ? shot.label_de : shot.label;
                return (
                  <View key={shot.id} style={styles.protocolShotRow}>
                    {isDone ? (
                      <CheckIcon size={14} color={colors.success} />
                    ) : (
                      <View style={styles.protocolShotDot} />
                    )}
                    <Text
                      style={[
                        styles.protocolShotLabel,
                        isDone && styles.protocolShotDone,
                      ]}
                    >
                      {shotLabel}
                    </Text>
                    {shot.required && !isDone && (
                      <Badge variant="warning" label={t('protocols.required_badge')} size="sm" />
                    )}
                  </View>
                );
              })}
          </Card>
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

        {/* ── 6. DOCUMENTS ────────────────────────────────────────────────── */}
        <Divider />
        <Card style={styles.card}>
          <SectionHeader
            title={t('objects.documents')}
            action={
              documents.length > 0
                ? t('objects.document_count', { count: documents.length })
                : undefined
            }
          />

          {documents.length === 0 && !scanning && (
            <Text style={styles.emptyDocumentsText}>
              {t('objects.no_documents')}
            </Text>
          )}

          {documents.map((doc) => {
            const ocrSourceLabel =
              doc.ocrSource === 'cloud'
                ? t('objects.ocr_cloud')
                : doc.ocrSource === 'on_device'
                  ? t('objects.ocr_on_device')
                  : null;
            const previewText = doc.ocrText
              ? doc.ocrText.split('\n').slice(0, 2).join('\n')
              : null;

            return (
              <Pressable
                key={doc.rawMediaId}
                style={styles.documentCard}
                onPress={() =>
                  navigation.navigate('DocumentReview', {
                    mediaId: doc.rawMediaId,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t('objects.view_document')}
              >
                <Image
                  source={{ uri: doc.displayUri }}
                  style={styles.documentThumb}
                  resizeMode="cover"
                />
                <View style={styles.documentInfo}>
                  {previewText ? (
                    <Text
                      style={styles.documentOcrPreview}
                      numberOfLines={2}
                    >
                      {previewText}
                    </Text>
                  ) : (
                    <Text style={styles.documentNoText}>
                      {t('capture.ocr_failed')}
                    </Text>
                  )}
                  <View style={styles.documentBadges}>
                    {doc.ocrConfidence != null && doc.ocrConfidence > 0 && (
                      <AIFieldBadge
                        visible
                        confidence={doc.ocrConfidence}
                      />
                    )}
                    {ocrSourceLabel && (
                      <Badge
                        variant="neutral"
                        label={ocrSourceLabel}
                        size="sm"
                      />
                    )}
                  </View>
                </View>
                <ForwardIcon size={16} color={colors.textTertiary} />
              </Pressable>
            );
          })}

          <Pressable
            style={[
              styles.scanButton,
              scanning && styles.scanButtonDisabled,
            ]}
            onPress={handleScanDocument}
            disabled={scanning}
            accessibilityRole="button"
            accessibilityLabel={t('objects.scan_document')}
          >
            {scanning ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                accessibilityLabel={t('capture.document_scanning')}
              />
            ) : (
              <ScanIcon size={18} color={colors.primary} />
            )}
            <Text style={styles.scanButtonText}>
              {scanning
                ? t('capture.document_scanning')
                : t('objects.scan_document')}
            </Text>
          </Pressable>
        </Card>

        {/* ── 7. CAPTURE METADATA ──────────────────────────────────────────── */}
        <Divider />
        <Card style={styles.card}>
          <SectionHeader title={t('objectDetail.captureData')} />
          <MetadataRow
            label={t('objectDetail.captureDate')}
            value={formatDate(object.created_at)}
          />
          <Pressable
            style={styles.technicalToggle}
            onPress={() => setShowTechnical(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('objectDetail.technicalDetails')}
          >
            <Text style={styles.technicalToggleText}>{t('objectDetail.technicalDetails')}</Text>
            {showTechnical
              ? <CollapseIcon size={16} color={colors.textTertiary} />
              : <ExpandIcon size={16} color={colors.textTertiary} />
            }
          </Pressable>
          {showTechnical && (
            <>
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
              {aiDimensions != null && (
                <MetadataRow label={t('objectDetail.dimensions')} value={aiDimensions} variant="stacked" />
              )}
              {coordString.length > 0 && (
                <MetadataRow
                  label={t('location.section_title')}
                  value={coordString}
                  variant="stacked"
                />
              )}
              {object.coordinate_source != null && (
                <MetadataRow
                  label={t('objectDetail.coordinateSource')}
                  value={getDisplayLabel(object.coordinate_source, 'coordinate_source')}
                  variant="stacked"
                />
              )}
              {captureDeviceLabel != null && (
                <MetadataRow
                  label={t('objectDetail.deviceDevice')}
                  value={captureDeviceLabel}
                  variant="stacked"
                />
              )}
              {captureOs != null && (
                <MetadataRow
                  label={t('objectDetail.deviceOs')}
                  value={captureOs}
                  variant="stacked"
                />
              )}
              {captureAppVersion != null && (
                <MetadataRow
                  label={t('objectDetail.appVersion')}
                  value={captureAppVersion}
                  variant="stacked"
                />
              )}
              {captureDeviceId != null && (
                <MetadataRow
                  label={t('objectDetail.deviceId')}
                  value={captureDeviceId}
                  variant="stacked"
                />
              )}
            </>
          )}
        </Card>

        {/* ── 8. LOCATION ──────────────────────────────────────────────────── */}
        <Divider />
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <LocationPicker
            objectId={object.id}
            initialBuilding={object.location_building}
            initialFloor={object.location_floor}
            initialRoom={object.location_room}
            initialShelf={object.location_shelf}
            initialNotes={object.location_notes}
          />
        </View>

        {/* ── 8b. LOCATION ON MAP ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <Pressable
            style={styles.mapLinkCard}
            onPress={() =>
              navigation.navigate('FloorMap', mapPinInfo
                ? { objectId: object.id, mapId: mapPinInfo.mapId }
                : { objectId: object.id })
            }
            accessibilityRole="button"
            accessibilityLabel={mapPinInfo ? 'View on map' : 'Place on map'}
          >
            <MapIcon size={18} color={colors.heroGreen} />
            <View style={{ flex: 1 }}>
              <Text style={styles.mapLinkTitle}>
                {mapPinInfo ? `Placed on ${mapPinInfo.mapName}` : 'Place on map'}
              </Text>
              <Text style={styles.mapLinkSub}>
                {mapPinInfo ? 'View on floor map' : 'Pin this object to a floor plan'}
              </Text>
            </View>
            <ForwardIcon size={16} color={colors.textTertiary} />
          </Pressable>
        </View>

        {/* ── 9. CHECKLIST ───────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <ObjectChecklist
            objectId={object.id}
            viewCount={media.filter((m) => m.view_type && STANDARD_VIEW_TYPES.some((v) => v.key === m.view_type)).length}
            hasAI={!!(object.description && object.title && object.title !== 'Untitled')}
          />
        </View>

        {/* Bottom spacer for fixed action bar */}
        <View style={{ height: ACTION_BAR_HEIGHT + spacing.xl }} />
      </ScrollView>

      {/* ── 7. FIXED ACTION BAR ──────────────────────────────────────────────── */}
      <View style={styles.actionBar}>
        <IconButton
          icon={<EditIcon size={22} color={colors.text} />}
          onPress={handleEdit}
          accessibilityLabel={t('common.edit')}
        />
        <IconButton
          icon={<ExportIcon size={22} color={colors.text} />}
          onPress={handleExport}
          accessibilityLabel={t('export.share')}
        />
        {canIsolate && (
          <IconButton
            icon={<IsolateIcon size={22} color={colors.text} />}
            onPress={handleIsolate}
            accessibilityLabel={t('isolation.isolate')}
          />
        )}
        <IconButton
          icon={<QrCode size={22} color={colors.text} />}
          onPress={() => navigation.navigate('QRCode', { objectId })}
          accessibilityLabel="QR Code"
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

      <ImageViewer
        visible={!!viewerUri}
        imageUri={viewerUri ?? ''}
        onClose={() => setViewerUri(null)}
      />

      <VideoPlayer
        visible={!!videoPlayerUri}
        videoUri={videoPlayerUri ?? ''}
        onClose={() => setVideoPlayerUri(null)}
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
    paddingBottom: 100,
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
  // ── Multi-view gallery (Registerbogen) ──────────────────────────────────────
  viewGallerySection: {
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  viewGalleryContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  viewGalleryItem: {
    width: 88,
    height: 104,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  viewGalleryItemCaptured: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  viewGalleryItemEmpty: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  viewGalleryImage: {
    width: '100%',
    height: 76,
  },
  viewGalleryCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewGalleryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  viewGalleryLabelCaptured: {
    color: colors.success,
    fontWeight: typography.weight.semibold,
  },
  viewDimensionRow: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  viewDimensionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  viewDimensionInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodySmall,
    color: colors.text,
    minHeight: touch.minTargetSmall,
  },

  addVideoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.heroGreen,
    borderRadius: radii.lg,
    minHeight: touch.minTarget,
  },
  addVideoBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.heroGreen,
  },
  // Map link card
  mapLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touch.minTarget,
  },
  mapLinkTitle: {
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    color: colors.text,
  },
  mapLinkSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  // eslint-disable-next-line react-native/no-color-literals
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sync status row
  syncBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
  // Documents section
  emptyDocumentsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: touch.minTarget,
  },
  documentThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  documentInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  documentOcrPreview: {
    ...typography.bodySmall,
    color: colors.text,
  },
  documentNoText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  documentBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    minHeight: touch.minTarget,
  },
  scanButtonDisabled: {
    opacity: 0.5,
  },
  scanButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  // Gallery groups (protocol objects)
  galleryGroup: {
    marginBottom: spacing.md,
  },
  galleryGroupLabel: {
    ...typography.label,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  // Protocol status section
  protocolShotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  protocolShotDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  protocolShotLabel: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  protocolShotDone: {
    color: colors.textSecondary,
  },
  // Technical details collapsible
  technicalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  technicalToggleText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
});
