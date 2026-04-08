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
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { ImageViewer } from '../components/ImageViewer';
import { VideoPlayer } from '../components/VideoPlayer';
import { AIFieldBadge } from '../components/AIFieldBadge';
import type { RegisterObject, Media, ObjectPerson } from '../db/types';
import { ExportStepperModal, type ExportSource } from '../components/ExportStepperModal';
import type { ExportableObject } from '../services/export-service';
import { getDisplayLabel } from '../utils/displayLabels';
import { useSyncStatuses } from '../hooks/useSyncStatuses';
import { SyncBadge } from '../components/SyncBadge';
import { resolveMediaUri } from '../utils/resolveMediaUri';
import { useObjectDocuments } from '../hooks/useObjectDocuments';
import { getProtocol, type CaptureProtocol } from '../config/protocols';
import { CheckIcon } from '../theme/icons';
import { Camera, QrCode } from 'lucide-react-native';
import { STANDARD_VIEW_TYPES } from '../constants/viewTypes';
import type { RegisterViewType } from '../db/types';
import type { RootStackParamList } from '../navigation/RootStack';
import { LocationPicker } from '../components/LocationPicker';
import { ObjectChecklist } from '../components/ObjectChecklist';
import { Map as MapIcon } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'ObjectDetail'>;

