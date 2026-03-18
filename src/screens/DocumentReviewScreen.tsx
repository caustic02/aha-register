/**
 * Document review screen — placeholder for C4.
 *
 * Will show the full scanned document with OCR text,
 * editing controls, and cloud OCR upgrade option.
 */
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { IconButton } from '../components/ui';
import { BackIcon, DocumentScanIcon } from '../theme/icons';
import { colors, spacing, typography } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';

type Props = NativeStackScreenProps<HomeStackParamList, 'DocumentReview'>;

export function DocumentReviewScreen({ route, navigation }: Props) {
  const { mediaId } = route.params;
  const { t } = useAppTranslation();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <IconButton
          icon={<BackIcon size={24} color={colors.text} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        />
        <Text style={styles.headerTitle} accessibilityRole="header">
          {t('objects.view_document')}
        </Text>
      </View>
      <View style={styles.content}>
        <DocumentScanIcon size={48} color={colors.textTertiary} />
        <Text style={styles.placeholderTitle}>
          {t('objects.view_document')}
        </Text>
        <Text style={styles.placeholderBody}>
          Document review coming in C4
        </Text>
        <Text style={styles.mediaId}>
          {mediaId}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text,
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  placeholderTitle: {
    ...typography.h3,
    color: colors.text,
  },
  placeholderBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  mediaId: {
    ...typography.mono,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
