/**
 * Slide-in side panel showing all shots in the active protocol
 * with completion status and small thumbnails.
 */

import React, { useEffect, useState as useReactState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useAppTranslation } from '../hooks/useAppTranslation';
import type { CaptureProtocol } from '../config/protocols';
import { typography, spacing, radii, touch } from '../theme';

// ── Camera-safe overlay colours ──────────────────────────────────────────────
const SIDEBAR_BG = 'rgba(0,0,0,0.85)';
const BACKDROP_BG = 'rgba(0,0,0,0.4)';
const ITEM_BG = 'rgba(255,255,255,0.08)';
const ITEM_ACTIVE = 'rgba(255,255,255,0.18)';
const ITEM_TRANSPARENT = 'rgba(0,0,0,0)';
const TEXT_WHITE = '#FFFFFF';
const TEXT_DIM = 'rgba(255,255,255,0.6)';
const BADGE_DONE = '#2E7D32';
const BADGE_SKIPPED = '#E65100';
const BADGE_REQUIRED = '#A32D2D';
const BADGE_OPTIONAL = 'rgba(255,255,255,0.3)';

const SIDEBAR_WIDTH = 280;

interface ShotListSidebarProps {
  visible: boolean;
  protocol: CaptureProtocol;
  completedShots: Map<string, { uri: string; timestamp: string }>;
  skippedShots: Set<string>;
  currentShotId: string | null;
  onSelectShot: (shotId: string) => void;
  onClose: () => void;
}

export function ShotListSidebar({
  visible,
  protocol,
  completedShots,
  skippedShots,
  currentShotId,
  onSelectShot,
  onClose,
}: ShotListSidebarProps) {
  const { t, i18n } = useAppTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const isGerman = i18n.language.startsWith('de');
  const [translateX] = useReactState(() => new Animated.Value(SIDEBAR_WIDTH));

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : SIDEBAR_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

  const sortedShots = [...protocol.shots].sort((a, b) => a.order - b.order);

  const getShotStatus = (shotId: string): 'done' | 'skipped' | 'required' | 'optional' => {
    if (completedShots.has(shotId)) return 'done';
    if (skippedShots.has(shotId)) return 'skipped';
    const shot = protocol.shots.find((s) => s.id === shotId);
    return shot?.required ? 'required' : 'optional';
  };

  const badgeStyle = (status: 'done' | 'skipped' | 'required' | 'optional') => {
    switch (status) {
      case 'done': return { backgroundColor: BADGE_DONE };
      case 'skipped': return { backgroundColor: BADGE_SKIPPED };
      case 'required': return { backgroundColor: BADGE_REQUIRED };
      case 'optional': return { backgroundColor: BADGE_OPTIONAL };
    }
  };

  const badgeLabel = (status: 'done' | 'skipped' | 'required' | 'optional') => {
    switch (status) {
      case 'done': return t('protocols.completed_badge');
      case 'skipped': return t('protocols.skipped_badge');
      case 'required': return t('protocols.required_badge');
      case 'optional': return t('protocols.optional_badge');
    }
  };

  if (!visible) return null;

  return (
    <View style={[styles.backdrop, { width: screenWidth }]}>
      <Pressable style={styles.backdropTouch} onPress={onClose} accessibilityRole="button" />

      <Animated.View style={[styles.sidebar, { transform: [{ translateX }] }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shot list</Text>
          <Pressable
            onPress={onClose}
            hitSlop={touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={24} color={TEXT_WHITE} />
          </Pressable>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {sortedShots.map((shot) => {
            const label = isGerman ? shot.label_de : shot.label;
            const status = getShotStatus(shot.id);
            const isCurrent = shot.id === currentShotId;
            const captureData = completedShots.get(shot.id);

            return (
              <Pressable
                key={shot.id}
                style={[styles.item, isCurrent && styles.itemCurrent]}
                onPress={() => onSelectShot(shot.id)}
                accessibilityRole="button"
                accessibilityLabel={`${label} — ${badgeLabel(status)}`}
              >
                <View style={styles.orderCircle}>
                  <Text style={styles.orderText}>{shot.order}</Text>
                </View>

                <View style={styles.itemContent}>
                  <Text style={styles.itemLabel} numberOfLines={1}>{label}</Text>
                  <View style={[styles.badge, badgeStyle(status)]}>
                    <Text style={styles.badgeText}>{badgeLabel(status)}</Text>
                  </View>
                </View>

                {captureData && (
                  <Image source={{ uri: captureData.uri }} style={styles.thumbnail} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 30,
  },
  backdropTouch: {
    flex: 1,
    backgroundColor: BACKDROP_BG,
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: SIDEBAR_BG,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ITEM_BG,
  },
  headerTitle: {
    color: TEXT_WHITE,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  list: {
    flex: 1,
    paddingTop: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: ITEM_TRANSPARENT,
  },
  itemCurrent: {
    backgroundColor: ITEM_ACTIVE,
  },
  orderCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ITEM_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    color: TEXT_DIM,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  itemContent: {
    flex: 1,
    gap: spacing.xs,
  },
  itemLabel: {
    color: TEXT_WHITE,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  badgeText: {
    color: TEXT_WHITE,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
  },
});