interface PersonRow extends ObjectPerson {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

interface AnnotationRow {
  id: string;
  annotation_type: string;
  content: string;
  user_id: string | null;
  created_at: string;
}

interface AuditRow {
  id: string;
  action: string;
  old_values: string | null;
  new_values: string | null;
  created_at: string;
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

const EDITABLE_FIELDS = new Set([
  'title', 'description', 'inventory_number', 'alte_inventarnummer',
  'klassifikation', 'material', 'technik', 'masse_hoehe', 'masse_breite',
  'masse_tiefe', 'masse_einheit', 'gewicht', 'gewicht_einheit',
  'durchmesser', 'durchmesser_einheit', 'format', 'inschriften', 'markierungen', 'schlagworte',
  'erhaltungszustand', 'zustandsbeschreibung', 'restaurierungsbedarf',
  'provenienzangaben', 'erwerbungsart', 'erwerbungsdatum', 'veraeusserer',
  'standort_gebaeude', 'standort_etage', 'standort_raum', 'standort_regal',
  'standort_hinweise', 'aktueller_status', 'condition_status', 'condition_note',
]);

// ── Inner Components ──────────────────────────────────────────────────────────

function CollapsibleSection({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const sec = useMemo(() => makeSec(colors), [colors]);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={sec.section}>
      <Pressable style={sec.sectionHeader} onPress={() => setOpen(!open)} hitSlop={8}>
        <Text style={sec.sectionTitle}>{title}</Text>
        {open ? <CollapseIcon size={18} color={colors.textSecondary} /> : <ExpandIcon size={18} color={colors.textSecondary} />}
      </Pressable>
      {open && <View style={sec.sectionBody}>{children}</View>}
    </View>
  );
}

function CompletionRing({ percent }: { percent: number }) {
  const { colors } = useTheme();
  const sec = useMemo(() => makeSec(colors), [colors]);
  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <View style={sec.ringContainer}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={sec.ringText}>{percent}%</Text>
    </View>
  );
}

function EditableField({ label, value, onSave, multiline }: {
  label: string;
  value: string | null;
  onSave: (val: string | null) => void;
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  const sec = useMemo(() => makeSec(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const handlePress = useCallback(() => {
    setDraft(value ?? '');
    setEditing(true);
  }, [value]);

  const handleSubmit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    const newVal = trimmed.length > 0 ? trimmed : null;
    if (newVal !== value) {
      onSave(newVal);
    }
  }, [draft, value, onSave]);

  if (editing) {
    return (
      <View style={sec.editableContainer}>
        <Text style={sec.fieldLabel}>{label}</Text>
        <TextInput
          style={[sec.fieldInput, multiline === true && sec.fieldInputMultiline]}
          value={draft}
          onChangeText={setDraft}
          onBlur={handleSubmit}
          onSubmitEditing={multiline === true ? undefined : handleSubmit}
          multiline={multiline}
          autoFocus
          blurOnSubmit={multiline !== true}
          returnKeyType={multiline === true ? 'default' : 'done'}
        />
      </View>
    );
  }

  return (
    <Pressable style={sec.editableContainer} onPress={handlePress} hitSlop={4}>
      <Text style={sec.fieldLabel}>{label}</Text>
      <Text style={value ? sec.fieldValue : sec.fieldEmpty} numberOfLines={multiline === true ? 6 : 1}>
        {value || '\u2014'}
      </Text>
    </Pressable>
  );
}

function ConditionBadge({ status }: { status: string | null | undefined }) {
  const { colors } = useTheme();
  const sec = useMemo(() => makeSec(colors), [colors]);
  if (!status) return null;
  const lower = status.toLowerCase();
  const bg = lower === 'good' ? colors.success : lower === 'fair' ? colors.warning : lower === 'poor' ? colors.error : colors.border;

  return (
    <View style={[sec.conditionPill, { backgroundColor: bg }]}>
      <Text style={sec.conditionPillText}>{status}</Text>
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ObjectDetailScreen({ route, navigation }: Props) {
  const { objectId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();
  const { collectionDomain } = useSettings();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sec = useMemo(() => makeSec(colors), [colors]);

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
  const [annotations, setAnnotations] = useState<AnnotationRow[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditRow[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

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

      // Load annotations (best-effort)
      try {
        const annotationRows = await db.getAllAsync<AnnotationRow>(
          'SELECT id, annotation_type, content, user_id, created_at FROM annotations WHERE object_id = ? ORDER BY created_at DESC',
          [objectId],
        );
        setAnnotations(annotationRows);
      } catch {
        setAnnotations([]);
      }

      // Load audit trail (best-effort)
      try {
        const auditRows = await db.getAllAsync<AuditRow>(
          'SELECT id, action, old_values, new_values, created_at FROM audit_trail WHERE record_id = ? ORDER BY created_at DESC LIMIT 50',
          [objectId],
        );
        setAuditTrail(auditRows);
      } catch {
        setAuditTrail([]);
      }

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

  // ── View type reassignment ──────────────────────────────────────────────────

  const handleReassignViewType = useCallback(async (
    mediaId: string,
    currentViewType: string,
    targetViewType: string,
  ) => {
    if (currentViewType === targetViewType) return;
    const now = new Date().toISOString();
    const occupant = media.find(
      (m) => m.view_type === targetViewType && m.media_type !== 'derivative_isolated',
    );

    const doSwap = async () => {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'UPDATE media SET view_type = ?, updated_at = ? WHERE id = ?',
          [targetViewType, now, mediaId],
        );
        if (occupant) {
          await db.runAsync(
            'UPDATE media SET view_type = ?, updated_at = ? WHERE id = ?',
            [currentViewType, now, occupant.id],
          );
        }
      });
      import('../sync/engine').then(({ SyncEngine: SE }) => {
        const se = new SE(db);
        se.queueChange('media', mediaId, 'update', { view_type: targetViewType });
        if (occupant) {
          se.queueChange('media', occupant.id, 'update', { view_type: currentViewType });
        }
      }).catch(() => {});
      await loadData();
    };

    if (occupant) {
      Alert.alert(
        t('view_types.reassign_title'),
        t('view_types.reassign_occupied', { viewType: t(`view_types.${targetViewType}`) }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('view_types.reassign_swap_confirm'), onPress: doSwap },
        ],
      );
    } else {
      await doSwap();
    }
  }, [db, media, t, loadData]);

  const handleViewTypeLongPress = useCallback((mediaId: string, currentViewType: string) => {
    const buttons = STANDARD_VIEW_TYPES.map((vd) => ({
      text: t(vd.labelKey),
      onPress: () => handleReassignViewType(mediaId, currentViewType, vd.key),
    }));
    Alert.alert(
      t('view_types.reassign_title'),
      undefined,
      [
        ...buttons,
        { text: t('view_types.unassign'), onPress: async () => {
          const now = new Date().toISOString();
          await db.runAsync(
            'UPDATE media SET view_type = NULL, updated_at = ? WHERE id = ?',
            [now, mediaId],
          );
          import('../sync/engine').then(({ SyncEngine: SE }) => {
            new SE(db).queueChange('media', mediaId, 'update', { view_type: null });
          }).catch(() => {});
          await loadData();
        }},
        { text: t('common.cancel'), style: 'cancel' },
      ],
    );
  }, [db, handleReassignViewType, loadData, t]);

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

  // ── Inline editing handler ──────────────────────────────────────────────────

  const handleFieldSave = useCallback(async (fieldName: string, value: string | null) => {
    if (!object || !EDITABLE_FIELDS.has(fieldName)) return;
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE objects SET "${fieldName}" = ?, updated_at = ? WHERE id = ?`,
      [value, now, objectId],
    );
    setObject(prev => prev ? { ...prev, [fieldName]: value, updated_at: now } as RegisterObject : prev);
    import('../sync/engine').then(({ SyncEngine: SE }) => {
      new SE(db).queueChange('objects', objectId, 'update', { [fieldName]: value });
    }).catch(() => {});
  }, [object, db, objectId]);

  // ── AI Analysis handler ─────────────────────────────────────────────────────

  const handleRunAI = useCallback(async () => {
    const pm = media.find(m => m.is_primary === 1) ?? media[0];
    if (!pm) return;
    setAiLoading(true);
    try {
      const file = new File(pm.file_path);
      const base64 = await file.base64();
      const { analyzeObject } = await import('../services/ai-analysis');
      const currentExtras: Record<string, unknown> = (() => {
        try {
          return object?.type_specific_data
            ? (JSON.parse(object.type_specific_data) as Record<string, unknown>)
            : {};
        } catch {
          return {};
        }
      })();
      const result = await analyzeObject(base64, pm.mime_type, collectionDomain);
      if (result.success && result.metadata) {
        const tsd = { ...currentExtras, ...result.metadata };
        const now = new Date().toISOString();
        await db.runAsync(
          'UPDATE objects SET type_specific_data = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(tsd), now, objectId],
        );
        // Queue sync so AI results are pushed to Supabase on next cycle
        import('../sync/engine').then(({ SyncEngine: SE }) => {
          new SE(db).queueChange('objects', objectId, 'update', { type_specific_data: JSON.stringify(tsd) });
        }).catch(() => {});
        await loadData();
        Alert.alert(t('detail.ai_success'));
      } else {
        Alert.alert(t('detail.ai_error'), result.error ?? '');
      }
    } catch (err) {
      Alert.alert(t('detail.ai_error'), err instanceof Error ? err.message : '');
    } finally {
      setAiLoading(false);
    }
  }, [media, db, objectId, object, collectionDomain, loadData, t]);

  // ── Completeness calculation ────────────────────────────────────────────────

  const completeness = useMemo(() => {
    if (!object) return 0;
    const fields = [
      object.title, object.inventory_number, object.alte_inventarnummer,
      object.klassifikation, object.material, object.technik,
      object.description, object.masse_hoehe, object.masse_breite,
      object.masse_tiefe, object.gewicht, object.durchmesser,
      object.format, object.provenienzangaben, object.erwerbungsart,
      object.erwerbungsdatum, object.veraeusserer,
    ];
    const filled = fields.filter(f => f != null && String(f).trim() !== '' && f !== 'Untitled').length;
    return Math.round((filled / fields.length) * 100);
  }, [object]);

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
  const _mediaGrouped = useMemo(() => {
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
      setViewerUri(resolveMediaUri(m.file_path));
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
      ? `${deviceData.deviceId.slice(0, 8)}\u2026`
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

  // AI field entries from type_specific_data for rendering in AI section
  const aiFieldEntries: { key: string; value: string; confidence?: number }[] = (() => {
    const result: { key: string; value: string; confidence?: number }[] = [];
    for (const [k, v] of Object.entries(extras)) {
      if (k === 'device') continue;
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        const rec = v as Record<string, unknown>;
        if ('value' in rec && 'confidence' in rec) {
          const displayVal = Array.isArray(rec.value) ? (rec.value as string[]).join(', ') : String(rec.value ?? '');
          if (displayVal) {
            result.push({ key: k, value: displayVal, confidence: typeof rec.confidence === 'number' ? rec.confidence : undefined });
          }
        }
      } else if (typeof v === 'string' && v.trim()) {
        result.push({ key: k, value: v });
      }
    }
    return result;
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
        {/* ── HERO IMAGE ───────────────────────────────────────────────────── */}
        {primaryMedia && (
          <Pressable
            style={styles.heroContainer}
            onPress={() => handleMediaTap(primaryMedia)}
            accessibilityRole="image"
            accessibilityLabel={primaryMedia.caption ?? object.title}
          >
            <Image
              source={{ uri: resolveMediaUri(primaryMedia.file_path) }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </Pressable>
        )}

        {/* ── CAPTURE MORE VIEWS ───────────────────────────────────────────── */}
        <View style={styles.heroViewGallery}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.heroViewGalleryContent}
          >
            {STANDARD_VIEW_TYPES.map((viewDef) => {
              const captured = media.find(
                (m) => m.view_type === viewDef.key && m.media_type !== 'derivative_isolated',
              );
              return (
                <Pressable
                  key={viewDef.key}
                  style={styles.heroViewItemWrapper}
                  onPress={() => {
                    if (captured) {
                      setViewerUri(resolveMediaUri(captured.file_path));
                    } else {
                      navigation.navigate('CaptureCamera', {
                        viewType: viewDef.key as RegisterViewType,
                        objectId: object.id,
                      });
                    }
                  }}
                  onLongPress={captured ? () => handleViewTypeLongPress(captured.id, viewDef.key) : undefined}
                  accessibilityRole="button"
                  accessibilityLabel={t(viewDef.labelKey)}
                >
                  <View style={[
                    styles.heroViewItem,
                    captured ? styles.heroViewItemCaptured : styles.heroViewItemEmpty,
                  ]}>
                    {captured ? (
                      <Image
                        source={{ uri: resolveMediaUri(captured.file_path) }}
                        style={styles.heroViewThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <Camera size={24} color={colors.textTertiary} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.heroViewLabel,
                      captured && styles.heroViewLabelCaptured,
                    ]}
                    numberOfLines={2}
                  >
                    {t(viewDef.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── COMPLETION RING + SYNC ────────────────────────────────────────── */}
        <View style={sec.completionRow}>
          <CompletionRing percent={completeness} />
          <Text style={sec.completionText}>{t('detail.completeness', { percent: completeness })}</Text>
        </View>

        <View style={styles.syncBadgeRow}>
          <SyncBadge status={objectSyncStatus} size="md" />
        </View>

        {/* ── REVIEW BANNER ─────────────────────────────────────────────────── */}
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

        {/* ── AI ANALYSIS ───────────────────────────────────────────────────── */}
        <CollapsibleSection title={t('detail.section_ai')} defaultOpen={false}>
          {aiFieldEntries.length > 0 ? (
            aiFieldEntries.map((entry) => (
              <View key={entry.key} style={sec.aiFieldRow}>
                <View style={sec.aiFieldHeader}>
                  <Text style={sec.fieldLabel}>{entry.key}</Text>
                  {entry.confidence != null && (
                    <AIFieldBadge visible confidence={entry.confidence} />
                  )}
                </View>
                <Text style={sec.fieldValue}>{entry.value}</Text>
                {entry.confidence != null && (
                  <View style={sec.confidenceTrack}>
                    <View style={[sec.confidenceFill, { width: `${Math.min(entry.confidence, 100)}%` }]} />
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={sec.emptyText}>{t('detail.no_annotations')}</Text>
          )}

          {/* Enrichment data from AI */}
          {aiMedium != null && (
            <MetadataRow label={t('objectDetail.medium')} value={aiMedium} aiGenerated />
          )}
          {aiCondition != null && (
            <MetadataRow label={t('objectDetail.condition')} value={aiCondition} aiGenerated />
          )}
          {aiKeywords != null && (
            <MetadataRow label={t('objectDetail.keywords')} value={aiKeywords} aiGenerated />
          )}
          {aiDimensions != null && (
            <MetadataRow label={t('objectDetail.dimensions')} value={aiDimensions} aiGenerated />
          )}

          <Pressable
            style={[sec.aiButton, aiLoading && sec.aiButtonDisabled]}
            onPress={handleRunAI}
            disabled={aiLoading}
            accessibilityRole="button"
            accessibilityLabel={t('detail.run_ai')}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={sec.aiButtonText}>{t('detail.run_ai')}</Text>
            )}
          </Pressable>
        </CollapsibleSection>

        {/* ── IDENTIFICATION ────────────────────────────────────────────────── */}
        <CollapsibleSection title={t('detail.section_identification')}>
          <EditableField
            label={t('objects.title')}
            value={object.title === 'Untitled' ? null : object.title}
            onSave={(v) => handleFieldSave('title', v ?? 'Untitled')}
          />
          <EditableField
            label={t('objects.inventory_number')}
            value={object.inventory_number ?? null}
            onSave={(v) => handleFieldSave('inventory_number', v)}
          />
          <EditableField
            label={t('detail.old_inv_number')}
            value={object.alte_inventarnummer ?? null}
            onSave={(v) => handleFieldSave('alte_inventarnummer', v)}
          />
          <EditableField
            label={t('detail.classification')}
            value={object.klassifikation ?? null}
            onSave={(v) => handleFieldSave('klassifikation', v)}
          />
          <MetadataRow
            label={t('objects.object_type')}
            value={typeLabel}
          />

          {/* Persons list */}
          {persons.length > 0 && (
            <View style={sec.personsBlock}>
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
            </View>
          )}

          <EditableField
            label={t('detail.dating')}
            value={object.event_start ?? null}
            onSave={(v) => handleFieldSave('event_start' as string, v)}
          />
          {aiStylePeriod != null && (
            <MetadataRow label={t('detail.epoch')} value={aiStylePeriod} aiGenerated />
          )}
          {aiCultureOrigin != null && (
            <MetadataRow label={t('detail.culture')} value={aiCultureOrigin} aiGenerated />
          )}
        </CollapsibleSection>

        {/* ── DESCRIPTION ───────────────────────────────────────────────────── */}
        <CollapsibleSection title={t('detail.section_description')}>
          <EditableField
            label={t('detail.material')}
            value={object.material ?? null}
            onSave={(v) => handleFieldSave('material', v)}
          />
          <EditableField
            label={t('detail.technique')}
            value={object.technik ?? null}
            onSave={(v) => handleFieldSave('technik', v)}
          />
          <EditableField
            label={t('objects.description')}
            value={object.description}
            onSave={(v) => handleFieldSave('description', v)}
            multiline
          />
          <View style={sec.dimensionGrid}>
            <View style={sec.dimensionCol}>
              <EditableField
                label={t('detail.height')}
                value={object.masse_hoehe ?? null}
                onSave={(v) => handleFieldSave('masse_hoehe', v)}
              />
            </View>
            <View style={sec.dimensionCol}>
              <EditableField
                label={t('detail.width')}
                value={object.masse_breite ?? null}
                onSave={(v) => handleFieldSave('masse_breite', v)}
              />
            </View>
            <View style={sec.dimensionCol}>
              <EditableField
                label={t('detail.depth')}
                value={object.masse_tiefe ?? null}
                onSave={(v) => handleFieldSave('masse_tiefe', v)}
              />
            </View>
            <View style={sec.dimensionCol}>
              <EditableField
                label={t('detail.unit')}
                value={object.masse_einheit ?? null}
                onSave={(v) => handleFieldSave('masse_einheit', v)}
              />
            </View>
          </View>
          <View style={sec.dimensionGrid}>
            <View style={sec.dimensionCol}>
              <EditableField
                label={t('detail.weight')}
                value={object.gewicht ?? null}
                onSave={(v) => handleFieldSave('gewicht', v)}
              />
            </View>
            <View style={sec.dimensionCol}>
              <EditableField
                label={t('detail.weight_unit')}
                value={object.gewicht_einheit ?? null}
                onSave={(v) => handleFieldSave('gewicht_einheit', v)}
              />
            </View>
          </View>
          <View style={sec.dimensionGrid}>
            <View style={sec.dimensionCol}>
              <EditableField
                label={t('detail.diameter')}
                value={object.durchmesser ?? null}
                onSave={(v) => handleFieldSave('durchmesser', v)}
              />
            </View>
            <View style={sec.dimensionCol}>
              <EditableField
                label={t('detail.diameter_unit')}
                value={object.durchmesser_einheit ?? null}
                onSave={(v) => handleFieldSave('durchmesser_einheit', v)}
              />
            </View>
          </View>
          <EditableField
            label={t('detail.format')}
            value={object.format ?? null}
            onSave={(v) => handleFieldSave('format', v)}
          />
        </CollapsibleSection>

        {/* ── CONDITION ─────────────────────────────────────────────────────── */}
        <CollapsibleSection title={t('detail.section_condition')} defaultOpen={false}>
          <ConditionBadge status={object.condition_status} />
          <EditableField
            label={t('detail.current_status')}
            value={object.condition_status ?? null}
            onSave={(v) => handleFieldSave('condition_status', v)}
          />
          <EditableField
            label={t('detail.condition_notes')}
            value={object.condition_note ?? null}
            onSave={(v) => handleFieldSave('condition_note', v)}
            multiline
          />
          <EditableField
            label={t('detail.condition_desc')}
            value={object.erhaltungszustand ?? null}
            onSave={(v) => handleFieldSave('erhaltungszustand', v)}
          />
          <EditableField
            label={t('detail.condition_desc')}
            value={object.zustandsbeschreibung ?? null}
            onSave={(v) => handleFieldSave('zustandsbeschreibung', v)}
            multiline
          />
          <EditableField
            label={t('detail.conservation_needs')}
            value={object.restaurierungsbedarf ?? null}
            onSave={(v) => handleFieldSave('restaurierungsbedarf', v)}
            multiline
          />
        </CollapsibleSection>

        {/* ── PROVENANCE ────────────────────────────────────────────────────── */}
        <CollapsibleSection title={t('detail.section_provenance')} defaultOpen={false}>
          <EditableField
            label={t('detail.provenance_chain')}
            value={object.provenienzangaben ?? null}
            onSave={(v) => handleFieldSave('provenienzangaben', v)}
            multiline
          />
          <EditableField
            label={t('detail.acquisition_method')}
            value={object.erwerbungsart ?? null}
            onSave={(v) => handleFieldSave('erwerbungsart', v)}
          />
          <EditableField
            label={t('detail.acquisition_date')}
            value={object.erwerbungsdatum ?? null}
            onSave={(v) => handleFieldSave('erwerbungsdatum', v)}
          />
          <EditableField
            label={t('detail.source_seller')}
            value={object.veraeusserer ?? null}
            onSave={(v) => handleFieldSave('veraeusserer', v)}
          />
          <EditableField
            label={t('detail.problematic_provenance')}
            value={object.belastete_provenienz_notizen ?? null}
            onSave={(v) => handleFieldSave('belastete_provenienz_notizen' as string, v)}
            multiline
          />
          <EditableField
            label={t('detail.inscriptions')}
            value={object.inschriften ?? null}
            onSave={(v) => handleFieldSave('inschriften', v)}
          />
          <EditableField
            label={t('objectDetail.keywords')}
            value={object.markierungen ?? null}
            onSave={(v) => handleFieldSave('markierungen', v)}
          />
        </CollapsibleSection>

        {/* ── LOCATION ──────────────────────────────────────────────────────── */}
        <CollapsibleSection title={t('detail.section_location')} defaultOpen={false}>
          <EditableField
            label={t('detail.building')}
            value={object.standort_gebaeude ?? null}
            onSave={(v) => handleFieldSave('standort_gebaeude', v)}
          />
          <EditableField
            label={t('detail.floor')}
            value={object.standort_etage ?? null}
            onSave={(v) => handleFieldSave('standort_etage', v)}
          />
          <EditableField
            label={t('detail.room')}
            value={object.standort_raum ?? null}
            onSave={(v) => handleFieldSave('standort_raum', v)}
          />
          <EditableField
            label={t('detail.shelf')}
            value={object.standort_regal ?? null}
            onSave={(v) => handleFieldSave('standort_regal', v)}
          />
          <EditableField
            label={t('detail.location_notes')}
            value={object.standort_hinweise ?? null}
            onSave={(v) => handleFieldSave('standort_hinweise', v)}
            multiline
          />
          <EditableField
            label={t('detail.current_status')}
            value={object.aktueller_status ?? null}
            onSave={(v) => handleFieldSave('aktueller_status', v)}
          />

          {/* LocationPicker */}
          <View style={sec.locationPickerWrap}>
            <LocationPicker
              objectId={object.id}
              initialBuilding={object.location_building}
              initialFloor={object.location_floor}
              initialRoom={object.location_room}
              initialShelf={object.location_shelf}
              initialNotes={object.location_notes}
            />
          </View>

          {/* Map link card */}
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
            <View style={sec.mapLinkFlex}>
              <Text style={styles.mapLinkTitle}>
                {mapPinInfo ? `Placed on ${mapPinInfo.mapName}` : 'Place on map'}
              </Text>
              <Text style={styles.mapLinkSub}>
                {mapPinInfo ? 'View on floor map' : 'Pin this object to a floor plan'}
              </Text>
            </View>
            <ForwardIcon size={16} color={colors.textTertiary} />
          </Pressable>
        </CollapsibleSection>

        {/* ── HISTORY ───────────────────────────────────────────────────────── */}
        <CollapsibleSection title={t('detail.section_history')} defaultOpen={false}>
          {auditTrail.length > 0 ? (
            auditTrail.map((entry) => {
              const actionColor: string = entry.action === 'insert' ? colors.success : entry.action === 'update' ? colors.info : entry.action === 'delete' ? colors.error : colors.textSecondary;
              const actionLabel = entry.action === 'insert' ? t('detail.action_insert') : entry.action === 'update' ? t('detail.action_update') : entry.action === 'delete' ? t('detail.action_delete') : entry.action;

              return (
                <View key={entry.id} style={sec.auditItem}>
                  <View style={[sec.auditDot, { backgroundColor: actionColor }]} />
                  <View style={sec.auditContent}>
                    <Text style={sec.auditAction}>{actionLabel}</Text>
                    <Text style={sec.auditDate}>{formatDate(entry.created_at)}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={sec.emptyText}>{t('detail.no_history')}</Text>
          )}
        </CollapsibleSection>

        {/* ── ANNOTATIONS ───────────────────────────────────────────────────── */}
        <CollapsibleSection title={t('detail.section_annotations')} defaultOpen={false}>
          {annotations.length > 0 ? (
            annotations.map((ann) => (
              <View key={ann.id} style={sec.annotationItem}>
                <Badge variant="neutral" label={ann.annotation_type} size="sm" />
                <Text style={sec.annotationContent}>{ann.content}</Text>
                <Text style={sec.annotationDate}>{formatDate(ann.created_at)}</Text>
              </View>
            ))
          ) : (
            <Text style={sec.emptyText}>{t('detail.no_annotations')}</Text>
          )}
        </CollapsibleSection>

        {/* ── DOCUMENTS ─────────────────────────────────────────────────────── */}
        <CollapsibleSection title={t('detail.section_documents')}>
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
        </CollapsibleSection>

        {/* ── PROTOCOL STATUS ────────────────────────────────────────────────── */}
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

        {/* ── CAPTURE METADATA ───────────────────────────────────────────────── */}
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

        {/* ── CHECKLIST ─────────────────────────────────────────────────────── */}
        <View style={sec.paddedSection}>
          <ObjectChecklist
            objectId={object.id}
            viewCount={media.filter((m) => m.view_type && STANDARD_VIEW_TYPES.some((v) => v.key === m.view_type)).length}
            hasAI={!!(object.description && object.title && object.title !== 'Untitled')}
          />
        </View>

        {/* Bottom spacer for fixed action bar */}
        <View style={{ height: ACTION_BAR_HEIGHT + spacing.xl }} />
      </ScrollView>

      {/* ── FIXED ACTION BAR ────────────────────────────────────────────────── */}
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

// ── Section styles (sec namespace) ────────────────────────────────────────────

function makeSec(c: ColorPalette) {
  return StyleSheet.create({
    section: {
      paddingHorizontal: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    sectionTitle: {
      fontSize: typography.size.lg,
      fontWeight: typography.weight.semibold,
      color: c.text,
    },
    sectionBody: {
      paddingTop: 8,
      paddingBottom: spacing.md,
    },
    // CompletionRing
    ringContainer: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringText: {
      position: 'absolute',
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
      color: c.text,
    },
    completionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    completionText: {
      fontSize: typography.size.base,
      fontWeight: typography.weight.medium,
      color: c.textSecondary,
    },
    // EditableField
    editableContainer: {
      marginTop: 12,
      minHeight: touch.minTarget,
      justifyContent: 'center',
    },
    fieldLabel: {
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    fieldValue: {
      fontSize: typography.size.md,
      color: c.text,
    },
    fieldEmpty: {
      fontSize: typography.size.md,
      color: c.textMuted,
    },
    fieldInput: {
      fontSize: typography.size.md,
      color: c.text,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderFocused,
      borderRadius: radii.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    fieldInputMultiline: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    // ConditionBadge
    conditionPill: {
      alignSelf: 'flex-start',
      borderRadius: radii.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginTop: spacing.sm,
    },
    conditionPillText: {
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    // Dimensions grid
    dimensionGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    dimensionCol: {
      flex: 1,
    },
    // Persons block
    personsBlock: {
      marginTop: spacing.sm,
    },
    // Location picker wrap
    locationPickerWrap: {
      marginTop: spacing.sm,
    },
    mapLinkFlex: {
      flex: 1,
    },
    // AI section
    aiFieldRow: {
      marginTop: spacing.md,
    },
    aiFieldHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    confidenceTrack: {
      height: 3,
      borderRadius: 1.5,
      backgroundColor: c.border,
      marginTop: 4,
    },
    confidenceFill: {
      height: 3,
      borderRadius: 1.5,
      backgroundColor: c.accent,
    },
    aiButton: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: c.accent,
      borderRadius: radii.md,
      minHeight: touch.minTarget,
    },
    aiButtonDisabled: {
      opacity: 0.5,
    },
    aiButtonText: {
      fontSize: typography.size.base,
      fontWeight: typography.weight.semibold,
      color: c.accent,
    },
    // Annotations
    annotationItem: {
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: spacing.xs,
    },
    annotationContent: {
      fontSize: typography.size.base,
      color: c.text,
      lineHeight: 20,
    },
    annotationDate: {
      fontSize: typography.size.sm,
      color: c.textSecondary,
    },
    // Audit trail
    auditItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    auditDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 4,
    },
    auditContent: {
      flex: 1,
    },
    auditAction: {
      fontSize: typography.size.base,
      fontWeight: typography.weight.medium,
      color: c.text,
    },
    auditDate: {
      fontSize: typography.size.sm,
      color: c.textSecondary,
      marginTop: 2,
    },
    // Empty state text
    emptyText: {
      fontSize: typography.size.base,
      color: c.textSecondary,
      paddingVertical: spacing.md,
    },
    // Padded section wrapper
    paddedSection: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
  });
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.background,
    },
    // Header
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.background,
    },
    headerTitle: {
      ...typography.h4,
      color: c.text,
      flex: 1,
      marginHorizontal: spacing.sm,
    },
    // Breadcrumb
    breadcrumbScroll: {
      flexGrow: 0,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    breadcrumbContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    breadcrumbLink: {
      ...typography.caption,
      color: c.textMuted,
    },
    breadcrumbSep: {
      marginHorizontal: spacing.xs,
    },
    breadcrumbCurrent: {
      ...typography.caption,
      color: c.text,
      fontWeight: '600',
      flexShrink: 1,
    },
    // Scroll
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 0,
      paddingBottom: 100,
    },
    // Hero image
    heroContainer: {
      width: '100%',
      maxHeight: 300,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    heroImage: {
      width: '100%',
      height: 300,
    },
    // Hero view gallery (thumbnails below hero)
    heroViewGallery: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    heroViewGalleryContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    heroViewItemWrapper: {
      alignItems: 'center',
      width: 88,
    },
    heroViewItem: {
      width: 80,
      height: 80,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    heroViewItemCaptured: {
      borderWidth: 2,
      borderColor: c.success,
    },
    heroViewItemEmpty: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderStyle: 'dashed',
    },
    heroViewThumb: {
      width: '100%',
      height: '100%',
    },
    heroViewLabel: {
      ...typography.caption,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      fontSize: 11,
    },
    heroViewLabelCaptured: {
      color: c.success,
      fontWeight: typography.weight.semibold,
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
      backgroundColor: c.primary,
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
      borderColor: c.success,
    },
    viewGalleryItemEmpty: {
      borderWidth: 1.5,
      borderColor: c.border,
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
      backgroundColor: c.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewGalleryLabel: {
      ...typography.caption,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 2,
      paddingHorizontal: 2,
    },
    viewGalleryLabelCaptured: {
      color: c.success,
      fontWeight: typography.weight.semibold,
    },
    viewDimensionRow: {
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
    },
    viewDimensionLabel: {
      ...typography.caption,
      color: c.textSecondary,
      marginBottom: 4,
    },
    viewDimensionInput: {
      backgroundColor: c.surface,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.bodySmall,
      color: c.text,
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
      borderColor: c.heroGreen,
      borderRadius: radii.lg,
      minHeight: touch.minTarget,
    },
    addVideoBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.heroGreen,
    },
    // Map link card
    mapLinkCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surfaceElevated,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: touch.minTarget,
      marginTop: spacing.sm,
    },
    mapLinkTitle: {
      fontSize: 13,
      fontWeight: typography.weight.semibold,
      color: c.text,
    },
    mapLinkSub: {
      fontSize: 11,
      color: c.textSecondary,
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
      backgroundColor: c.warningLight,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.warning,
    },
    reviewBannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    reviewBannerTitle: {
      ...typography.bodyMedium,
      color: c.statusWarning,
    },
    reviewBannerText: {
      ...typography.bodySmall,
      color: c.textSecondary,
      marginBottom: spacing.md,
    },
    // Cards
    card: {
      borderRadius: 0,
      borderWidth: 0,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
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
      color: c.error,
      textAlign: 'center',
    },
    // Action bar
    actionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: ACTION_BAR_HEIGHT,
      paddingHorizontal: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.background,
    },
    actionSpacer: {
      flex: 1,
    },
    // Documents section
    emptyDocumentsText: {
      ...typography.bodySmall,
      color: c.textSecondary,
      paddingVertical: spacing.sm,
    },
    documentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      minHeight: touch.minTarget,
    },
    documentThumb: {
      width: 56,
      height: 56,
      borderRadius: radii.sm,
      backgroundColor: c.surface,
    },
    documentInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    documentOcrPreview: {
      ...typography.bodySmall,
      color: c.text,
    },
    documentNoText: {
      ...typography.bodySmall,
      color: c.textTertiary,
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
      borderColor: c.primary,
      borderRadius: radii.md,
      minHeight: touch.minTarget,
    },
    scanButtonDisabled: {
      opacity: 0.5,
    },
    scanButtonText: {
      ...typography.bodyMedium,
      color: c.primary,
    },
    // Gallery groups (protocol objects)
    galleryGroup: {
      marginBottom: spacing.md,
    },
    galleryGroupLabel: {
      ...typography.label,
      color: c.textSecondary,
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
      borderColor: c.border,
    },
    protocolShotLabel: {
      ...typography.bodySmall,
      color: c.text,
      flex: 1,
    },
    protocolShotDone: {
      color: c.textSecondary,
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
      color: c.textSecondary,
      fontWeight: typography.weight.medium,
    },
  });
}
