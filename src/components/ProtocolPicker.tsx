/**
 * Protocol selection modal shown before guided capture begins.
 * Displays available protocols as selectable cards with shot counts.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardList, Camera } from 'lucide-react-native';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { getAllProtocols, type CaptureProtocol } from '../config/protocols';
import { typography, spacing, radii, touch, shadows } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface ProtocolPickerProps {
  visible: boolean;
  onSelect: (protocolId: string) => void;
  onSkip: () => void;
  suggestedObjectType?: string;
}

export function ProtocolPicker({ visible, onSelect, onSkip, suggestedObjectType }: ProtocolPickerProps) {
  const { t, i18n } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const lang = i18n.language;
  const isGerman = lang.startsWith('de');
  const protocols = useMemo(() => getAllProtocols(), []);

  const isRecommended = (protocol: CaptureProtocol): boolean => {
    if (!suggestedObjectType) return false;
    return protocol.object_types.includes(suggestedObjectType);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />

          <Text style={styles.title}>{t('protocols.picker_title')}</Text>
          <Text style={styles.subtitle}>{t('protocols.picker_subtitle')}</Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {protocols.map((protocol) => {
              const name = isGerman ? protocol.name_de : protocol.name;
              const desc = isGerman ? protocol.description_de : protocol.description;
              const requiredCount = protocol.shots.filter((s) => s.required).length;
              const optionalCount = protocol.shots.length - requiredCount;
              const recommended = isRecommended(protocol);

              return (
                <Pressable
                  key={protocol.id}
                  style={({ pressed }) => [
                    styles.card,
                    recommended && styles.cardRecommended,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => onSelect(protocol.id)}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                >
                  <View style={styles.cardHeader}>
                    <ClipboardList size={20} color={colors.accent} />
                    <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
                    {recommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>Recommended</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardDesc} numberOfLines={2}>{desc}</Text>
                  <Text style={styles.cardMeta}>
                    {t('protocols.shots_required', { count: requiredCount })}
                    {optionalCount > 0 ? ` · ${t('protocols.shots_optional', { count: optionalCount })}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Freeform option */}
          <Pressable
            style={({ pressed }) => [styles.freeformBtn, pressed && styles.cardPressed]}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={t('protocols.no_protocol')}
          >
            <Camera size={20} color={colors.textSecondary} />
            <Text style={styles.freeformText}>{t('protocols.no_protocol')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      maxHeight: '85%',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.h3,
      color: c.text,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.bodySmall,
      color: c.textSecondary,
      marginBottom: spacing.xl,
    },
    list: {
      flexShrink: 1,
    },
    listContent: {
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
      ...shadows.sm,
    },
    cardRecommended: {
      borderColor: c.heroGreen,
      borderWidth: 2,
    },
    cardPressed: {
      opacity: 0.7,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    cardName: {
      ...typography.h4,
      color: c.text,
      flex: 1,
    },
    recommendedBadge: {
      backgroundColor: c.successLight,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    recommendedText: {
      ...typography.caption,
      color: c.success,
      fontWeight: typography.weight.semibold,
    },
    cardDesc: {
      ...typography.bodySmall,
      color: c.textSecondary,
      marginBottom: spacing.sm,
    },
    cardMeta: {
      ...typography.caption,
      color: c.textTertiary,
    },
    freeformBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      minHeight: touch.minTarget,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      marginTop: spacing.sm,
    },
    freeformText: {
      ...typography.bodySmall,
      color: c.textSecondary,
      fontWeight: typography.weight.medium,
    },
  });
}
