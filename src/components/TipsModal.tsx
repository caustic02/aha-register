/**
 * Simple modal showing tips for the current protocol shot.
 * Uses standard theme colors (not camera overlay colours).
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
import { CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTranslation } from '../hooks/useAppTranslation';
import type { ProtocolShot } from '../config/protocols';
import { typography, spacing, radii, touch } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface TipsModalProps {
  visible: boolean;
  shot: ProtocolShot;
  onClose: () => void;
}

export function TipsModal({ visible, shot, onClose }: TipsModalProps) {
  const { i18n } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isGerman = i18n.language.startsWith('de');

  const label = isGerman ? shot.label_de : shot.label;
  const tips = isGerman ? shot.tips_de : shot.tips;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.title}>{label}</Text>

          <ScrollView style={styles.tipsList} showsVerticalScrollIndicator={false}>
            {tips.map((tip, index) => (
              <View key={index} style={styles.tipRow}>
                <CheckCircle2 size={16} color={colors.success} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable
            style={styles.dismissBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={styles.dismissBtnText}>Got it</Text>
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
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      backgroundColor: c.background,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      width: '100%',
      maxWidth: 360,
      maxHeight: '60%',
    },
    title: {
      ...typography.h3,
      color: c.text,
      marginBottom: spacing.lg,
    },
    tipsList: {
      flexShrink: 1,
      marginBottom: spacing.lg,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    tipText: {
      ...typography.body,
      color: c.textSecondary,
      flex: 1,
    },
    dismissBtn: {
      backgroundColor: c.accent,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      minHeight: touch.minTarget,
      justifyContent: 'center',
    },
    dismissBtnText: {
      color: c.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
  });
}
