/**
 * Full-screen modal shown when the user finishes or reviews their
 * protocol capture. Displays a grid of all shots with thumbnails
 * and allows saving, continuing, or retaking individual shots.
 */

import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Check, X } from 'lucide-react-native';
import { useAppTranslation } from '../hooks/useAppTranslation';
import type { CaptureProtocol } from '../config/protocols';
import { colors, typography, spacing, radii, touch } from '../theme';
import { WarningIcon } from '../theme/icons';

// ── Overlay colours (camera-safe not needed — this is themed) ────────────────
const THUMB_OVERLAY = 'rgba(0,0,0,0.35)';
const DASH_REQUIRED = colors.statusWarning;
const DASH_OPTIONAL = colors.border;

interface CompletionSummaryProps {
  visible: boolean;
  protocol: CaptureProtocol;
  completedShots: Map<string, { uri: string; timestamp: string }>;
  skippedShots: Set<string>;
  isComplete: boolean;
  hasIncompleteRequired: boolean;
  progress: { completed: number; total: number; required: number; requiredCompleted: number };
  onSave: () => void;
  onContinue: () => void;
  onRetake: (shotId: string) => void;
  onClose: () => void;
}

export function CompletionSummary({
  visible,
  protocol,
  completedShots,
  skippedShots,
  isComplete,
  hasIncompleteRequired,
  progress,
  onSave,
  onContinue,
  onRetake,
  onClose,
}: CompletionSummaryProps) {
  const { t, i18n } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isGerman = i18n.language.startsWith('de');

  const cardWidth = (width - spacing.xl * 2 - spacing.md) / 2;
  const sortedShots = [...protocol.shots].sort((a, b) => a.order - b.order);
  const missingRequiredCount = progress.required - progress.requiredCompleted;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{t('protocols.review_title')}</Text>
            <Text style={styles.subtitle}>
              {t('protocols.progress', { completed: progress.completed, total: progress.total })}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <X size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Warning banner for incomplete required */}
        {hasIncompleteRequired && (
          <View style={styles.warningBanner}>
            <WarningIcon size={18} color={colors.statusWarning} />
            <Text style={styles.warningText}>
              {t('protocols.incomplete_message', { remaining: missingRequiredCount })}
            </Text>
          </View>
        )}

        {/* Shot grid */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {sortedShots.map((shot) => {
              const label = isGerman ? shot.label_de : shot.label;
              const captureData = completedShots.get(shot.id);
              const isSkipped = skippedShots.has(shot.id);
              const isMissing = !captureData && !isSkipped;

              return (
                <Pressable
                  key={shot.id}
                  style={[styles.card, { width: cardWidth }]}
                  onPress={() => {
                    if (captureData) {
                      onRetake(shot.id);
                    } else {
                      onContinue();
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} — ${captureData ? t('protocols.tap_to_retake') : t('protocols.tap_to_capture')}`}
                >
                  {/* Card content */}
                  {captureData ? (
                    <View style={styles.cardImageWrap}>
                      <Image
                        source={{ uri: captureData.uri }}
                        style={[styles.cardImage, { width: cardWidth, height: cardWidth }]}
                        resizeMode="cover"
                      />
                      <View style={styles.cardCheckOverlay}>
                        <Check size={28} color={colors.white} />
                      </View>
                    </View>
                  ) : isSkipped ? (
                    <View style={[styles.cardEmpty, styles.cardSkipped, { height: cardWidth }]}>
                      <Text style={styles.skippedText}>{t('protocols.skipped_badge')}</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.cardEmpty,
                        shot.required ? styles.cardMissingRequired : styles.cardMissingOptional,
                        { height: cardWidth },
                      ]}
                    >
                      <Camera size={28} color={isMissing && shot.required ? DASH_REQUIRED : colors.textTertiary} />
                      <Text style={styles.emptyHint}>
                        {t('protocols.tap_to_capture')}
                      </Text>
                    </View>
                  )}

                  {/* Label + badge row */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardLabel} numberOfLines={1}>{label}</Text>
                    <View style={[
                      styles.statusBadge,
                      captureData ? styles.badgeDone
                        : isSkipped ? styles.badgeSkipped
                        : shot.required ? styles.badgeRequired
                        : styles.badgeOptional,
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {captureData ? t('protocols.completed_badge')
                          : isSkipped ? t('protocols.skipped_badge')
                          : shot.required ? t('protocols.required_badge')
                          : t('protocols.optional_badge')}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Bottom action bar */}
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.lg }]}>
          {isComplete ? (
            <Pressable style={styles.savePrimaryBtn} onPress={onSave} accessibilityRole="button">
              <Text style={styles.savePrimaryText}>{t('protocols.save_complete')}</Text>
            </Pressable>
          ) : hasIncompleteRequired ? (
            <View style={styles.actionRow}>
              <Pressable style={styles.continueBtn} onPress={onContinue} accessibilityRole="button">
                <Text style={styles.continueBtnText}>{t('protocols.continue_capturing')}</Text>
              </Pressable>
              <Pressable style={styles.saveAnywayBtn} onPress={onSave} accessibilityRole="button">
                <Text style={styles.saveAnywayText}>{t('protocols.save_incomplete')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.savePrimaryBtn} onPress={onSave} accessibilityRole="button">
              <Text style={styles.savePrimaryText}>{t('protocols.save_complete')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.warningLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.warning,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  gridContent: {
    padding: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardImageWrap: {
    position: 'relative',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  cardImage: {
    borderRadius: radii.md,
  },
  cardCheckOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THUMB_OVERLAY,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  cardEmpty: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cardSkipped: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  cardMissingRequired: {
    borderColor: DASH_REQUIRED,
    backgroundColor: colors.errorLight,
  },
  cardMissingOptional: {
    borderColor: DASH_OPTIONAL,
    backgroundColor: colors.surface,
  },
  skippedText: {
    ...typography.bodySmall,
    color: colors.warning,
    fontWeight: typography.weight.semibold,
  },
  emptyHint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  cardLabel: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
  statusBadge: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  badgeDone: {
    backgroundColor: colors.successLight,
  },
  badgeSkipped: {
    backgroundColor: colors.warningLight,
  },
  badgeRequired: {
    backgroundColor: colors.errorLight,
  },
  badgeOptional: {
    backgroundColor: colors.surface,
  },
  statusBadgeText: {
    ...typography.caption,
    fontWeight: typography.weight.semibold,
    color: colors.text,
  },
  actionBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  savePrimaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: touch.minTarget,
    justifyContent: 'center',
  },
  savePrimaryText: {
    color: colors.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  continueBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: touch.minTarget,
    justifyContent: 'center',
  },
  continueBtnText: {
    color: colors.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  saveAnywayBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: touch.minTarget,
    justifyContent: 'center',
  },
  saveAnywayText: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
