/**
 * Collapsible section wrapper for form fields.
 *
 * Header: icon + title + AI count badge + animated chevron.
 * Expand/collapse with LayoutAnimation. Respects reduceMotion.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { ExpandIcon } from '../theme/icons';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { colors, radii, spacing, touch, typography } from '../theme';

// Enable LayoutAnimation on Android (no-op if already enabled / New Architecture)
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface FormSectionProps {
  title: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  expanded: boolean;
  onToggle: () => void;
  aiFieldCount?: number;
  children: React.ReactNode;
}

export function FormSection({
  title,
  icon: Icon,
  expanded,
  onToggle,
  aiFieldCount = 0,
  children,
}: FormSectionProps) {
  const { t } = useAppTranslation();
  const [rotateAnim] = useState(() => new Animated.Value(expanded ? 1 : 0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // Animate chevron rotation
  useEffect(() => {
    if (reduceMotion) {
      rotateAnim.setValue(expanded ? 1 : 0);
      return;
    }
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded, reduceMotion, rotateAnim]);

  const handleToggle = useCallback(() => {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    onToggle();
  }, [onToggle, reduceMotion]);

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}${aiFieldCount > 0 ? `, ${aiFieldCount} ${t('aiBadge.ai')}` : ''}`}
      >
        <Icon size={18} color={colors.textSecondary} />
        <Text style={styles.title}>{title}</Text>
        {aiFieldCount > 0 && (
          <View style={styles.aiCountBadge}>
            <Text style={styles.aiCountText}>
              {aiFieldCount} {t('aiBadge.ai')}
            </Text>
          </View>
        )}
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <ExpandIcon size={20} color={colors.textTertiary} />
        </Animated.View>
      </Pressable>
      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touch.minTarget,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text,
  },
  aiCountBadge: {
    backgroundColor: colors.aiLight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  aiCountText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.ai,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
