import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraType, FlashMode, CameraRatio } from 'expo-camera';
import { File } from 'expo-file-system';
import type { CaptureStackParamList } from '../navigation/CaptureStack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { pickFromLibrary, type CaptureResult } from '../services/capture';
import { extractMetadata, type CaptureMetadata } from '../services/metadata';
import { createDraftObject } from '../services/draftObject';
import { quickCapture, type LocationData } from '../services/quickCapture';
import { computeSHA256 } from '../utils/hash';
import {
  getSetting,
  setSetting,
  SETTING_KEYS,
} from '../services/settingsService';
import { TypeSelector } from '../components/TypeSelector';
import { GridIcon, QuickModeIcon, FullModeIcon, ScanIcon } from '../theme/icons';
import type { ObjectType, RegisterObject } from '../db/types';
import {
  launchDocumentScanner,
  processDocumentScan,
  extractTextOnDevice,
} from '../services/documentScanService';
import { colors, typography, spacing, radii, layout, touch } from '../theme';

// Camera-specific overlay colours — rgba values intentionally outside the design
// system token set because they are camera-viewfinder-only and must meet contrast
// requirements against arbitrary scene content.
const OVERLAY_GRID = 'rgba(255,255,255,0.3)';
const OVERLAY_LEVEL_TILTED = 'rgba(255,255,255,0.5)';
const OVERLAY_LEVEL_FLAT = 'rgba(45,90,39,0.85)';
const OVERLAY_COUNT_BG = 'rgba(0,0,0,0.55)';

type Phase = 'idle' | 'extracting' | 'preview' | 'type_select' | 'saving' | 'done';
type AspectRatio = '4:3' | '1:1';
type CaptureMode = 'quick' | 'full';

interface QuickCaptureThumbnail {
  objectId: string;
  uri: string;
}

const CAPTURE_MODE_KEY = 'capture.mode';
const RECENT_OBJECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const FLASH_CYCLE: FlashMode[] = ['off', 'on', 'auto'];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Screen ────────────────────────────────────────────────────────────────────

