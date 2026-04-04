/* eslint-disable react-native/no-color-literals, react-native/no-inline-styles */
/**
 * Video recording screen — records a supplementary video and attaches it
 * to an EXISTING object (passed via route params).
 */
import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gyroscope } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import type { CameraType, FlashMode } from 'expo-camera';
import { File } from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { extractMetadata } from '../services/metadata';
import { computeSHA256 } from '../utils/hash';
import { generateId } from '../utils/uuid';
import { copyToMediaStorage } from '../services/captureHelpers';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import Svg, { Line, Path } from 'react-native-svg';
import { X, Zap, RefreshCw } from 'lucide-react-native';
import { spacing, radii, touch } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import type { HomeStackParamList } from '../navigation/HomeStack';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_VIDEO_DURATION_SEC = 300; // 5 minutes
const RETICLE_SIZE = 80;
const RC = RETICLE_SIZE / 2;
const RETICLE_ARM = 20;
const RETICLE_GAP = 6;
const BRACKET_SIZE = 40;

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'VideoRecord'>;

// ── SVG components ────────────────────────────────────────────────────────────

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

function CenterReticle() {
  const s = 'rgba(255,255,255,0.5)';
  const w = 1.5;
  return (
    <Svg width={RETICLE_SIZE} height={RETICLE_SIZE} viewBox={`0 0 ${RETICLE_SIZE} ${RETICLE_SIZE}`}>
      <Line x1={RC} y1={RC - RETICLE_ARM} x2={RC} y2={RC - RETICLE_GAP} stroke={s} strokeWidth={w} />
      <Line x1={RC} y1={RC + RETICLE_GAP} x2={RC} y2={RC + RETICLE_ARM} stroke={s} strokeWidth={w} />
      <Line x1={RC - RETICLE_ARM} y1={RC} x2={RC - RETICLE_GAP} y2={RC} stroke={s} strokeWidth={w} />
      <Line x1={RC + RETICLE_GAP} y1={RC} x2={RC + RETICLE_ARM} y2={RC} stroke={s} strokeWidth={w} />
    </Svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VideoRecordScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { objectId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingSecondsRef = useRef(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [saving, setSaving] = useState(false);

  // Gyroscope reticle
  const [gyroX] = useState(() => new Animated.Value(0));
  const [gyroY] = useState(() => new Animated.Value(0));

  // Permissions on mount
  useEffect(() => {
    if (!camPerm?.granted) requestCamPerm();
    if (!micPerm?.granted) requestMicPerm();
  }, [camPerm, micPerm, requestCamPerm, requestMicPerm]);

  // Gyroscope
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    Gyroscope.isAvailableAsync().then((ok) => {
      if (!ok) return;
      Gyroscope.setUpdateInterval(100);
      sub = Gyroscope.addListener(({ x, y }) => {
        const clamp = (v: number) => Math.max(-8, Math.min(8, v * 12));
        Animated.spring(gyroX, { toValue: clamp(-y), useNativeDriver: true, friction: 10, tension: 60 }).start();
        Animated.spring(gyroY, { toValue: clamp(x), useNativeDriver: true, friction: 10, tension: 60 }).start();
      });
    });
    return () => sub?.remove();
  }, [gyroX, gyroY]);

  // ── Save video to existing object ───────────────────────────────────────────

  const saveVideo = useCallback(async (videoUri: string, durationSec: number) => {
    setSaving(true);
    try {
      const videoFile = new File(videoUri);
      const fileSize = videoFile.size;
      const videoHash = await computeSHA256(videoUri);
      const meta = await extractMetadata(null);

      const videoMediaId = generateId();
      const destUri = copyToMediaStorage(videoUri, videoMediaId, 'video/mp4');
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO media
           (id, object_id, file_path, file_name, file_type, mime_type, file_size,
            sha256_hash, privacy_tier, is_primary, sort_order, media_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'video', 'video/mp4', ?,
                 ?, 'public', 0, 99, 'original', ?, ?)`,
        [videoMediaId, objectId, destUri, `${videoMediaId}.mp4`, fileSize, videoHash, now, now],
      );

      await logAuditEntry(db, {
        tableName: 'media',
        recordId: videoMediaId,
        action: 'video_capture',
        newValues: { objectId, duration: durationSec, sha256: videoHash },
        deviceInfo: { model: meta.deviceModel, os: meta.osVersion, app: meta.appVersion },
      });

      const syncEngine = new SyncEngine(db);
      await syncEngine.queueChange('media', videoMediaId, 'insert', { objectId });

      Alert.alert(t('objectDetail.videoSaved'));
      navigation.goBack();
    } catch (err) {
      console.error('[VIDEO] Save failed:', err);
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  }, [objectId, db, navigation, t]);

  // ── Recording ───────────────────────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || isRecording) return;
    try {
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= MAX_VIDEO_DURATION_SEC) {
          cameraRef.current?.stopRecording();
        }
      }, 1000);

      const result = await cameraRef.current.recordAsync({ maxDuration: MAX_VIDEO_DURATION_SEC });

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);

      if (result?.uri) {
        await saveVideo(result.uri, recordingSecondsRef.current);
      }
    } catch (err) {
      console.error('[VIDEO] Recording failed:', err);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
    }
  }, [cameraReady, isRecording, saveVideo]);

  const handleStopRecording = useCallback(() => {
    if (!cameraRef.current || !isRecording) return;
    cameraRef.current.stopRecording();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [isRecording]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!camPerm?.granted || !micPerm?.granted) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.heroGreen} />
        <Text style={styles.permText}>{t('capture.permission_title')}</Text>
      </View>
    );
  }

  if (saving) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.heroGreen} />
        <Text style={styles.permText}>{t('common.loading')}</Text>
      </View>
    );
  }

  const androidRatio = Platform.OS === 'android' ? ('4:3' as const) : undefined;

  return (
    <View style={styles.root}>
      {/* Camera preview — aspect-ratio-constrained wrapper (matches CaptureScreen) */}
      <View style={styles.cameraPreview}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flashMode}
          mode="video"
          videoQuality="1080p"
          videoBitrate={10_000_000}
          mute={false}
          ratio={androidRatio}
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Corner brackets — direct children of camera preview, 16px inset */}
        <View style={[styles.bracketWrap, { top: 16, left: 16 }]} pointerEvents="none"><CornerBracket corner="tl" /></View>
        <View style={[styles.bracketWrap, { top: 16, right: 16 }]} pointerEvents="none"><CornerBracket corner="tr" /></View>
        <View style={[styles.bracketWrap, { bottom: 16, left: 16 }]} pointerEvents="none"><CornerBracket corner="bl" /></View>
        <View style={[styles.bracketWrap, { bottom: 16, right: 16 }]} pointerEvents="none"><CornerBracket corner="br" /></View>

        {/* Center tracking reticle (gyroscope-reactive) */}
        <Animated.View
          style={[styles.reticleWrap, { transform: [{ translateX: gyroX }, { translateY: gyroY }] }]}
          pointerEvents="none"
        >
          <CenterReticle />
        </Animated.View>

        {/* Guidance text — positioned below the reticle center */}
        {!isRecording && (
          <View style={styles.guidanceWrap} pointerEvents="none">
            <Text style={styles.guidanceMain}>{t('capture.narrateAsYouRecord')}</Text>
            <Text style={styles.guidanceSub}>{t('capture.describeWhileFilming')}</Text>
          </View>
        )}
      </View>

      {/* Recording timer */}
      {isRecording && (
        <View style={styles.timerWrap}>
          <View style={styles.timerDot} />
          <Text style={styles.timerText}>
            {`${Math.floor(recordingSeconds / 60)}:${(recordingSeconds % 60).toString().padStart(2, '0')}`}
          </Text>
        </View>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.topBtn} onPress={() => navigation.goBack()} hitSlop={touch.hitSlop}>
          <X size={20} color={colors.white} />
        </Pressable>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <Pressable
          style={styles.circleBtn}
          onPress={() => setFlashMode((f) => (f === 'off' ? 'on' : 'off'))}
          hitSlop={touch.hitSlop}
        >
          <Zap size={22} color={colors.white} style={flashMode === 'off' ? { opacity: 0.5 } : undefined} />
        </Pressable>

        <Pressable
          style={[styles.shutterBtn, !cameraReady && { opacity: 0.4 }]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          disabled={!cameraReady}
        >
          <View style={isRecording ? styles.shutterStop : styles.shutterRecord} />
        </Pressable>

        <Pressable
          style={styles.circleBtn}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          hitSlop={touch.hitSlop}
        >
          <RefreshCw size={22} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.cameraBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cameraBg },
  permText: { color: c.white, marginTop: spacing.md },
  // Camera preview — matches CaptureScreen structure exactly
  cameraPreview: {
    width: '100%',
    aspectRatio: 3 / 4,  // 4:3 camera (width < height = 0.75)
    position: 'relative',
    // NO flex: 1 — aspectRatio controls height
    // NO overflow: 'hidden' — brackets must be visible
  },
  bracketWrap: { position: 'absolute', zIndex: 20 },
  reticleWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -(RETICLE_SIZE / 2),
    marginLeft: -(RETICLE_SIZE / 2),
    zIndex: 15,
  },
  // Guidance text — pushed below center so it doesn't overlap reticle
  guidanceWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '60%',    // below the center reticle (which is at 50%)
    alignItems: 'center',
  },
  // eslint-disable-next-line react-native/no-color-literals
  guidanceMain: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  // eslint-disable-next-line react-native/no-color-literals
  guidanceSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 4 },
  // Timer
  timerWrap: {
    position: 'absolute', top: 56, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    // eslint-disable-next-line react-native/no-color-literals
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6, gap: 8, zIndex: 20,
  },
  timerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger },
  timerText: { fontSize: 16, fontWeight: '700', color: c.white, fontVariant: ['tabular-nums'] },
  // Top bar
  topBar: { position: 'absolute', top: 56, left: spacing.lg, zIndex: 25 },
  topBtn: {
    width: 36, height: 36, borderRadius: radii.full,
    backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center',
  },
  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32,
  },
  circleBtn: {
    width: 48, height: 48, borderRadius: 24,
    // eslint-disable-next-line react-native/no-color-literals
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  shutterBtn: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 4,
    borderColor: c.white, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.transparent,
  },
  shutterRecord: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.danger },
  shutterStop: { width: 28, height: 28, borderRadius: 6, backgroundColor: c.danger },
}); }
