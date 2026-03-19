import React, { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { File } from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { isolateObject, type IsolationResult } from '../services/isolationService';
import { logAuditEntry } from '../db/audit';
import { Button, IconButton } from '../components/ui';
import { CloseIcon } from '../theme/icons';
import { colors, radii, spacing, touch, typography } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'IsolationCompare'>;

type Phase = 'processing' | 'error' | 'compare';
type CompareTab = 'original' | 'isolated';

// eslint-disable-next-line react-native/no-color-literals
const COMPARE_BG = 'rgba(0,0,0,0.95)';

// ── Component ─────────────────────────────────────────────────────────────────

export function IsolationCompareScreen({ route, navigation }: Props) {
  const { objectId, mediaId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [phase, setPhase] = useState<Phase>('processing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [result, setResult] = useState<IsolationResult | null>(null);
  const [activeTab, setActiveTab] = useState<CompareTab>('isolated');

  // Crossfade animation
  const [reduceMotion, setReduceMotion] = useState(false);
  const [originalOpacity] = useState(() => new Animated.Value(0));
  const [isolatedOpacity] = useState(() => new Animated.Value(1));

  // Progress pulse animation
  const [pulseAnim] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Pulse animation for processing state
  useEffect(() => {
    if (phase !== 'processing' || reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [phase, pulseAnim, reduceMotion]);

  // Load original URI and run isolation on mount
  const runIsolation = useCallback(async () => {
    setPhase('processing');
    setErrorMsg(null);
    try {
      // Read original URI for display
      const mediaRow = await db.getFirstAsync<{ file_path: string }>(
        'SELECT file_path FROM media WHERE id = ?',
        [mediaId],
      );
      if (mediaRow) setOriginalUri(mediaRow.file_path);

      const isolationResult = await isolateObject(db, objectId, mediaId);
      if (!isolationResult) {
        setErrorMsg(t('isolation.failed'));
        setPhase('error');
        return;
      }
      setResult(isolationResult);
      setActiveTab('isolated');
      setPhase('compare');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'OFFLINE') {
        setErrorMsg(t('isolation.offlineError'));
      } else if (msg === 'QUOTA_EXHAUSTED') {
        setErrorMsg(t('isolation.failed') + ' (API quota exhausted — 402)');
      } else if (msg.startsWith('ISOLATION_API_ERROR:')) {
        const parts = msg.split(':');
        const status = parts[1];
        const detail = parts.slice(2).join(':');
        setErrorMsg(`${t('isolation.failed')} (${status}: ${detail})`);
      } else {
        setErrorMsg(t('isolation.failed'));
      }
      setPhase('error');
    }
  }, [db, objectId, mediaId, t]);

  useEffect(() => {
    runIsolation();
  }, [runIsolation]);

  // Crossfade when tab changes
  const switchTab = useCallback(
    (tab: CompareTab) => {
      setActiveTab(tab);
      const duration = reduceMotion ? 0 : 200;
      if (tab === 'original') {
        Animated.parallel([
          Animated.timing(originalOpacity, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(isolatedOpacity, { toValue: 0, duration, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(originalOpacity, { toValue: 0, duration, useNativeDriver: true }),
          Animated.timing(isolatedOpacity, { toValue: 1, duration, useNativeDriver: true }),
        ]).start();
      }
    },
    [originalOpacity, isolatedOpacity, reduceMotion],
  );

  const handleDiscard = useCallback(async () => {
    if (!result) {
      navigation.goBack();
      return;
    }
    try {
      // Delete derivative file
      const file = new File(result.filePath);
      if (file.exists) file.delete();

      // Delete derivative media record
      await db.runAsync('DELETE FROM media WHERE id = ?', [result.derivativeId]);

      // Audit
      await logAuditEntry(db, {
        tableName: 'media',
        recordId: result.derivativeId,
        action: 'isolation_discarded',
        oldValues: { objectId, parentMediaId: mediaId },
      });
    } catch {
      // Best-effort cleanup
    }
    navigation.goBack();
  }, [result, db, objectId, mediaId, navigation]);

  const handleKeep = useCallback(() => {
    Alert.alert(t('isolation.backgroundRemoved'));
    navigation.goBack();
  }, [navigation, t]);

  // ── Processing phase ────────────────────────────────────────────────────────

  if (phase === 'processing') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <IconButton
            icon={<CloseIcon size={24} color={colors.white} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.cancel')}
          />
          <Text style={styles.headerTitle} accessibilityRole="header">
            {t('isolation.title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.imageContainer}>
          {originalUri && (
            <Image
              source={{ uri: originalUri }}
              style={styles.heroImage}
              resizeMode="contain"
            />
          )}
          <Animated.View
            style={[styles.processingOverlay, { opacity: pulseAnim }]}
            pointerEvents="none"
          />
          <View style={styles.processingLabel}>
            <Text style={styles.processingText}>
              {t('isolation.processing')}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error phase ─────────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <IconButton
            icon={<CloseIcon size={24} color={colors.white} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.cancel')}
          />
          <Text style={styles.headerTitle} accessibilityRole="header">
            {t('isolation.title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.imageContainer}>
          {originalUri && (
            <Image
              source={{ uri: originalUri }}
              style={styles.heroImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <View style={styles.errorButtons}>
              <Button
                label={t('isolation.tryAgain')}
                variant="primary"
                size="md"
                onPress={runIsolation}
              />
              <Button
                label={t('common.cancel')}
                variant="secondary"
                size="md"
                onPress={() => navigation.goBack()}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Compare phase ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <IconButton
          icon={<CloseIcon size={24} color={colors.white} />}
          onPress={handleDiscard}
          accessibilityLabel={t('common.cancel')}
        />
        <Text style={styles.headerTitle} accessibilityRole="header">
          {t('isolation.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Image compare area */}
      <View style={styles.imageContainer}>
        {originalUri && (
          <Animated.Image
            source={{ uri: originalUri }}
            style={[styles.heroImage, { opacity: originalOpacity }]}
            resizeMode="contain"
          />
        )}
        {result && (
          <Animated.Image
            source={{ uri: result.filePath }}
            style={[styles.heroImage, styles.heroImageOverlay, { opacity: isolatedOpacity }]}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Bottom controls */}
      <View style={styles.controls}>
        {/* Segmented toggle */}
        <View style={styles.segmentRow}>
          <Pressable
            style={[
              styles.segmentBtn,
              activeTab === 'original' && styles.segmentBtnActive,
            ]}
            onPress={() => switchTab('original')}
            accessibilityRole="button"
            accessibilityLabel={t('isolation.original')}
            accessibilityState={{ selected: activeTab === 'original' }}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'original' && styles.segmentTextActive,
              ]}
            >
              {t('isolation.original')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentBtn,
              activeTab === 'isolated' && styles.segmentBtnActive,
            ]}
            onPress={() => switchTab('isolated')}
            accessibilityRole="button"
            accessibilityLabel={t('isolation.isolated')}
            accessibilityState={{ selected: activeTab === 'isolated' }}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'isolated' && styles.segmentTextActive,
              ]}
            >
              {t('isolation.isolated')}
            </Text>
          </Pressable>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <View style={styles.actionBtn}>
            <Button
              label={t('isolation.discard')}
              variant="secondary"
              size="md"
              onPress={handleDiscard}
              fullWidth
            />
          </View>
          <View style={styles.actionBtn}>
            <Button
              label={t('isolation.keep')}
              variant="primary"
              size="md"
              onPress={handleKeep}
              fullWidth
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // eslint-disable-next-line react-native/no-color-literals
  safe: {
    flex: 1,
    backgroundColor: COMPARE_BG,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: touch.minTarget,
  },
  // Image area
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Processing overlay
  // eslint-disable-next-line react-native/no-color-literals
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  processingLabel: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    backgroundColor: colors.overlay,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  processingText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  // Error overlay
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorButtons: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 280,
  },
  // Bottom controls
  controls: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
    paddingTop: spacing.md,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.overlay,
    borderRadius: radii.full,
    padding: 2,
    marginBottom: spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    minHeight: touch.minTarget,
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.white,
  },
  segmentText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontWeight: typography.weight.semibold,
  },
  segmentTextActive: {
    color: colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
});
