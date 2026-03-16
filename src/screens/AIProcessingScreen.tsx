import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { Button } from '../components/ui';
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
  onComplete: (result: AIAnalysisResult) => void;
  onSkip: () => void;
}

// ── Step configuration ───────────────────────────────────────────────────────

type StepStatus = 'pending' | 'active' | 'complete';

interface Step {
  label: string;
  delayMs: number; // delay before becoming active (relative to mount)
}

const STEPS: Step[] = [
  { label: 'Securing capture', delayMs: 0 },
  { label: 'Analyzing image', delayMs: 0 },
  { label: 'Identifying object type', delayMs: 1000 },
  { label: 'Extracting details', delayMs: 2000 },
  { label: 'Assessing condition', delayMs: 3000 },
];

// ── Component ────────────────────────────────────────────────────────────────

export function AIProcessingScreen({
  imageUri,
  imageBase64,
  mimeType = 'image/jpeg',
  captureMetadata: _captureMetadata,
  onComplete,
  onSkip,
}: AIProcessingScreenProps) {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() =>
    STEPS.map((_, i) => (i === 0 ? 'complete' : 'pending')),
  );
  const [error, setError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const apiDone = useRef(false);
  const resultRef = useRef<AIAnalysisResult | null>(null);

  // Step row fade-in animations (one per step)
  const [fadeAnims] = useState(() => STEPS.map(() => new Animated.Value(0)));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Animate step rows in
  useEffect(() => {
    if (reduceMotion) {
      fadeAnims.forEach((a) => a.setValue(1));
      return;
    }
    // Step 0 visible immediately
    fadeAnims[0].setValue(1);
    // Steps 1+ fade in on their delay
    const timers = STEPS.slice(1).map((step, idx) =>
      setTimeout(() => {
        Animated.timing(fadeAnims[idx + 1], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, step.delayMs),
    );
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion, fadeAnims]);

  // Stagger step status transitions
  useEffect(() => {
    // Step 1 ("Analyzing image") becomes active immediately
    setStepStatuses((prev) => {
      const next = [...prev];
      next[1] = 'active';
      return next;
    });

    const timers = STEPS.slice(2).map((step, idx) =>
      setTimeout(() => {
        setStepStatuses((prev) => {
          const next = [...prev];
          // Complete the previous step
          next[idx + 1] = 'complete';
          // Activate this step (unless API is already done)
          if (!apiDone.current) {
            next[idx + 2] = 'active';
          } else {
            next[idx + 2] = 'complete';
          }
          return next;
        });
      }, step.delayMs),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Call the Edge Function
  useEffect(() => {
    let cancelled = false;

    analyzeObject(imageBase64, mimeType).then((response) => {
      if (cancelled) return;
      apiDone.current = true;

      if (response.success && response.metadata) {
        resultRef.current = response.metadata;
        // Mark all steps complete
        setStepStatuses(STEPS.map(() => 'complete'));
        // Navigate after brief pause
        setTimeout(() => {
          if (!cancelled) onComplete(response.metadata!);
        }, 500);
      } else {
        setError(response.error ?? 'Analysis failed');
        // Mark all steps complete so UI doesn't look stuck
        setStepStatuses(STEPS.map(() => 'complete'));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageBase64, mimeType, onComplete]);

  const handleRetry = useCallback(() => {
    setError(null);
    apiDone.current = false;
    resultRef.current = null;
    setStepStatuses(STEPS.map((_, i) => (i === 0 ? 'complete' : 'pending')));

    // Re-trigger step animations
    setStepStatuses((prev) => {
      const next = [...prev];
      next[1] = 'active';
      return next;
    });

    analyzeObject(imageBase64, mimeType).then((response) => {
      apiDone.current = true;
      if (response.success && response.metadata) {
        resultRef.current = response.metadata;
        setStepStatuses(STEPS.map(() => 'complete'));
        setTimeout(() => onComplete(response.metadata!), 500);
      } else {
        setError(response.error ?? 'Analysis failed');
        setStepStatuses(STEPS.map(() => 'complete'));
      }
    });
  }, [imageBase64, mimeType, onComplete]);

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
            accessibilityLabel="Captured photograph"
          />
        </View>
      </View>

      {/* Bottom: progress steps */}
      <View style={styles.progressSection}>
        {STEPS.map((step, index) => {
          const status = stepStatuses[index];
          return (
            <Animated.View
              key={step.label}
              style={[styles.stepRow, { opacity: fadeAnims[index] }]}
              accessibilityLabel={`${step.label}: ${status}`}
            >
              <StepIndicator status={status} />
              <Text
                style={[
                  styles.stepLabel,
                  status === 'complete' && styles.stepLabelComplete,
                ]}
              >
                {step.label}
              </Text>
            </Animated.View>
          );
        })}

        {/* Error state */}
        {error != null && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              label="Try again"
              variant="primary"
              onPress={handleRetry}
            />
            <View style={styles.errorGap} />
            <Button
              label="Skip AI, enter manually"
              variant="ghost"
              onPress={onSkip}
            />
          </View>
        )}
      </View>
    </View>
  );
}

// ── Step indicator sub-component ─────────────────────────────────────────────

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === 'complete') {
    return (
      <View style={[styles.indicator, styles.indicatorComplete]}>
        <Text style={styles.checkmark}>{'\u2713'}</Text>
      </View>
    );
  }
  if (status === 'active') {
    return (
      <View style={styles.indicator}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }
  return (
    <View style={styles.indicator}>
      <View style={styles.dot} />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Image section — top 40%
  imageSection: {
    flex: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['2xl'],
  },
  imageWrapper: {
    width: '100%',
    flex: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  // Progress section — bottom 60%
  progressSection: {
    flex: 6,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['2xl'],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  indicator: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  indicatorComplete: {
    backgroundColor: colors.successLight,
    borderRadius: radii.full,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textTertiary,
  },
  stepLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  stepLabelComplete: {
    color: colors.textTertiary,
  },
  // Error state
  errorContainer: {
    marginTop: spacing.xl,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  errorGap: {
    height: spacing.sm,
  },
});
