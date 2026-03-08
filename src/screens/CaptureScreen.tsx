import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraType, FlashMode, CameraRatio } from 'expo-camera';
import type { MainTabParamList } from '../navigation/MainTabs';
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
import type { ObjectType } from '../db/types';

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
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

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
    navigation.navigate('Objects');
  }, [navigation, handleRetake]);

  // ── Non-idle phases ───────────────────────────────────────────────────────

  if (phase === 'extracting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#74B9FF" />
        <Text style={styles.spinnerText}>{t('capture.securing')}</Text>
      </View>
    );
  }

  if (phase === 'saving') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#74B9FF" />
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
        <Pressable style={styles.primaryBtn} onPress={handleViewObjects}>
          <Text style={styles.primaryBtnText}>{t('capture.view_objects')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={handleRetake}>
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
        <Image source={{ uri: capture.uri }} style={styles.preview} />

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

        <Pressable style={styles.primaryBtn} onPress={() => setPhase('type_select')}>
          <Text style={styles.primaryBtnText}>{t('common.next')}</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={handleRetake}>
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
          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>{t('capture.permission_grant')}</Text>
          </Pressable>
        ) : (
          <Text style={styles.permissionHint}>{t('capture.permission_settings')}</Text>
        )}
        <Pressable style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={handleLibrary}>
          <Text style={styles.secondaryBtnText}>{t('capture.choose_from_library')}</Text>
        </Pressable>
      </View>
    );
  }

  // Flash icon color
  const flashColor =
    flashMode === 'off' ? '#8A8A9A' : flashMode === 'on' ? '#FFD700' : '#74B9FF';

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

      {/* Top controls: Flash | Ratio | Flip */}
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
      </View>

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
    backgroundColor: '#08080F',
  },
  center: {
    flex: 1,
    backgroundColor: '#08080F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  // ── Live camera ─────────────────────────────────────────────────────────────
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 2,
  },
  cropBarBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '15%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 2,
  },

  // ── Top controls ────────────────────────────────────────────────────────────
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  controlBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 56,
    gap: 2,
  },
  controlIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  controlLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ratioText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingVertical: 4,
  },

  // ── Bottom controls ──────────────────────────────────────────────────────────
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingTop: 20,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  libraryBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  shutterBtnDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  shutterSpacer: {
    width: 52,
  },

  // ── Permission screen ────────────────────────────────────────────────────────
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionBody: {
    color: '#636E72',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionHint: {
    color: '#636E72',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },

  // ── Preview phase ────────────────────────────────────────────────────────────
  scrollContent: {
    paddingBottom: 40,
  },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#1A1A2E',
  },
  metaSection: {
    padding: 20,
  },
  metaLabel: {
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 12,
  },
  metaValue: {
    color: '#FFFFFF',
    fontSize: 15,
    marginTop: 2,
  },

  // ── Shared buttons ───────────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: '#0984E3',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.3)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryBtnText: {
    color: '#74B9FF',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Spinners / done ──────────────────────────────────────────────────────────
  spinnerText: {
    color: '#74B9FF',
    fontSize: 16,
    marginTop: 16,
  },
  checkmark: {
    color: '#00B894',
    fontSize: 64,
    marginBottom: 16,
  },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  doneId: {
    color: '#636E72',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 32,
  },
});
