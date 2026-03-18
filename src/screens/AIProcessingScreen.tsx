import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { Button } from '../components/ui';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  analyzeObject,
  type AIAnalysisResult,
} from '../services/ai-analysis';
import type { CaptureMetadata } from '../services/metadata';

// ── Props ────────────────────────────────────────────────────────────────────

export interface AIProcessingScreenProps {
  imageUri: string;
  imageBase64: string;
  mimeType?: string;
  captureMetadata: CaptureMetadata;
  domain?: string;
  onComplete: (result: AIAnalysisResult) => void;
  onSkip: () => void;
}

// ── Step configuration ───────────────────────────────────────────────────────

interface StepDef {
  i18nKey: string;
  progressTarget: number; // 0-1 range
}

const STEP_DEFS: StepDef[] = [
  { i18nKey: 'aiProcessing.securingCapture', progressTarget: 0.1 },
  { i18nKey: 'aiProcessing.analyzingImage', progressTarget: 0.3 },
  { i18nKey: 'aiProcessing.identifyingType', progressTarget: 0.55 },
  { i18nKey: 'aiProcessing.extractingDetails', progressTarget: 0.75 },
  { i18nKey: 'aiProcessing.assessingCondition', progressTarget: 0.9 },
];

// ── Component ────────────────────────────────────────────────────────────────

