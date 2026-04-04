import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { Button, Card } from '../components/ui';
import {
  IncidentIcon,
  OfflineIcon,
  SuccessIcon,
  UserIcon,
  ViewIcon,
} from '../theme/icons';
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onContinue?: () => void;
  onSkip?: () => void;
}

// ── Commitment Card ───────────────────────────────────────────────────────────

interface CommitmentCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function CommitmentCard({ icon, title, description }: CommitmentCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Card style={styles.commitmentCard}>
      <View style={styles.commitmentRow}>
        <View style={styles.iconContainer} accessibilityElementsHidden>
          {icon}
        </View>
        <View style={styles.commitmentText}>
          <Text style={styles.commitmentTitle}>{title}</Text>
          <Text style={styles.commitmentDescription}>{description}</Text>
        </View>
      </View>
    </Card>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TrustScreen({ onContinue, onSkip }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useAppTranslation();

  const advance = onContinue ?? onSkip ?? (() => undefined);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('trust.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('trust.subtitle')}</Text>
        </View>

        {/* ── 2. Commitment cards ──────────────────────────────────────────── */}
        <View style={styles.commitmentList}>
          <CommitmentCard
            icon={<OfflineIcon size={24} color={colors.primary} />}
            title={t('trust.offlineTitle')}
            description={t('trust.offlineDescription')}
          />
          <CommitmentCard
            icon={<IncidentIcon size={24} color={colors.primary} />}
            title={t('trust.euTitle')}
            description={t('trust.euDescription')}
          />
          <CommitmentCard
            icon={<SuccessIcon size={24} color={colors.primary} />}
            title={t('trust.tamperTitle')}
            description={t('trust.tamperDescription')}
          />
          <CommitmentCard
            icon={<ViewIcon size={24} color={colors.primary} />}
            title={t('trust.aiTitle')}
            description={t('trust.aiDescription')}
          />
          <CommitmentCard
            icon={<UserIcon size={24} color={colors.primary} />}
            title={t('trust.privacyTitle')}
            description={t('trust.privacyDescription')}
          />
        </View>

        {/* ── 3. Actions ───────────────────────────────────────────────────── */}
        <View style={styles.actions}>
          <Button
            label={t('trust.continue')}
            onPress={advance}
            size="lg"
          />
          <Pressable
            onPress={advance}
            accessibilityRole="button"
            accessibilityLabel={t('trust.skipA11y')}
            hitSlop={touch.hitSlop}
            style={({ pressed }) => [
              styles.skipWrapper,
              pressed && styles.skipPressed,
            ]}
          >
            <Text style={styles.skipText}>{t('trust.skip')}</Text>
          </Pressable>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  // Header
  header: {
    marginBottom: spacing['2xl'],
  },
  headerTitle: {
    ...typography.h2,
    color: c.text,
    marginBottom: spacing.sm,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: c.textSecondary,
    lineHeight: 20,
  },
  // Commitment cards
  commitmentList: {
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  commitmentCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  commitmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: touch.minTarget,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  commitmentText: {
    flex: 1,
    justifyContent: 'center',
  },
  commitmentTitle: {
    ...typography.h4,
    color: c.text,
    marginBottom: spacing.xs,
  },
  commitmentDescription: {
    ...typography.bodySmall,
    color: c.textSecondary,
    lineHeight: 20,
  },
  // Actions
  actions: {
    gap: spacing.md,
    alignItems: 'center',
  },
  skipWrapper: {
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    minHeight: touch.minTarget,
  },
  skipPressed: {
    opacity: 0.6,
  },
  skipText: {
    ...typography.caption,
    color: c.textMuted,
    textDecorationLine: 'underline',
  },
}); }