export function CaptureScreen() {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<CaptureStackParamList>>();

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Camera settings
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:3');
  const [cameraReady, setCameraReady] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  // Capture / form state
  const [phase, setPhase] = useState<Phase>('idle');
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [metadata, setMetadata] = useState<CaptureMetadata | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [defaultObjectType, setDefaultObjectType] = useState<ObjectType | null>(null);

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

  const handleGridToggle = useCallback(() => {
    setGridEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem('camera.gridEnabled', String(next));
      return next;
    });
  }, []);

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

  const handleRatioToggle = useCallback(() => {
    setAspectRatio((prev) => (prev === '4:3' ? '1:1' : '4:3'));
  }, []);

  const handleModeToggle = useCallback((mode: CaptureMode) => {
    setCaptureMode(mode);
    AsyncStorage.setItem(CAPTURE_MODE_KEY, mode);
  }, []);

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

  const handleShutter = useCallback(async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: true,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const result: CaptureResult = {
        uri: pic.uri,
        width: pic.width,
        height: pic.height,
        fileName: null,
        fileSize: null,
        mimeType: 'image/jpeg',
        exif: pic.exif ?? null,
      };
      await processCapture(result);
    } catch {
      // Camera not ready or other error — ignore silently
    }
  }, [cameraReady, processCapture]);

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
      navigation.getParent()?.navigate('Home', {
        screen: 'ObjectDetail',
        params: { objectId: id },
      });
    } else {
      navigation.getParent()?.navigate('Home');
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
      setSessionPhotoCount((prev) => prev + 1);
      navigation.getParent()?.navigate('Home', {
        screen: 'ObjectDetail',
        params: { objectId },
      });
      handleRetake();
    } catch {
      setPhase('preview');
    }
  }, [capture, metadata, db, defaultObjectType, navigation, handleRetake]);

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
      navigation.getParent()?.navigate('Home', {
        screen: 'ObjectDetail',
        params: { objectId },
      });
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
        feedbackMsg = recentObj.title === 'Untitled'
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

  // ── Non-idle phases ───────────────────────────────────────────────────────

  if (phase === 'extracting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.spinnerText}>{t('capture.securing')}</Text>
      </View>
    );
  }

  if (phase === 'saving') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
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
        <Image source={{ uri: capture.uri }} style={styles.preview} accessibilityLabel="Captured photograph preview" />

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

  // Flash icon color
  const flashColor =
    flashMode === 'off' ? colors.textMuted : flashMode === 'on' ? colors.warning : colors.accent;

  // Android ratio prop (iOS uses container styling)
  const androidRatio: CameraRatio | undefined =
    Platform.OS === 'android' ? aspectRatio : undefined;

  return (
    <View style={styles.cameraContainer}>
      {/* Live camera view */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flashMode}
        ratio={androidRatio}
        onCameraReady={() => setCameraReady(true)}
      />

      {/* 1:1 crop overlay — two dark bars to frame the square composition zone */}
      {aspectRatio === '1:1' && (
        <>
          <View style={styles.cropBarTop} pointerEvents="none" />
          <View style={styles.cropBarBottom} pointerEvents="none" />
        </>
      )}

      {/* ── Grid overlay + crosshair (pointerEvents="none" so touches pass through) */}
      {gridEnabled && (
        <View style={styles.gridOverlay} pointerEvents="none">
          {/* Horizontal thirds */}
          <View style={styles.gridH1} />
          <View style={styles.gridH2} />
          {/* Vertical thirds */}
          <View style={styles.gridV1} />
          <View style={styles.gridV2} />
          {/* Center crosshair */}
          <View style={styles.crosshairWrap}>
            <View style={styles.crosshairH} />
            <View style={styles.crosshairV} />
          </View>
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

      {/* Top controls: Flash | Ratio | Flip | Grid */}
      <View style={styles.topControls}>
        {/* Flash toggle */}
        <Pressable
          style={styles.controlBtn}
          onPress={handleFlashToggle}
          accessibilityLabel={flashLabel(flashMode, t)}
        >
          <Text style={[styles.controlIcon, { color: flashColor }]}>
            {flashIcon(flashMode)}
          </Text>
          <Text style={[styles.controlLabel, { color: flashColor }]}>
            {flashMode === 'auto' ? 'AUTO' : flashMode.toUpperCase()}
          </Text>
        </Pressable>

        {/* Aspect ratio toggle */}
        <Pressable
          style={styles.controlBtn}
          onPress={handleRatioToggle}
          accessibilityLabel={t('capture.ratio_label')}
        >
          <Text style={styles.ratioText}>{aspectRatio}</Text>
        </Pressable>

        {/* Flip camera */}
        <Pressable
          style={styles.controlBtn}
          onPress={handleFacingToggle}
          accessibilityLabel={t('capture.flip_camera')}
        >
          <Text style={styles.controlIcon}>{'\u21BA'}</Text>
        </Pressable>

        {/* Grid toggle */}
        <Pressable
          style={[styles.controlBtn, gridEnabled && styles.controlBtnActive]}
          onPress={handleGridToggle}
          accessibilityRole="button"
          accessibilityLabel={t('camera.gridToggle')}
          accessibilityState={{ checked: gridEnabled }}
        >
          <GridIcon
            size={20}
            color={gridEnabled ? colors.primary : colors.white}
          />
        </Pressable>
      </View>

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

        {/* Mode toggle */}
        <View style={styles.modeToggleRow}>
          <View style={styles.modeTogglePill}>
            <Pressable
              style={[
                styles.modeToggleBtn,
                captureMode === 'quick' && styles.modeToggleBtnActive,
              ]}
              onPress={() => handleModeToggle('quick')}
              accessibilityRole="button"
              accessibilityLabel={t('capture.modeQuick')}
              accessibilityState={{ selected: captureMode === 'quick' }}
            >
              <QuickModeIcon
                size={14}
                color={captureMode === 'quick' ? colors.white : colors.textTertiary}
              />
              <Text
                style={[
                  styles.modeToggleText,
                  captureMode === 'quick' && styles.modeToggleTextActive,
                ]}
              >
                {t('capture.modeQuick')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.modeToggleBtn,
                captureMode === 'full' && styles.modeToggleBtnActive,
              ]}
              onPress={() => handleModeToggle('full')}
              accessibilityRole="button"
              accessibilityLabel={t('capture.modeFull')}
              accessibilityState={{ selected: captureMode === 'full' }}
            >
              <FullModeIcon
                size={14}
                color={captureMode === 'full' ? colors.white : colors.textTertiary}
              />
              <Text
                style={[
                  styles.modeToggleText,
                  captureMode === 'full' && styles.modeToggleTextActive,
                ]}
              >
                {t('capture.modeFull')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Controls: Library | Shutter | (spacer) */}
        <View style={styles.bottomControls}>
          {/* Library picker */}
          <Pressable
            style={styles.libraryBtn}
            onPress={handleLibrary}
            accessibilityLabel={t('capture.choose_from_library')}
          >
            <Text style={styles.libraryIcon}>{'\u25A3'}</Text>
          </Pressable>

          {/* Shutter */}
          <Pressable
            style={[styles.shutterBtn, !cameraReady && styles.shutterBtnDisabled]}
            onPress={captureMode === 'quick' ? handleQuickShutter : handleShutter}
            disabled={!cameraReady}
            accessibilityLabel={t('capture.take_photo')}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          {/* Document scan */}
          <Pressable
            style={styles.docScanBtn}
            onPress={handleDocumentScan}
            accessibilityRole="button"
            accessibilityLabel={t('capture.scan_document')}
          >
            <ScanIcon size={22} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },

  // ── Live camera ─────────────────────────────────────────────────────────────
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.camera,
  },

  // Crop overlay bars for 1:1 ratio (appear above/below the square zone)
  cropBarTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Height is calculated so the remaining visible area is square (width-based)
    // We overlay ~20% from top and bottom as a darkened guide
    height: '15%',
    backgroundColor: colors.overlay,
    zIndex: 2,
  },
  cropBarBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '15%',
    backgroundColor: colors.overlay,
    zIndex: 2,
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
  // Crosshair
  crosshairWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 32,
    height: 32,
    marginTop: -16,
    marginLeft: -16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 32,
    height: StyleSheet.hairlineWidth,
    backgroundColor: OVERLAY_GRID,
  },
  crosshairV: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth,
    height: 32,
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
    color: colors.white,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },

  // ── Top controls ────────────────────────────────────────────────────────────
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingBottom: spacing.lg,
    paddingHorizontal: layout.screenPadding,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.overlayLight,
    zIndex: 10,
  },
  controlBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    minWidth: 56,
    minHeight: touch.minTarget,
    justifyContent: 'center',
    gap: 2,
  },
  controlBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  controlIcon: {
    fontSize: typography.size.xl,
    color: colors.white,
  },
  controlLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
  ratioText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.white,
    paddingVertical: spacing.xs,
  },

  // ── Bottom area (mode toggle + thumbnail strip + controls) ──────────────────
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomControls: {
    paddingBottom: 50,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.overlayLight,
  },

  // ── Shutter flash ─────────────────────────────────────────────────────────
  shutterFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    zIndex: 15,
  },

  // ── Error toast ───────────────────────────────────────────────────────────
  errorToast: {
    position: 'absolute',
    top: 140,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.error,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    zIndex: 20,
    alignItems: 'center',
  },
  errorToastText: {
    ...typography.bodySmall,
    color: colors.white,
    textAlign: 'center',
  },

  // ── Mode toggle ───────────────────────────────────────────────────────────
  modeToggleRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.overlayLight,
  },
  modeTogglePill: {
    flexDirection: 'row',
    backgroundColor: OVERLAY_COUNT_BG,
    borderRadius: radii.full,
    padding: 2,
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    minHeight: 32,
  },
  modeToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  modeToggleText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: typography.weight.semibold,
  },
  modeToggleTextActive: {
    color: colors.white,
  },

  // ── Thumbnail strip ───────────────────────────────────────────────────────
  thumbStripWrap: {
    backgroundColor: colors.overlayLight,
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
    borderColor: colors.overlayLight,
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
    color: colors.white,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  libraryBtn: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryIcon: {
    fontSize: typography.size.xxl,
    color: colors.white,
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayLight,
  },
  shutterBtnDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
  },
  docScanBtn: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Permission screen ────────────────────────────────────────────────────────
  permissionTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  permissionBody: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  permissionHint: {
    color: colors.textSecondary,
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
    backgroundColor: colors.overlayLight,
  },
  metaSection: {
    padding: layout.screenPadding,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  metaValue: {
    color: colors.text,
    fontSize: typography.size.md,
    marginTop: 2,
  },

  // ── Shared buttons ───────────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: colors.accent,
    marginHorizontal: layout.screenPadding,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    marginHorizontal: layout.screenPadding,
    borderRadius: radii.lg,
    padding: layout.cardPadding,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  secondaryBtnText: {
    color: colors.accent,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  // ── Spinners / done ──────────────────────────────────────────────────────────
  spinnerText: {
    color: colors.accent,
    fontSize: typography.size.md,
    marginTop: spacing.lg,
  },
  checkmark: {
    color: colors.accent,
    fontSize: spacing['4xl'],
    marginBottom: spacing.lg,
  },
  doneTitle: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.semibold,
  },
  doneId: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    marginTop: spacing.sm,
    marginBottom: spacing.xxxl,
  },

  // ── Intro overlay ────────────────────────────────────────────────────────────
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
    zIndex: 20,
  },
  introCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    maxWidth: 320,
  },
  introText: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  introBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  introBtnText: {
    color: colors.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
