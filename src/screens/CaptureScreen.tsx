/* eslint-disable react-native/no-color-literals, react-native/no-inline-styles */
import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraType, FlashMode } from 'expo-camera';
import { File } from 'expo-file-system';
import type { RootStackParamList } from '../navigation/RootStack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { pickFromLibrary, type CaptureResult } from '../services/capture';
import { extractMetadata, type CaptureMetadata } from '../services/metadata';
import { createDraftObject } from '../services/draftObject';
import { quickCapture, type LocationData } from '../services/quickCapture';
import { addMediaToObject } from '../services/mediaService';
import { computeSHA256 } from '../utils/hash';
import {
  getSetting,
  setSetting,
  SETTING_KEYS,
} from '../services/settingsService';
import { TypeSelector } from '../components/TypeSelector';
import { ScanIcon, AddPhotoIcon } from '../theme/icons';
import { X, ChevronDown, Zap, RefreshCw } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import type { ObjectType, RegisterObject, RegisterViewType } from '../db/types';
import { DEFAULT_FIRST_VIEW } from '../constants/viewTypes';
import {
  launchDocumentScanner,
  processDocumentScan,
  extractTextOnDevice,
} from '../services/documentScanService';
import { typography, spacing, radii, layout, touch } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { ImageViewer } from '../components/ImageViewer';
import { useCaptureProtocol } from '../hooks/useCaptureProtocol';
import { ProtocolPicker } from '../components/ProtocolPicker';
import { CaptureGuidanceOverlay } from '../components/CaptureGuidanceOverlay';
import { ShotListSidebar } from '../components/ShotListSidebar';
import { TipsModal } from '../components/TipsModal';
import { CompletionSummary } from '../components/CompletionSummary';

// Camera-specific overlay colours — rgba values intentionally outside the design
// system token set because they are camera-viewfinder-only and must meet contrast
// requirements against arbitrary scene content.
const OVERLAY_GRID = 'rgba(255,255,255,0.3)';
const OVERLAY_LEVEL_TILTED = 'rgba(255,255,255,0.5)';
const OVERLAY_LEVEL_FLAT = 'rgba(45,90,39,0.85)';
const OVERLAY_COUNT_BG = 'rgba(0,0,0,0.55)';

type Phase = 'idle' | 'extracting' | 'preview' | 'type_select' | 'saving' | 'done';
type CaptureMode = 'quick' | 'full';

interface QuickCaptureThumbnail {
  objectId: string;
  uri: string;
}

const CAPTURE_MODE_KEY = 'capture.mode';
const RECENT_OBJECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const FLASH_CYCLE: FlashMode[] = ['off', 'on', 'auto'];

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function flashIcon(mode: FlashMode): string {
  if (mode === 'on') return '\u26A1'; // ⚡ bright
  if (mode === 'auto') return '\u26A1\u1D2C'; // ⚡ᴬ  (superscript A)
  return '\u26A1'; // ⚡ dim (off)
}

function flashLabel(mode: FlashMode, t: (k: string) => string): string {
  if (mode === 'on') return t('capture.flash_on');
  if (mode === 'auto') return t('capture.flash_auto');
  return t('capture.flash_off');
}

// ── SVG corner bracket ────────────────────────────────────────────────────────

const BRACKET_SIZE = 40;

