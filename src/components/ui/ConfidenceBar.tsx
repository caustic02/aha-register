import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

interface ConfidenceBarProps {
  confidence: number;
  label?: string;
  animated?: boolean;
}

function getFillColor(confidence: number): string {
  if (confidence < 40) return colors.warning;
  if (confidence < 75) return colors.ai;
  return colors.success;
}

export function ConfidenceBar({
  confidence,
  label,
  animated = true,
}: ConfidenceBarProps) {
  const clampedConfidence = Math.max(0, Math.min(100, confidence));
  const fillColor = getFillColor(clampedConfidence);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [animValue] = useState(() => new Animated.Value(0));
  const [widthInterpolated] = useState(() =>
    animValue.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
    }),
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (animated && !reduceMotion) {
      animValue.setValue(0);
      Animated.timing(animValue, {
        toValue: clampedConfidence,
        duration: 600,
        useNativeDriver: false,
      }).start();
    } else {
      animValue.setValue(clampedConfidence);
    }
  }, [clampedConfidence, animated, reduceMotion, animValue]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${label || 'Confidence'}: ${clampedConfidence} percent`}
      accessibilityValue={{ min: 0, max: 100, now: clampedConfidence }}
    >
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: fillColor, width: widthInterpolated },
          ]}
        />
      </View>
      <View style={styles.labelRow}>
        {label && (
          <Text style={[styles.labelText, { color: colors.textSecondary }]}>
            {label}
          </Text>
        )}
        <Text style={[styles.percentage, { color: fillColor }]}>
          {`${clampedConfidence}%`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  labelText: {
    ...typography.bodySmall,
    flex: 1,
  },
  percentage: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
});
