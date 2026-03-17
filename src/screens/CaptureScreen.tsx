import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
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
import { computeSHA256 } from '../utils/hash';
import {
  getSetting,
  setSetting,
  SETTING_KEYS,
} from '../services/settingsService';
import { TypeSelector } from '../components/TypeSelector';
import { GridIcon } from '../theme/icons';
import type { ObjectType } from '../db/types';
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

  const handleShutter = useCallback(async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: true,
      });
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
    handleRetake();
    // Navigate to Objects tab via parent tab navigator
    navigation.getParent()?.navigate('Home');
  }, [navigation, handleRetake]);

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

        <Pressable style={styles.primaryBtn} onPress={handleAnalyzeWithAI} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>{t('common.next')}</Text>
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

      {/* Bottom controls: Library | Shutter | (spacer) */}
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
          onPress={handleShutter}
          disabled={!cameraReady}
          accessibilityLabel={t('capture.take_photo')}
        >
          <View style={styles.shutterInner} />
        </Pressable>

        {/* Spacer to balance the row */}
        <View style={styles.shutterSpacer} />
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

  // ── Bottom controls ──────────────────────────────────────────────────────────
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingTop: layout.screenPadding,
    paddingHorizontal: spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.overlayLight,
    zIndex: 10,
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
  shutterSpacer: {
    width: 52,
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
