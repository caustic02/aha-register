import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { Button } from '../components/ui';
import { CaptureTabIcon, OfflineIcon, ViewIcon } from '../theme/icons';
import { colors, radii, spacing, touch, typography } from '../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Slides complete — advance to TrustScreen */
  onFinish: () => void;
  /** Skip remaining slides + TrustScreen — go directly to SignIn */
  onSkip: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SLIDE_COUNT = 3;

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingScreen({ onFinish, onSkip }: Props) {
  const { t } = useAppTranslation();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const slides = [
    {
      icon: <CaptureTabIcon size={64} color={colors.primary} />,
      title: t('onboarding.slide1Title'),
      body: t('onboarding.slide1Body'),
    },
    {
      icon: <ViewIcon size={64} color={colors.primary} />,
      title: t('onboarding.slide2Title'),
      body: t('onboarding.slide2Body'),
    },
    {
      icon: <OfflineIcon size={64} color={colors.primary} />,
      title: t('onboarding.slide3Title'),
      body: t('onboarding.slide3Body'),
    },
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
      if (newIndex !== activeSlide) {
        setActiveSlide(newIndex);
      }
    },
    [width, activeSlide],
  );

  const handleNext = useCallback(() => {
    if (activeSlide < SLIDE_COUNT - 1) {
      const nextIndex = activeSlide + 1;
      scrollRef.current?.scrollTo({ x: width * nextIndex, animated: !reduceMotion });
      setActiveSlide(nextIndex);
    } else {
      onFinish();
    }
  }, [activeSlide, width, onFinish, reduceMotion]);

  const isLastSlide = activeSlide === SLIDE_COUNT - 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Slides ────────────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}
        accessibilityRole="adjustable"
        accessibilityLabel={t('onboarding.slide1Title')}
      >
        {slides.map((slide, index) => (
          <View
            key={index}
            style={[styles.slide, { width }]}
            accessibilityElementsHidden={index !== activeSlide}
          >
            <View style={styles.iconWrap} accessibilityElementsHidden>
              {slide.icon}
            </View>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideBody}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        {/* Page indicator dots */}
        <View style={styles.dots} accessibilityRole="none">
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeSlide && styles.dotActive]}
              accessibilityLabel={t('onboarding.pageIndicator', {
                current: i + 1,
                total: SLIDE_COUNT,
              })}
              accessibilityState={{ selected: i === activeSlide }}
            />
          ))}
        </View>

        {/* Next / Get Started */}
        <Button
          label={isLastSlide ? t('onboarding.get_started') : t('onboarding.next')}
          onPress={handleNext}
          size="lg"
        />

        {/* Skip */}
        <Pressable
          onPress={onSkip}
          hitSlop={touch.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
          style={({ pressed }) => [
            styles.skipWrapper,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Pager
  pager: {
    flex: 1,
  },
  pagerContent: {
    // stretch each slide to the ScrollView's height
    alignItems: 'stretch',
  },
  // Individual slide
  slide: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    marginBottom: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
  },
  slideTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  slideBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
  // Footer
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // Dots
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: touch.minTarget,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  // Skip
  skipWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touch.minTarget,
  },
  skipText: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.6,
  },
});
