/**
 * Transparent overlay on top of the camera viewfinder showing the current
 * shot instruction, progress pill, and action buttons.
 *
 * All text is white on semi-transparent dark backgrounds — these are
 * camera-overlay colours, intentionally outside the design system palette.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Image as ImageIcon,
  FlipHorizontal,
  PenTool,
  AlertTriangle,
  Ruler,
  MapPin,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ZoomIn,
  Camera,
  List,
} from 'lucide-react-native';
import { useAppTranslation } from '../hooks/useAppTranslation';
import type { CaptureProtocol, ProtocolShot } from '../config/protocols';
import { spacing, radii, typography, touch, colors } from '../theme';

// ── Camera-safe overlay colours ──────────────────────────────────────────────
const OVERLAY_BG = 'rgba(0,0,0,0.6)';
const OVERLAY_LIGHT = 'rgba(0,0,0,0.45)';
const TEXT_WHITE = colors.white;
const TEXT_DIM = 'rgba(255,255,255,0.7)';
const PROGRESS_BG = 'rgba(255,255,255,0.2)';

// ── Shot icon mapping ────────────────────────────────────────────────────────

type IconComponent = React.ComponentType<{ size: number; color: string }>;

const SHOT_ICONS: Record<string, IconComponent> = {
  'image': ImageIcon,
  'flip-horizontal': FlipHorizontal,
  'pen-tool': PenTool,
  'alert-triangle': AlertTriangle,
  'ruler': Ruler,
  'map-pin': MapPin,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'zoom-in': ZoomIn,
  'camera': Camera,
};

function ShotIcon({ iconName, size, color }: { iconName: string; size: number; color: string }) {
  const Icon = SHOT_ICONS[iconName] ?? Camera;
  return <Icon size={size} color={color} />;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface CaptureGuidanceOverlayProps {
  protocol: CaptureProtocol;
  currentShot: ProtocolShot;
  currentShotIndex: number;
  totalShots: number;
  completedCount: number;
  onSkip: () => void;
  onShowTips: () => void;
  onShowShotList: () => void;
  onReview?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CaptureGuidanceOverlay({
  protocol,
  currentShot,
  currentShotIndex,
  totalShots,
  completedCount,
  onSkip,
  onShowTips,
  onShowShotList,
  onReview,
}: CaptureGuidanceOverlayProps) {
  const { t, i18n } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const lang = i18n.language;
  const isGerman = lang.startsWith('de');

  const protocolName = isGerman ? protocol.name_de : protocol.name;
  const shotLabel = isGerman ? currentShot.label_de : currentShot.label;
  const shotInstruction = isGerman ? currentShot.instruction_de : currentShot.instruction;
  const hasMoreShots = currentShotIndex < totalShots - 1;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.progressPill}>
          <Text style={styles.progressText}>
            {t('protocols.progress', { completed: completedCount, total: totalShots })}
          </Text>
        </View>
        <Text style={styles.protocolName} numberOfLines={1}>
          {protocolName}
        </Text>
      </View>

      {/* ── Bottom card ───────────────────────────────────────────────────── */}
      <View style={styles.bottomCard}>
        <View style={styles.shotHeader}>
          <ShotIcon iconName={currentShot.icon} size={24} color={TEXT_WHITE} />
          <View style={styles.shotHeaderText}>
            <Text style={styles.shotLabel}>{shotLabel}</Text>
            <Text style={styles.shotProgress}>
              {t('protocols.current_shot', { current: currentShotIndex + 1, total: totalShots })}
              {currentShot.required ? ` · ${t('protocols.required_badge')}` : ` · ${t('protocols.optional_badge')}`}
            </Text>
          </View>
        </View>

        <Text style={styles.shotInstruction} numberOfLines={2}>
          {shotInstruction}
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionBtn}
            onPress={onShowTips}
            hitSlop={touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('protocols.show_tips')}
          >
            <Text style={styles.actionBtnText}>{t('protocols.show_tips')}</Text>
          </Pressable>

          {hasMoreShots && (
            <Pressable
              style={styles.actionBtn}
              onPress={onSkip}
              hitSlop={touch.hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('protocols.skip')}
            >
              <Text style={styles.actionBtnText}>{t('protocols.skip')}</Text>
            </Pressable>
          )}

          {completedCount > 0 && onReview && (
            <Pressable
              style={styles.actionBtn}
              onPress={onReview}
              hitSlop={touch.hitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('protocols.review')}
            >
              <Text style={styles.actionBtnText}>{t('protocols.review')}</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.shotListBtn}
            onPress={onShowShotList}
            hitSlop={touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Shot list"
          >
            <List size={20} color={TEXT_WHITE} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 8,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: OVERLAY_BG,
  },
  protocolName: {
    color: TEXT_DIM,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    flex: 1,
    marginLeft: spacing.sm,
    textAlign: 'right',
  },
  progressPill: {
    backgroundColor: PROGRESS_BG,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  progressText: {
    color: TEXT_WHITE,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  // Bottom card
  bottomCard: {
    backgroundColor: OVERLAY_BG,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    marginBottom: 164,
  },
  shotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  shotHeaderText: {
    flex: 1,
  },
  shotLabel: {
    color: TEXT_WHITE,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  shotProgress: {
    color: TEXT_DIM,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginTop: 2,
  },
  shotInstruction: {
    color: TEXT_DIM,
    fontSize: typography.size.base,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionBtn: {
    backgroundColor: OVERLAY_LIGHT,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: touch.minTargetSmall,
    justifyContent: 'center',
  },
  actionBtnText: {
    color: TEXT_WHITE,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  shotListBtn: {
    marginLeft: 'auto',
    backgroundColor: OVERLAY_LIGHT,
    borderRadius: radii.md,
    width: touch.minTargetSmall,
    height: touch.minTargetSmall,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