function CornerBracket({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s = BRACKET_SIZE;
  const paths: Record<string, string> = {
    tl: `M 0 ${s} L 0 0 L ${s} 0`,
    tr: `M 0 0 L ${s} 0 L ${s} ${s}`,
    bl: `M 0 0 L 0 ${s} L ${s} ${s}`,
    br: `M 0 ${s} L ${s} ${s} L ${s} 0`,
  };
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path d={paths[corner]} stroke="rgba(255,255,255,0.85)" strokeWidth={2} fill="none" strokeLinecap="square" />
    </Svg>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function CaptureScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const db = useDatabase();
  const { t } = useAppTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CaptureCamera'>>();

  // Multi-view capture params (from ViewChecklistScreen or QuickIDScreen)
  const routeViewType = route.params?.viewType as RegisterViewType | undefined;
  const routeObjectId = route.params?.objectId as string | undefined;

  // Object title for display pill (when coming from QuickID or ViewChecklist)
  const [objectTitle, setObjectTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!routeObjectId) return;
    db.getFirstAsync<{ title: string }>(
      'SELECT title FROM objects WHERE id = ?',
      [routeObjectId],
    ).then((row) => {
      if (row && row.title !== 'Untitled') setObjectTitle(row.title);
    }).catch(() => {});
  }, [db, routeObjectId]);

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Camera settings
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [cameraReady, setCameraReady] = useState(false);

  // (Video recording moved to ObjectDetail "Add Video" flow)

  const cameraRef = useRef<CameraView>(null);
  const protocolFirstObjectIdRef = useRef<string | null>(null);

  // Capture / form state
  const [phase, setPhase] = useState<Phase>('idle');
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [metadata, setMetadata] = useState<CaptureMetadata | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [defaultObjectType, setDefaultObjectType] = useState<ObjectType | null>(null);

  // Pinch-to-zoom
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const baseZoomRef = useRef(0);
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const z = Math.min(1, Math.max(0, baseZoomRef.current + (e.scale - 1) * 0.3));
      zoomRef.current = z;
      setZoom(z);
    })
    .onEnd(() => { baseZoomRef.current = zoomRef.current; });

  // Grid overlay
  const [gridEnabled, setGridEnabled] = useState(false);

  // Level indicator
  const [isLevel, setIsLevel] = useState(false);
  const [tiltAnim] = useState(() => new Animated.Value(0));

  // Session photo count (increments on each successful save)
  const [sessionPhotoCount, setSessionPhotoCount] = useState(0);

  // Capture mode (quick vs full)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('quick');

  // Quick-capture thumbnails (session-only, not persisted)
  const [quickThumbnails, setQuickThumbnails] = useState<QuickCaptureThumbnail[]>([]);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Shutter flash animation
  const [shutterFlashAnim] = useState(() => new Animated.Value(0));

  // Reduced motion preference
  const [reduceMotion, setReduceMotion] = useState(false);

  // Intro overlay (first-time guidance)
  const [showIntro, setShowIntro] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // Protocol guidance
  const protocolHook = useCaptureProtocol();
  const [showProtocolPicker, setShowProtocolPicker] = useState(false);
  const [showShotList, setShowShotList] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);
  const [, setProtocolPickerDismissed] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('capture_intro_dismissed').then((val) => {
      if (val !== 'true') setShowIntro(true);
    });
  }, []);

  // Load persisted grid preference
  useEffect(() => {
    AsyncStorage.getItem('camera.gridEnabled').then((val) => {
      if (val === 'true') setGridEnabled(true);
    });
  }, []);

  // Load persisted capture mode
  useEffect(() => {
    AsyncStorage.getItem(CAPTURE_MODE_KEY).then((val) => {
      if (val === 'quick' || val === 'full') setCaptureMode(val);
    });
  }, []);

  // Accelerometer subscription for level indicator
  useEffect(() => {
    Accelerometer.setUpdateInterval(150);
    const subscription = Accelerometer.addListener(({ x }) => {
      // x-axis = left/right tilt in portrait mode
      const deg = Math.asin(Math.max(-1, Math.min(1, x))) * (180 / Math.PI);
      const clamped = Math.max(-15, Math.min(15, deg));
      setIsLevel(Math.abs(deg) <= 2);
      if (reduceMotion) {
        tiltAnim.setValue(clamped);
      } else {
        Animated.spring(tiltAnim, {
          toValue: clamped,
          useNativeDriver: true,
          friction: 8,
          tension: 80,
        }).start();
      }
    });
    return () => subscription.remove();
  }, [tiltAnim, reduceMotion]);

  // Load persisted flash preference
  useEffect(() => {
    getSetting(db, SETTING_KEYS.CAMERA_FLASH_MODE).then((val) => {
      if (val === 'on' || val === 'auto' || val === 'off') {
        setFlashMode(val as FlashMode);
      }
    });
  }, [db]);

  // Show completion summary when protocol transitions to reviewing
  useEffect(() => {
    if (protocolHook.state === 'reviewing' && protocolHook.protocol) {
      setShowCompletionSummary(true);
    }
  }, [protocolHook.state, protocolHook.protocol]);

  const handleProtocolSelect = useCallback((protocolId: string) => {
    protocolFirstObjectIdRef.current = null;
    protocolHook.selectProtocol(protocolId);
    setShowProtocolPicker(false);
    setProtocolPickerDismissed(true);
  }, [protocolHook]);

  const handleProtocolSkip = useCallback(() => {
    protocolHook.clearProtocol();
    setShowProtocolPicker(false);
    setProtocolPickerDismissed(true);
  }, [protocolHook]);

  const processCapture = useCallback(
    async (result: CaptureResult) => {
      setCapture(result);
      setPhase('extracting');
      const [meta, fileHash, storedType] = await Promise.all([
        extractMetadata(result.exif),
        computeSHA256(result.uri),
        getSetting(db, SETTING_KEYS.DEFAULT_OBJECT_TYPE),
      ]);
      setMetadata(meta);
      setHash(fileHash);
      setDefaultObjectType((storedType as ObjectType) ?? null);
      setPhase('preview');
    },
    [db],
  );

  // ── Camera controls ──────────────────────────────────────────────────────────

  const handleFlashToggle = useCallback(() => {
    setFlashMode((prev) => {
      const idx = FLASH_CYCLE.indexOf(prev);
      const next = FLASH_CYCLE[(idx + 1) % FLASH_CYCLE.length];
      setSetting(db, SETTING_KEYS.CAMERA_FLASH_MODE, next);
      return next;
    });
  }, [db]);

  const handleFacingToggle = useCallback(() => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleModeToggle = useCallback((mode: CaptureMode) => {
    setCaptureMode(mode);
    AsyncStorage.setItem(CAPTURE_MODE_KEY, mode);
    // Reset protocol when switching to quick mode
    if (mode === 'quick') {
      protocolHook.reset();
      setProtocolPickerDismissed(false);
    }
  }, [protocolHook]);

  // Shutter flash effect (white overlay 0→0.8→0 in 150ms)
  const triggerShutterFlash = useCallback(() => {
    if (reduceMotion) return;
    shutterFlashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shutterFlashAnim, {
        toValue: 0.8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shutterFlashAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shutterFlashAnim, reduceMotion]);

  // Protocol-aware shutter: captures a photo and tags it with shot metadata.
  // First shot creates the object + primary media; subsequent shots add media
  // to the same object so the protocol produces ONE object with multiple photos.
  const handleProtocolShutter = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || !protocolHook.currentShot || !protocolHook.protocol) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: true,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      triggerShutterFlash();

      const photoUri = pic.uri;
      const currentShotId = protocolHook.currentShot.id;
      const currentShotOrder = protocolHook.currentShot.order;
      const currentProtocolId = protocolHook.protocol.id;
      const existingObjectId = protocolFirstObjectIdRef.current;

      // Fire and forget — camera stays live, like quick mode
      (async () => {
        try {
          let objectId: string;
          let newMediaId: string | null = null;

          if (!existingObjectId) {
            // First shot: create object + primary media via quickCapture
            // (quickCapture handles file copy, SHA-256, audit, sync internally)
            const meta = await extractMetadata(pic.exif ?? null);
            const location: LocationData | null =
              meta.latitude != null && meta.longitude != null
                ? {
                    latitude: meta.latitude,
                    longitude: meta.longitude,
                    altitude: meta.altitude,
                    accuracy: meta.accuracy,
                    coordinateSource: meta.coordinateSource ?? 'gps_hardware',
                  }
                : null;

            objectId = await quickCapture(db, photoUri, location);
            protocolFirstObjectIdRef.current = objectId;
          } else {
            // Subsequent shots: add media to the existing object
            // (addMediaToObject handles file copy, SHA-256, audit, sync internally)
            objectId = existingObjectId;
            const media = await addMediaToObject(db, objectId, photoUri, 'image/jpeg');
            newMediaId = media.id;
          }

          // Tag the object with protocol metadata
          const now = new Date().toISOString();
          const completedKeys = [...protocolHook.completedShots.keys(), currentShotId];
          const remainingKeys = protocolHook.protocol!.shots
            .filter((s) => !completedKeys.includes(s.id) && !protocolHook.skippedShots.has(s.id))
            .map((s) => s.id);

          await db.runAsync(
            `UPDATE objects SET protocol_id = ?, protocol_complete = ?, shots_completed = ?, shots_remaining = ?, updated_at = ? WHERE id = ?`,
            [
              currentProtocolId,
              remainingKeys.length === 0 ? 1 : 0,
              JSON.stringify(completedKeys),
              JSON.stringify(remainingKeys),
              now,
              objectId,
            ],
          );

          // Tag the media record with shot metadata
          if (newMediaId) {
            // Subsequent shot: tag specific media by its ID
            await db.runAsync(
              `UPDATE media SET shot_type = ?, protocol_id = ?, shot_order = ?, updated_at = ? WHERE id = ?`,
              [currentShotId, currentProtocolId, currentShotOrder, now, newMediaId],
            );
          } else {
            // First shot: tag primary media
            await db.runAsync(
              `UPDATE media SET shot_type = ?, protocol_id = ?, shot_order = ?, updated_at = ? WHERE object_id = ? AND is_primary = 1`,
              [currentShotId, currentProtocolId, currentShotOrder, now, objectId],
            );
          }

          // Advance the protocol hook
          protocolHook.captureShot(currentShotId, photoUri);

          setQuickThumbnails((prev) => [...prev, { objectId, uri: photoUri }]);
          setSessionPhotoCount((prev) => prev + 1);
          setQuickError(null);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setQuickError(msg);
          setTimeout(() => setQuickError(null), 3000);
        }
      })();
    } catch {
      // Camera not ready — ignore
    }
  }, [cameraReady, db, triggerShutterFlash, protocolHook]);

  const handleQuickShutter = useCallback(async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: true,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      triggerShutterFlash();

      // Build location data from EXIF (fire-and-forget below)
      const photoUri = pic.uri;
      const exif = pic.exif ?? null;

      // Fire and forget — camera stays live
      (async () => {
        try {
          // Extract location from EXIF synchronously enough to pass to quickCapture
          const meta = await extractMetadata(exif);
          const location: LocationData | null =
            meta.latitude != null && meta.longitude != null
              ? {
                  latitude: meta.latitude,
                  longitude: meta.longitude,
                  altitude: meta.altitude,
                  accuracy: meta.accuracy,
                  coordinateSource: meta.coordinateSource ?? 'gps_hardware',
                }
              : null;

          const objectId = await quickCapture(db, photoUri, location);

          // Tag the primary media with ansicht_front view_type
          const now = new Date().toISOString();
          await db.runAsync(
            `UPDATE media SET view_type = ?, updated_at = ? WHERE object_id = ? AND is_primary = 1`,
            [DEFAULT_FIRST_VIEW, now, objectId],
          );
          // Sync the view_type update
          const primaryRow = await db.getFirstAsync<{ id: string }>(
            `SELECT id FROM media WHERE object_id = ? AND is_primary = 1`,
            [objectId],
          );
          if (primaryRow) {
            const { SyncEngine: SE } = await import('../sync/engine');
            const se = new SE(db);
            await se.queueChange('media', primaryRow.id, 'update', { view_type: DEFAULT_FIRST_VIEW });
          }

          setQuickThumbnails((prev) => [...prev, { objectId, uri: photoUri }]);
          setSessionPhotoCount((prev) => prev + 1);
          setQuickError(null);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setQuickError(msg);
          // Auto-dismiss error after 3 seconds
          setTimeout(() => setQuickError(null), 3000);
        }
      })();
    } catch {
      // Camera not ready — ignore
    }
  }, [cameraReady, db, triggerShutterFlash]);

  // Multi-view capture shutter: captures a photo for a specific Registerbogen view
  // and adds it to an existing object with the correct view_type
  const handleViewTypeShutter = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || !routeViewType || !routeObjectId) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: true,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      triggerShutterFlash();

      const photoUri = pic.uri;
      const viewType = routeViewType;
      const objectId = routeObjectId;

      // Fire and forget — camera stays live
      (async () => {
        try {
          // addMediaToObject handles file copy, SHA-256, audit, sync
          const media = await addMediaToObject(db, objectId, photoUri, 'image/jpeg');

          // Tag media with view_type
          const now = new Date().toISOString();
          await db.runAsync(
            `UPDATE media SET view_type = ?, updated_at = ? WHERE id = ?`,
            [viewType, now, media.id],
          );
          // Sync the view_type update
          const { SyncEngine: SE } = await import('../sync/engine');
          const se = new SE(db);
          await se.queueChange('media', media.id, 'update', { view_type: viewType });

          setSessionPhotoCount((prev) => prev + 1);
          setQuickError(null);

          // Navigate back to ViewChecklist
          navigation.navigate('ViewChecklist', { objectId });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setQuickError(msg);
          setTimeout(() => setQuickError(null), 3000);
        }
      })();
    } catch {
      // Camera not ready — ignore
    }
  }, [cameraReady, db, triggerShutterFlash, routeViewType, routeObjectId, navigation]);

  const handleShutter = useCallback(async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: true,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      triggerShutterFlash();

      // Extract metadata + hash, then navigate to review screen
      const meta = await extractMetadata(pic.exif ?? null);
      const fileHash = await computeSHA256(pic.uri);

      navigation.navigate('CaptureReview', {
        imageUri: pic.uri,
        mimeType: 'image/jpeg',
        metadata: meta,
        sha256Hash: fileHash,
      });
    } catch {
      // Camera not ready or other error — ignore silently
    }
  }, [cameraReady, navigation, triggerShutterFlash]);

  const handleLibrary = useCallback(async () => {
    const results = await pickFromLibrary();
    if (results.length > 0) await processCapture(results[0]);
  }, [processCapture]);

  // ── Post-capture handlers ─────────────────────────────────────────────────

  const handleSave = useCallback(
    async (objectType: ObjectType) => {
      if (!capture || !metadata) return;
      setPhase('saving');
      try {
        const objectId = await createDraftObject(db, {
          imageUri: capture.uri,
          fileName: capture.fileName,
          fileSize: capture.fileSize,
          mimeType: capture.mimeType,
          metadata,
          objectType,
        });
        setSavedId(objectId);
        setSessionPhotoCount((prev) => prev + 1);
        setPhase('done');
      } catch {
        setPhase('type_select');
      }
    },
    [capture, metadata, db],
  );

  const handleTypeSelect = useCallback(
    (type: ObjectType) => {
      handleSave(type);
    },
    [handleSave],
  );

  const handleSkipType = useCallback(() => {
    handleSave(defaultObjectType ?? 'museum_object');
  }, [handleSave, defaultObjectType]);

  const handleDismissIntro = useCallback(() => {
    setShowIntro(false);
    AsyncStorage.setItem('capture_intro_dismissed', 'true');
  }, []);

  const handleRetake = useCallback(() => {
    setCapture(null);
    setMetadata(null);
    setHash(null);
    setSavedId(null);
    setDefaultObjectType(null);
    setCameraReady(false);
    setPhase('idle');
  }, []);

  const handleViewObjects = useCallback(() => {
    const id = savedId;
    handleRetake();
    if (id) {
      navigation.navigate('ObjectDetail', { objectId: id });
    } else {
      navigation.navigate('Home');
    }
  }, [navigation, handleRetake, savedId]);

  const handleDirectSave = useCallback(async () => {
    if (!capture || !metadata) return;
    setPhase('saving');
    try {
      const objectId = await createDraftObject(db, {
        imageUri: capture.uri,
        fileName: capture.fileName,
        fileSize: capture.fileSize,
        mimeType: capture.mimeType,
        metadata,
        objectType: defaultObjectType ?? 'museum_object',
      });

      // Tag with protocol metadata if a protocol is active
      if (protocolHook.protocol && protocolHook.currentShot) {
        const now = new Date().toISOString();
        const shotId = protocolHook.currentShot.id;
        const completedKeys = [...protocolHook.completedShots.keys(), shotId];
        const remainingKeys = protocolHook.protocol.shots
          .filter((s) => !completedKeys.includes(s.id) && !protocolHook.skippedShots.has(s.id))
          .map((s) => s.id);

        await db.runAsync(
          `UPDATE objects SET protocol_id = ?, protocol_complete = ?, shots_completed = ?, shots_remaining = ?, updated_at = ? WHERE id = ?`,
          [
            protocolHook.protocol.id,
            remainingKeys.length === 0 ? 1 : 0,
            JSON.stringify(completedKeys),
            JSON.stringify(remainingKeys),
            now,
            objectId,
          ],
        );
        await db.runAsync(
          `UPDATE media SET shot_type = ?, protocol_id = ?, shot_order = ?, updated_at = ? WHERE object_id = ? AND is_primary = 1`,
          [shotId, protocolHook.protocol.id, protocolHook.currentShot.order, now, objectId],
        );
        protocolHook.captureShot(shotId, capture.uri);
      } else {
        // No protocol active: tag primary media with ansicht_front
        const now = new Date().toISOString();
        await db.runAsync(
          `UPDATE media SET view_type = ?, updated_at = ? WHERE object_id = ? AND is_primary = 1`,
          [DEFAULT_FIRST_VIEW, now, objectId],
        );
        // Sync the view_type update
        const pRow = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM media WHERE object_id = ? AND is_primary = 1`,
          [objectId],
        );
        if (pRow) {
          const { SyncEngine: SE } = await import('../sync/engine');
          const se = new SE(db);
          await se.queueChange('media', pRow.id, 'update', { view_type: DEFAULT_FIRST_VIEW });
        }
      }

      setSessionPhotoCount((prev) => prev + 1);
      // Navigate to AI Review screen for Gemini analysis
      const photoUri = capture.uri;
      navigation.navigate('AIReview', { objectId, photoUri });
      handleRetake();
    } catch {
      setPhase('preview');
    }
  }, [capture, metadata, db, defaultObjectType, navigation, handleRetake, protocolHook]);

  const handleAnalyzeWithAI = useCallback(async () => {
    if (!capture || !metadata) return;
    setPhase('saving'); // reuse spinner phase to show loading
    try {
      const file = new File(capture.uri);
      const imageBase64 = await file.base64();
      navigation.navigate('AIProcessing', {
        imageUri: capture.uri,
        imageBase64,
        mimeType: capture.mimeType,
        captureMetadata: metadata,
        sha256Hash: hash ?? undefined,
      });
      // Reset capture state so returning here shows the camera
      handleRetake();
    } catch {
      // Base64 read failed — fall back to type select
      setPhase('type_select');
    }
  }, [capture, metadata, hash, navigation, handleRetake]);

  const handleThumbnailPress = useCallback(
    (objectId: string) => {
      navigation.navigate('ObjectDetail', { objectId });
    },
    [navigation],
  );

  // ── Document scan from camera ───────────────────────────────────────────────

  const handleDocumentScan = useCallback(async () => {
    const scanResult = await launchDocumentScanner();
    if (!scanResult) return; // user cancelled

    try {
      // Find the most recent object (within 5 minutes)
      const cutoff = new Date(Date.now() - RECENT_OBJECT_WINDOW_MS).toISOString();
      const recentObj = await db.getFirstAsync<Pick<RegisterObject, 'id' | 'title'>>(
        `SELECT id, title FROM objects WHERE created_at > ? ORDER BY created_at DESC LIMIT 1`,
        [cutoff],
      );

      let targetObjectId: string;
      let feedbackMsg: string;

      if (recentObj) {
        // Path A: link to most recent object
        targetObjectId = recentObj.id;
        feedbackMsg = recentObj.title === 'Untitled' || recentObj.title === 'Untitled Object'
          ? t('capture.document_linked_last')
          : t('capture.document_linked', { title: recentObj.title });
      } else {
        // Path B: create standalone object
        const { generateId } = await import('../utils/uuid');
        const objId = generateId();
        const now = new Date().toISOString();
        const privacyTier =
          (await getSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER)) ?? 'public';

        await db.withTransactionAsync(async () => {
          await db.runAsync(
            `INSERT INTO objects
               (id, object_type, status, title, review_status,
                privacy_tier, legal_hold, created_at, updated_at)
             VALUES (?, 'uncategorized', 'draft', ?, 'needs_review',
                     ?, 0, ?, ?)`,
            [objId, t('capture.document_scan_title'), privacyTier, now, now],
          );

          const { logAuditEntry: logAudit } = await import('../db/audit');
          await logAudit(db, {
            tableName: 'objects',
            recordId: objId,
            action: 'document_scan_standalone',
            newValues: { objectId: objId },
          });

          const { SyncEngine: SE } = await import('../sync/engine');
          const syncEngine = new SE(db);
          await syncEngine.queueChange('objects', objId, 'insert', { objectId: objId });
        });

        targetObjectId = objId;
        feedbackMsg = t('capture.document_saved_standalone');
      }

      // Store the document scan (raw + deskewed)
      const record = await processDocumentScan(
        db,
        targetObjectId,
        scanResult.scannedImageUri,
        scanResult.scannedImageUri,
      );

      // Run on-device OCR
      try {
        const ocrResult = await extractTextOnDevice(
          db,
          record.rawMediaId,
          record.deskewedFilePath,
        );

        // If standalone and OCR got text, update the object title
        if (!recentObj && ocrResult.text.trim().length > 0) {
          const autoTitle = ocrResult.text.trim().split('\n')[0].slice(0, 60);
          await db.runAsync(
            `UPDATE objects SET title = ?, updated_at = ? WHERE id = ?`,
            [autoTitle, new Date().toISOString(), targetObjectId],
          );
        }
      } catch {
        // OCR failure is non-fatal
      }

      Alert.alert(feedbackMsg);
    } catch {
      Alert.alert(t('common.error'));
    }
  }, [db, t]);

  // (Video mode handlers moved to VideoRecordScreen)

  // ── Non-idle phases ───────────────────────────────────────────────────────

  if (phase === 'extracting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.heroGreen} />
        <Text style={styles.spinnerText}>{t('capture.securing')}</Text>
      </View>
    );
  }

  if (phase === 'saving') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.heroGreen} />
        <Text style={styles.spinnerText}>{t('capture.save_draft')}...</Text>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={styles.center}>
        <Text style={styles.checkmark}>{'\u2713'}</Text>
        <Text style={styles.doneTitle}>{t('common.success')}</Text>
        <Text style={styles.doneId}>ID: {savedId?.slice(0, 8)}...</Text>
        <Pressable style={styles.primaryBtn} onPress={handleViewObjects} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>{t('capture.view_objects')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={handleRetake} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>{t('capture.capture_another')}</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'preview' && capture && metadata) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable onPress={() => setViewerUri(capture.uri)} accessibilityRole="button" accessibilityLabel="View full-screen">
          <Image source={{ uri: capture.uri }} style={styles.preview} accessibilityLabel="Captured photograph preview" />
        </Pressable>

        <ImageViewer
          visible={!!viewerUri}
          imageUri={viewerUri ?? ''}
          onClose={() => setViewerUri(null)}
        />

        <View style={styles.metaSection}>
          <Text style={styles.metaLabel}>{t('capture.coordinates')}</Text>
          <Text style={styles.metaValue}>
            {metadata.latitude != null
              ? `${metadata.latitude.toFixed(6)}, ${metadata.longitude?.toFixed(6)}`
              : t('capture.coordinates_unavailable')}
            {metadata.coordinateSource ? ` (${metadata.coordinateSource})` : ''}
          </Text>

          <Text style={styles.metaLabel}>{t('capture.timestamp')}</Text>
          <Text style={styles.metaValue}>{metadata.timestamp ?? '—'}</Text>

          <Text style={styles.metaLabel}>{t('capture.dimensions')}</Text>
          <Text style={styles.metaValue}>
            {capture.width} x {capture.height}
          </Text>

          {hash && (
            <>
              <Text style={styles.metaLabel}>{t('capture.sha256')}</Text>
              <Text style={styles.metaValue}>{hash.slice(0, 16)}...</Text>
            </>
          )}
        </View>

        <Pressable style={styles.primaryBtn} onPress={handleDirectSave} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>{t('reviewCard.saveObject')}</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={handleAnalyzeWithAI} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>{t('common.next')}</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={handleRetake} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>{t('capture.retake')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (phase === 'type_select') {
    return (
      <TypeSelector
        defaultType={defaultObjectType}
        onSelect={handleTypeSelect}
        onSkip={handleSkipType}
        t={t}
      />
    );
  }

  // (Video review phase moved to VideoRecordScreen)

  // ── Idle: live camera view ────────────────────────────────────────────────

  // Permission not yet resolved
  if (!permission) {
    return <View style={styles.center} />;
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>{t('capture.permission_title')}</Text>
        <Text style={styles.permissionBody}>{t('capture.permission_body')}</Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.primaryBtn} onPress={requestPermission} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{t('capture.permission_grant')}</Text>
          </Pressable>
        ) : (
          <Text style={styles.permissionHint}>{t('capture.permission_settings')}</Text>
        )}
        <Pressable style={[styles.secondaryBtn, { marginTop: spacing.md }]} onPress={handleLibrary} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>{t('capture.choose_from_library')}</Text>
        </Pressable>
      </View>
    );
  }

  // Android ratio prop (iOS uses container styling); fixed 4:3 — no in-viewfinder toggle
  const androidRatio = Platform.OS === 'android' ? ('4:3' as const) : undefined;

  return (
    <View style={styles.cameraContainer}>
      {/* Camera preview with aspect-ratio wrapper for bracket positioning */}
      <GestureDetector gesture={pinchGesture}>
      <View style={styles.cameraPreview}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flashMode}
          zoom={zoom}
          ratio={androidRatio}
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Corner brackets (SVG for crisp rendering) */}
        <View style={[styles.bracketWrap, { top: 16, left: 16 }]} pointerEvents="none"><CornerBracket corner="tl" /></View>
        <View style={[styles.bracketWrap, { top: 16, right: 16 }]} pointerEvents="none"><CornerBracket corner="tr" /></View>
        <View style={[styles.bracketWrap, { bottom: 16, left: 16 }]} pointerEvents="none"><CornerBracket corner="bl" /></View>
        <View style={[styles.bracketWrap, { bottom: 16, right: 16 }]} pointerEvents="none"><CornerBracket corner="br" /></View>

        {/* Center instructional text — inside camera preview */}
        {phase === 'idle' && !protocolHook.protocol && !routeViewType && (
          <View style={styles.centerTextWrap} pointerEvents="none">
            <Text style={styles.centerTextMain}>
              {t('capture.positionInFrame')}
            </Text>
            <Text style={styles.centerTextSub}>
              {t('capture.holdSteady')}
            </Text>
          </View>
        )}

        {/* Multi-view capture: view label pill at top of camera preview */}
        {routeViewType && (
          <View style={styles.viewTypePill} pointerEvents="none">
            <Text style={styles.viewTypePillText}>
              {t(`view_types.${routeViewType}`)}
            </Text>
          </View>
        )}

        {/* Zoom level label */}
        {zoom > 0.01 && (
          <View style={styles.zoomLabel} pointerEvents="none">
            <Text style={styles.zoomLabelText}>{(1 + zoom * 9).toFixed(1)}x</Text>
          </View>
        )}
      </View>
      </GestureDetector>

      {/* ── Grid overlay (pointerEvents="none" so touches pass through) */}
      {gridEnabled && (
        <View style={styles.gridOverlay} pointerEvents="none">
          {/* Horizontal thirds */}
          <View style={styles.gridH1} />
          <View style={styles.gridH2} />
          {/* Vertical thirds */}
          <View style={styles.gridV1} />
          <View style={styles.gridV2} />
        </View>
      )}

      {/* ── Level indicator — always visible in camera view */}
      <View style={styles.levelWrap} pointerEvents="none">
        <Animated.View
          style={[
            styles.levelBar,
            {
              backgroundColor: isLevel ? OVERLAY_LEVEL_FLAT : OVERLAY_LEVEL_TILTED,
              transform: [
                {
                  rotate: tiltAnim.interpolate({
                    inputRange: [-15, 15],
                    outputRange: ['-15deg', '15deg'],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* ── Session photo count badge */}
      {sessionPhotoCount > 0 && (
        <View style={styles.photoCountBadge} pointerEvents="none">
          <Text style={styles.photoCountText}>{sessionPhotoCount}</Text>
        </View>
      )}

      {/* ── Top bar: close + domain/object pill + library ── */}
      {!protocolHook.protocol && (
        <View style={styles.topBar}>
          <Pressable
            style={styles.topBarCircle}
            onPress={() => navigation.navigate('Home')}
            accessibilityLabel={t('common.back')}
            accessibilityRole="button"
            hitSlop={touch.hitSlop}
          >
            <X size={18} color={colors.white} />
          </Pressable>
          {objectTitle ? (
            <View style={styles.objectTitlePill}>
              <Text style={styles.objectTitlePillText} numberOfLines={1}>
                {objectTitle}
              </Text>
            </View>
          ) : (
            <View style={styles.domainPill}>
              <Text style={styles.domainPillText}>
                {t('home.domainMuseumCollection')}
              </Text>
              <ChevronDown size={14} color="rgba(255,255,255,0.7)" />
            </View>
          )}
          <Pressable
            style={styles.topBarCircle}
            onPress={handleLibrary}
            accessibilityLabel={t('capture.choose_from_library')}
            accessibilityRole="button"
            hitSlop={touch.hitSlop}
          >
            <AddPhotoIcon size={18} color={colors.white} />
          </Pressable>
        </View>
      )}

      {/* Corner brackets + guidance text moved inside cameraPreview above */}

      {/* Intro overlay for first-time users */}
      {showIntro && (
        <View style={styles.introOverlay}>
          <View style={styles.introCard}>
            <Text style={styles.introText}>{t('capture.intro_text')}</Text>
            <Pressable style={styles.introBtn} onPress={handleDismissIntro} accessibilityRole="button">
              <Text style={styles.introBtnText}>{t('capture.intro_dismiss')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Shutter flash overlay */}
      <Animated.View
        style={[styles.shutterFlash, { opacity: shutterFlashAnim }]}
        pointerEvents="none"
      />

      {/* Protocol guidance overlay */}
      {protocolHook.protocol && protocolHook.currentShot && protocolHook.state === 'capturing' && (
        <CaptureGuidanceOverlay
          protocol={protocolHook.protocol}
          currentShot={protocolHook.currentShot}
          currentShotIndex={protocolHook.currentShotIndex}
          totalShots={protocolHook.protocol.shots.length}
          completedCount={protocolHook.completedShots.size}
          onSkip={() => protocolHook.skipShot(protocolHook.currentShot!.id)}
          onShowTips={() => setShowTips(true)}
          onShowShotList={() => setShowShotList(true)}
          onReview={() => protocolHook.startReview()}
        />
      )}

      {/* Protocol shot list sidebar */}
      {protocolHook.protocol && (
        <ShotListSidebar
          visible={showShotList}
          protocol={protocolHook.protocol}
          completedShots={protocolHook.completedShots}
          skippedShots={protocolHook.skippedShots}
          currentShotId={protocolHook.currentShot?.id ?? null}
          onSelectShot={(shotId) => {
            protocolHook.goToShot(shotId);
            setShowShotList(false);
          }}
          onClose={() => setShowShotList(false)}
        />
      )}

      {/* Protocol tips modal */}
      {protocolHook.currentShot && (
        <TipsModal
          visible={showTips}
          shot={protocolHook.currentShot}
          onClose={() => setShowTips(false)}
        />
      )}

      {/* Protocol picker */}
      <ProtocolPicker
        visible={showProtocolPicker}
        onSelect={handleProtocolSelect}
        onSkip={handleProtocolSkip}
      />

      {/* Protocol completion summary */}
      {protocolHook.protocol && (
        <CompletionSummary
          visible={showCompletionSummary}
          protocol={protocolHook.protocol}
          completedShots={protocolHook.completedShots}
          skippedShots={protocolHook.skippedShots}
          isComplete={protocolHook.isComplete}
          hasIncompleteRequired={protocolHook.hasIncompleteRequired}
          progress={protocolHook.progress}
          onSave={(title: string) => {
            const targetId = protocolFirstObjectIdRef.current;
            protocolFirstObjectIdRef.current = null;
            setShowCompletionSummary(false);
            protocolHook.reset();
            setProtocolPickerDismissed(false);
            if (targetId) {
              db.runAsync(
                `UPDATE objects SET title = ?, updated_at = ? WHERE id = ?`,
                [title, new Date().toISOString(), targetId],
              ).catch(() => {});
              navigation.navigate('ObjectDetail', { objectId: targetId });
            }
          }}
          onContinue={() => {
            setShowCompletionSummary(false);
            // Find the first incomplete shot and go to it
            const incomplete = protocolHook.protocol!.shots
              .sort((a, b) => a.order - b.order)
              .find((s) => !protocolHook.completedShots.has(s.id) && !protocolHook.skippedShots.has(s.id));
            if (incomplete) {
              protocolHook.goToShot(incomplete.id);
            }
          }}
          onRetake={(shotId) => {
            setShowCompletionSummary(false);
            protocolHook.retakeShot(shotId);
          }}
          onClose={() => {
            setShowCompletionSummary(false);
            // Go back to capturing state if there are incomplete shots
            const incomplete = protocolHook.protocol!.shots
              .sort((a, b) => a.order - b.order)
              .find((s) => !protocolHook.completedShots.has(s.id) && !protocolHook.skippedShots.has(s.id));
            if (incomplete) {
              protocolHook.goToShot(incomplete.id);
            }
          }}
        />
      )}

      {/* Quick-capture error toast */}
      {quickError && (
        <View style={styles.errorToast} pointerEvents="none">
          <Text style={styles.errorToastText} numberOfLines={2}>
            {quickError}
          </Text>
        </View>
      )}

      {/* Bottom area: mode toggle + thumbnail strip + controls */}
      <View style={styles.bottomArea}>
        {/* Thumbnail strip (quick mode only, when captures exist) */}
        {captureMode === 'quick' && quickThumbnails.length > 0 && (
          <View style={styles.thumbStripWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbStripContent}
            >
              {quickThumbnails.map((thumb) => (
                <Pressable
                  key={thumb.objectId}
                  onPress={() => handleThumbnailPress(thumb.objectId)}
                  accessibilityRole="button"
                  accessibilityLabel={t('capture.viewCaptured')}
                  style={styles.thumbItem}
                >
                  <Image source={{ uri: thumb.uri }} style={styles.thumbImage} />
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.thumbCountBadge}>
              <Text style={styles.thumbCountText}>
                {t('capture.capturedCount', { count: quickThumbnails.length })}
              </Text>
            </View>
          </View>
        )}

        {/* Controls: Flash | Shutter | Flip  (+ doc scan on far right) */}
        <View style={styles.bottomControls}>
          <Pressable
            style={styles.docScanCircle}
            onPress={handleDocumentScan}
            accessibilityRole="button"
            accessibilityLabel={t('capture.scan_document')}
            hitSlop={touch.hitSlop}
          >
            <ScanIcon size={18} color={colors.white} />
          </Pressable>

          <Pressable
            style={styles.circleBtn48}
            onPress={handleFlashToggle}
            accessibilityLabel={flashLabel(flashMode, t)}
            accessibilityRole="button"
            hitSlop={touch.hitSlop}
          >
            <Zap
              size={22}
              color={colors.white}
              style={flashMode === 'off' ? { opacity: 0.5 } : undefined}
            />
          </Pressable>

          {/* Shutter (photo only) */}
          <Pressable
            style={[styles.shutterBtn, !cameraReady && styles.shutterBtnDisabled]}
            onPress={
              routeViewType && routeObjectId
                ? handleViewTypeShutter
                : protocolHook.protocol
                  ? handleProtocolShutter
                  : captureMode === 'quick'
                    ? handleQuickShutter
                    : handleShutter
            }
            disabled={!cameraReady}
            accessibilityLabel={t('capture.take_photo')}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          <Pressable
            style={styles.circleBtn48}
            onPress={handleFacingToggle}
            accessibilityRole="button"
            accessibilityLabel={t('capture.flip_camera')}
            hitSlop={touch.hitSlop}
          >
            <RefreshCw size={22} color={colors.white} />
          </Pressable>

          {/* Spacer to balance doc scan on the left */}
          <View style={{ width: 36 }} />
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  center: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },

  // ── Live camera ─────────────────────────────────────────────────────────────
  cameraContainer: {
    flex: 1,
    backgroundColor: c.cameraBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPreview: {
    width: '100%',
    aspectRatio: 3 / 4,  // 4:3 camera ratio (width < height → 0.75)
    position: 'relative',
    // NO flex: 1 — aspectRatio must control the height
    // NO overflow: 'hidden' — brackets must be visible at edges
  },

  // ── Grid overlay ────────────────────────────────────────────────────────────
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  gridH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33.33%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: OVERLAY_GRID,
  },
  gridH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66.66%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: OVERLAY_GRID,
  },
  gridV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.33%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: OVERLAY_GRID,
  },
  gridV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66.66%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: OVERLAY_GRID,
  },
  // ── Level indicator ─────────────────────────────────────────────────────────
  levelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 164,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  levelBar: {
    width: 40,
    height: 2,
    borderRadius: 1,
  },

  // ── Session photo count badge ────────────────────────────────────────────────
  photoCountBadge: {
    position: 'absolute',
    top: 130,
    left: layout.screenPadding,
    backgroundColor: OVERLAY_COUNT_BG,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: 'center',
    zIndex: 10,
  },
  photoCountText: {
    color: c.white,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },

  // ── Top bar (V0 design) ─────────────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topBarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    height: 36,
    paddingHorizontal: 16,
    gap: 6,
  },
  domainPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: c.white,
  },
  objectTitlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45,90,39,0.7)',
    borderRadius: 18,
    height: 36,
    paddingHorizontal: 16,
    maxWidth: '60%',
  },
  objectTitlePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.white,
  },

  // ── Corner brackets (V0 design) ───────────────────────────────────────────
  bracketWrap: {
    position: 'absolute',
    zIndex: 20,
  },
  centerTextWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTextMain: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  centerTextSub: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 4,
  },
  // ── Multi-view capture pill ──────────────────────────────────────────────────
  viewTypePill: {
    position: 'absolute',
    top: spacing.xl,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    zIndex: 10,
  },
  viewTypePillText: {
    color: c.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  // Zoom label
  zoomLabel: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: OVERLAY_COUNT_BG,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  zoomLabelText: {
    color: c.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  // ── Bottom area (V0 design) ─────────────────────────────────────────────────
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomControls: {
    paddingBottom: 40,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },

  // ── Shutter flash ─────────────────────────────────────────────────────────
  shutterFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.white,
    zIndex: 15,
  },

  // ── Error toast ───────────────────────────────────────────────────────────
  errorToast: {
    position: 'absolute',
    top: 140,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: c.error,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    zIndex: 20,
    alignItems: 'center',
  },
  errorToastText: {
    ...typography.bodySmall,
    color: c.white,
    textAlign: 'center',
  },

  // ── Photo/Video toggle (V0 design) ──────────────────────────────────────────
  pvToggleRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pvTogglePill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    height: 40,
    padding: 3,
  },
  pvToggleBtnActive: {
    backgroundColor: c.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pvToggleTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  pvToggleBtn: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    minHeight: touch.minTarget,
  },
  pvToggleText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Thumbnail strip ───────────────────────────────────────────────────────
  thumbStripWrap: {
    backgroundColor: c.overlayLight,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  thumbStripContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  thumbItem: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.overlayLight,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbCountBadge: {
    alignSelf: 'center',
    backgroundColor: OVERLAY_COUNT_BG,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  thumbCountText: {
    color: c.white,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  // ── Circle buttons (V0 design) ──────────────────────────────────────────────
  circleBtn48: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docScanCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: c.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterBtnDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: c.white,
  },
  shutterInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  // ── Recording timer ──
  recordingTimerWrap: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    zIndex: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  recordingTimerText: {
    fontSize: 16,
    fontWeight: '700',
    color: c.white,
    fontVariant: ['tabular-nums'],
  },
  videoPreview: {
    width: '100%',
    height: 300,
    backgroundColor: c.cameraBg,
  },

  // ── Permission screen ────────────────────────────────────────────────────────
  permissionTitle: {
    color: c.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  permissionBody: {
    color: c.textSecondary,
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  permissionHint: {
    color: c.textSecondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // ── Preview phase ────────────────────────────────────────────────────────────
  scrollContent: {
    paddingBottom: 40,
  },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: c.overlayLight,
  },
  metaSection: {
    padding: layout.screenPadding,
  },
  metaLabel: {
    color: c.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  metaValue: {
    color: c.text,
    fontSize: typography.size.md,
    marginTop: 2,
  },

  // ── Shared buttons ───────────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: c.primary,
    marginHorizontal: layout.screenPadding,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    color: c.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: c.primary,
    marginHorizontal: layout.screenPadding,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  secondaryBtnText: {
    color: c.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  // ── Spinners / done ──────────────────────────────────────────────────────────
  spinnerText: {
    color: c.heroGreen,
    fontSize: typography.size.md,
    marginTop: spacing.lg,
  },
  checkmark: {
    color: c.heroGreen,
    fontSize: spacing['4xl'],
    marginBottom: spacing.lg,
  },
  doneTitle: {
    color: c.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.semibold,
  },
  doneId: {
    color: c.textSecondary,
    fontSize: typography.size.base,
    marginTop: spacing.sm,
    marginBottom: spacing.xxxl,
  },

  // ── Intro overlay ────────────────────────────────────────────────────────────
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
    zIndex: 20,
  },
  introCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    maxWidth: 320,
  },
  introText: {
    color: c.textPrimary,
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  introBtn: {
    backgroundColor: c.heroGreen,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  introBtnText: {
    color: c.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
}); }