export function AIProcessingScreen({
  imageUri,
  imageBase64,
  mimeType = 'image/jpeg',
  captureMetadata: _captureMetadata,
  domain = 'general',
  onComplete,
  onSkip,
}: AIProcessingScreenProps) {
  const { t } = useAppTranslation();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const apiDone = useRef(false);

  // Animations
  const progressAnim = useRef(new Animated.Value(0)).current;
  const skeletonPulse = useRef(new Animated.Value(0.3)).current;
  const completeFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Skeleton pulse animation
  useEffect(() => {
    if (reduceMotion) {
      skeletonPulse.setValue(0.5);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, {
          toValue: 0.7,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonPulse, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [reduceMotion, skeletonPulse]);

  // Stagger progress steps on timers
  useEffect(() => {
    // Step 0 completes immediately → animate to 10%
    animateProgress(STEP_DEFS[0].progressTarget, 200);
    setCurrentStepIndex(0);

    const timers = [
      setTimeout(() => {
        setCurrentStepIndex(1);
        animateProgress(STEP_DEFS[1].progressTarget, 400);
      }, 300),
      setTimeout(() => {
        if (!apiDone.current) {
          setCurrentStepIndex(2);
          animateProgress(STEP_DEFS[2].progressTarget, 500);
        }
      }, 1200),
      setTimeout(() => {
        if (!apiDone.current) {
          setCurrentStepIndex(3);
          animateProgress(STEP_DEFS[3].progressTarget, 500);
        }
      }, 2500),
      setTimeout(() => {
        if (!apiDone.current) {
          setCurrentStepIndex(4);
          animateProgress(STEP_DEFS[4].progressTarget, 500);
        }
      }, 3800),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateProgress = (target: number, duration: number) => {
    if (reduceMotion) {
      progressAnim.setValue(target);
      return;
    }
    Animated.timing(progressAnim, {
      toValue: target,
      duration,
      useNativeDriver: false, // width animation
    }).start();
  };

  const handleComplete = useCallback(
    (result: AIAnalysisResult) => {
      // Animate progress to 100%
      animateProgress(1, 200);

      // Haptic success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );

      // Fade in completion overlay briefly then navigate
      if (reduceMotion) {
        completeFade.setValue(1);
      } else {
        Animated.timing(completeFade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }

      setTimeout(() => onComplete(result), 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onComplete, reduceMotion],
  );

  const handleError = useCallback(
    (message: string) => {
      setError(message);
      animateProgress(1, 200);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Call the Edge Function
  useEffect(() => {
    let cancelled = false;

    analyzeObject(imageBase64, mimeType, domain).then((response) => {
      if (cancelled) return;
      apiDone.current = true;

      if (response.success && response.metadata) {
        handleComplete(response.metadata);
      } else {
        const msg = response.error === 'NO_AUTH_SESSION'
          ? t('aiProcessing.signInRequired')
          : (response.error ?? t('aiProcessing.analysisFailed'));
        handleError(msg);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageBase64, mimeType, domain, handleComplete, handleError, t]);

  const handleRetry = useCallback(() => {
    setError(null);
    apiDone.current = false;
    setCurrentStepIndex(0);
    progressAnim.setValue(0);
    completeFade.setValue(0);

    animateProgress(STEP_DEFS[0].progressTarget, 200);

    const timers = [
      setTimeout(() => {
        setCurrentStepIndex(1);
        animateProgress(STEP_DEFS[1].progressTarget, 400);
      }, 300),
      setTimeout(() => {
        if (!apiDone.current) {
          setCurrentStepIndex(2);
          animateProgress(STEP_DEFS[2].progressTarget, 500);
        }
      }, 1200),
    ];

    analyzeObject(imageBase64, mimeType, domain).then((response) => {
      timers.forEach(clearTimeout);
      apiDone.current = true;
      if (response.success && response.metadata) {
        handleComplete(response.metadata);
      } else {
        const msg = response.error === 'NO_AUTH_SESSION'
          ? t('aiProcessing.signInRequired')
          : (response.error ?? t('aiProcessing.analysisFailed'));
        handleError(msg);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageBase64, mimeType, domain, handleComplete, handleError, t]);

  // Progress bar width interpolation
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const currentStepLabel = t(STEP_DEFS[currentStepIndex].i18nKey);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Top: captured image */}
      <View style={styles.imageSection}>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel={t('aiProcessing.capturedPhoto')}
          />
        </View>

        {/* Progress bar below image */}
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[styles.progressBarFill, { width: progressWidth }]}
          />
        </View>
        <Text
          style={styles.stepText}
          accessibilityLiveRegion="polite"
        >
          {error == null ? `${currentStepLabel}...` : ''}
        </Text>
      </View>

      {/* Bottom: skeleton preview of metadata card */}
      <View style={styles.skeletonSection}>
        {error == null ? (
          <>
            {/* Skeleton: title */}
            <Animated.View
              style={[styles.skeletonBlock, styles.skeletonTitle, { opacity: skeletonPulse }]}
            />
            {/* Skeleton: badge row */}
            <View style={styles.skeletonRow}>
              <Animated.View
                style={[styles.skeletonBlock, styles.skeletonBadge, { opacity: skeletonPulse }]}
              />
              <Animated.View
                style={[styles.skeletonBlock, styles.skeletonBadge, { opacity: skeletonPulse }]}
              />
              <Animated.View
                style={[styles.skeletonBlock, styles.skeletonBadgeSmall, { opacity: skeletonPulse }]}
              />
            </View>
            {/* Skeleton: type chips */}
            <View style={styles.skeletonRow}>
              <Animated.View
                style={[styles.skeletonBlock, styles.skeletonChip, { opacity: skeletonPulse }]}
              />
              <Animated.View
                style={[styles.skeletonBlock, styles.skeletonChipWide, { opacity: skeletonPulse }]}
              />
              <Animated.View
                style={[styles.skeletonBlock, styles.skeletonChip, { opacity: skeletonPulse }]}
              />
            </View>
            {/* Skeleton: field lines */}
            <Animated.View
              style={[styles.skeletonBlock, styles.skeletonField, { opacity: skeletonPulse }]}
            />
            <Animated.View
              style={[styles.skeletonBlock, styles.skeletonFieldShort, { opacity: skeletonPulse }]}
            />
            {/* Skeleton: description block */}
            <Animated.View
              style={[styles.skeletonBlock, styles.skeletonTextArea, { opacity: skeletonPulse }]}
            />
            {/* Skeleton: condition line */}
            <Animated.View
              style={[styles.skeletonBlock, styles.skeletonFieldMedium, { opacity: skeletonPulse }]}
            />
          </>
        ) : (
          /* Error state */
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              label={t('aiProcessing.tryAgain')}
              variant="primary"
              onPress={handleRetry}
            />
            <View style={styles.errorGap} />
            <Button
              label={t('aiProcessing.skipAiManual')}
              variant="ghost"
              onPress={onSkip}
            />
          </View>
        )}
      </View>

      {/* Completion fade overlay */}
      <Animated.View
        style={[styles.completeFade, { opacity: completeFade }]}
        pointerEvents="none"
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Image section — top portion
  imageSection: {
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['2xl'],
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  // Progress bar
  progressBarTrack: {
    height: 4,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 2,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.tertiary,
    borderRadius: 2,
  },
  stepText: {
    ...typography.bodySmall,
    color: colors.aiText,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // Skeleton preview section
  skeletonSection: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.xl,
  },
  skeletonBlock: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.sm,
  },
  skeletonTitle: {
    height: 24,
    width: '70%',
    marginBottom: spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  skeletonBadge: {
    height: 22,
    width: 64,
    borderRadius: radii.full,
  },
  skeletonBadgeSmall: {
    height: 22,
    width: 44,
    borderRadius: radii.full,
  },
  skeletonChip: {
    height: 32,
    width: 72,
    borderRadius: radii.full,
  },
  skeletonChipWide: {
    height: 32,
    width: 96,
    borderRadius: radii.full,
  },
  skeletonField: {
    height: 40,
    width: '100%',
    marginBottom: spacing.md,
    borderRadius: radii.md,
  },
  skeletonFieldShort: {
    height: 40,
    width: '60%',
    marginBottom: spacing.md,
    borderRadius: radii.md,
  },
  skeletonFieldMedium: {
    height: 40,
    width: '80%',
    marginBottom: spacing.md,
    borderRadius: radii.md,
  },
  skeletonTextArea: {
    height: 72,
    width: '100%',
    marginBottom: spacing.md,
    borderRadius: radii.md,
  },
  // Error state
  errorContainer: {
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.statusError,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  errorGap: {
    height: spacing.sm,
  },
  // Completion flash
  completeFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
});
