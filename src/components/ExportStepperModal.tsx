import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { Button, Divider } from './ui';
import { ExportIcon, BackIcon, WarningIcon, CheckIcon } from '../theme/icons';
import { colors, radii, spacing, typography, touch } from '../theme';
import type { ExportableObject } from '../services/export-service';
import { exportAsJSON, exportAsCSV, exportAsPDF } from '../services/export-service';
import { shareExport, buildExportFilename } from '../services/export-share';
import {
  exportCollectionToPDF,
  exportBatchToPDF,
  sharePDF,
} from '../services/exportService';
import type { RegisterObject } from '../db/types';

// ── Types ────────────────────────────────────────────────────────────────────

export type ExportSource =
  | { mode: 'object'; data: ExportableObject }
  | { mode: 'batch'; objectIds: string[]; title: string }
  | { mode: 'collection'; collectionId: string; collectionName: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  source: ExportSource | null;
  /** Called after a successful export (e.g. to exit selection mode) */
  onExportComplete?: () => void;
}

type ExportFormat = 'pdf' | 'json' | 'csv';
type Step = 'format' | 'review' | 'exporting';

interface ScopeInfo {
  objectCount: number;
  publicCount: number;
  confidentialCount: number;
  anonymousCount: number;
  legalHoldCount: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExportStepperModal({
  visible,
  onClose,
  source,
  onExportComplete,
}: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [step, setStep] = useState<Step>('format');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [scope, setScope] = useState<ScopeInfo | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isSingleObject = source?.mode === 'object';

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setStep('format');
      setFormat('pdf');
      setScope(null);
      setError(null);
      setDone(false);

      setProgress('');
    }
  }, [visible]);

  // Load scope info when modal opens
  useEffect(() => {
    if (!visible || !source) return;

    if (source.mode === 'object') {
      const obj = source.data.object;
      setScope({
        objectCount: 1,
        publicCount: obj.privacy_tier === 'public' ? 1 : 0,
        confidentialCount: obj.privacy_tier === 'confidential' ? 1 : 0,
        anonymousCount: obj.privacy_tier === 'anonymous' ? 1 : 0,
        legalHoldCount: obj.legal_hold === 1 ? 1 : 0,
      });
    } else if (source.mode === 'batch') {
      loadBatchScope(source.objectIds);
    } else if (source.mode === 'collection') {
      loadCollectionScope(source.collectionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, source]);

  const loadBatchScope = useCallback(
    async (objectIds: string[]) => {
      try {
        const placeholders = objectIds.map(() => '?').join(',');
        const rows = await db.getAllAsync<
          Pick<RegisterObject, 'privacy_tier' | 'legal_hold'>
        >(
          `SELECT privacy_tier, legal_hold FROM objects WHERE id IN (${placeholders})`,
          objectIds,
        );
        setScope(buildScope(rows));
      } catch {
        setScope({ objectCount: objectIds.length, publicCount: 0, confidentialCount: 0, anonymousCount: 0, legalHoldCount: 0 });
      }
    },
    [db],
  );

  const loadCollectionScope = useCallback(
    async (collectionId: string) => {
      try {
        const rows = await db.getAllAsync<
          Pick<RegisterObject, 'privacy_tier' | 'legal_hold'>
        >(
          `SELECT o.privacy_tier, o.legal_hold
           FROM objects o
           JOIN collection_objects co ON co.object_id = o.id
           WHERE co.collection_id = ?`,
          [collectionId],
        );
        setScope(buildScope(rows));
      } catch {
        setScope({ objectCount: 0, publicCount: 0, confidentialCount: 0, anonymousCount: 0, legalHoldCount: 0 });
      }
    },
    [db],
  );

  // ── Format selection ──────────────────────────────────────────────────────

  const handleFormatSelect = useCallback((f: ExportFormat) => {
    setFormat(f);
    setStep('review');
  }, []);

  // ── Export execution ──────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!source) return;
    setStep('exporting');
    setError(null);
    setDone(false);

    try {
      if (source.mode === 'object') {
        const title = source.data.object.title;
        setProgress(t('exportStepper.exportingObject', { title }));

        if (format === 'pdf') {
          const uri = await exportAsPDF(source.data);
          const filename = buildExportFilename(title, 'pdf');
          await shareExport(uri, filename, 'application/pdf', true);
        } else if (format === 'json') {
          const content = exportAsJSON(source.data);
          const filename = buildExportFilename(title, 'json');
          await shareExport(content, filename, 'application/json');
        } else {
          const content = exportAsCSV(source.data);
          const filename = buildExportFilename(title, 'csv');
          await shareExport(content, filename, 'text/csv');
        }
      } else if (source.mode === 'batch') {
        setProgress(
          t('exportStepper.exportingBatch', { count: source.objectIds.length }),
        );
        const uri = await exportBatchToPDF(db, source.objectIds, source.title);

        await sharePDF(uri);
      } else if (source.mode === 'collection') {
        setProgress(
          t('exportStepper.exportingCollection', {
            name: source.collectionName,
          }),
        );
        const uri = await exportCollectionToPDF(db, source.collectionId);

        await sharePDF(uri);
      }

      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      setDone(true);
      setProgress('');
      onExportComplete?.();
    } catch {
      setError(t('export.error_message'));
      setProgress('');
    }
  }, [source, format, db, t, onExportComplete]);

  const handleRetry = useCallback(() => {
    handleExport();
  }, [handleExport]);

  // ── Computed labels ───────────────────────────────────────────────────────

  const scopeLabel = useMemo(() => {
    if (!scope) return '';
    if (scope.objectCount === 1) return t('exportStepper.scopeOneObject');
    return t('exportStepper.scopeObjects', { count: scope.objectCount });
  }, [scope, t]);

  const privacySummary = useMemo(() => {
    if (!scope) return '';
    const parts: string[] = [];
    if (scope.publicCount > 0)
      parts.push(`${scope.publicCount} ${t('privacy.public').toLowerCase()}`);
    if (scope.confidentialCount > 0)
      parts.push(
        `${scope.confidentialCount} ${t('privacy.confidential').toLowerCase()}`,
      );
    if (scope.anonymousCount > 0)
      parts.push(
        `${scope.anonymousCount} ${t('privacy.anonymous').toLowerCase()}`,
      );
    return parts.join(', ');
  }, [scope, t]);

  const formatLabel = useMemo(() => {
    const labels: Record<ExportFormat, string> = {
      pdf: t('export.pdfOption'),
      json: t('export.jsonOption'),
      csv: t('export.csvOption'),
    };
    return labels[format];
  }, [format, t]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={step !== 'exporting' ? onClose : undefined}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* ── STEP 1: FORMAT ──────────────────────────────────────────── */}
          {step === 'format' && (
            <View>
              <Text style={styles.stepTitle} accessibilityRole="header">
                {t('exportStepper.selectFormat')}
              </Text>
              <Text style={styles.stepLabel}>
                {t('exportStepper.step', { current: 1, total: 3 })}
              </Text>

              <View style={styles.formatList}>
                <FormatCard
                  icon="\uD83D\uDCC4"
                  title={t('export.pdfOption')}
                  description={t('export.pdfDescription')}
                  onPress={() => handleFormatSelect('pdf')}
                  selected={false}
                />
                <FormatCard
                  icon="{ }"
                  title={t('export.jsonOption')}
                  description={t('export.jsonDescription')}
                  onPress={() => handleFormatSelect('json')}
                  disabled={!isSingleObject}
                  disabledHint={
                    !isSingleObject
                      ? t('exportStepper.pdfOnlyBatch')
                      : undefined
                  }
                  selected={false}
                />
                <FormatCard
                  icon="\uD83D\uDCCA"
                  title={t('export.csvOption')}
                  description={t('export.csvDescription')}
                  onPress={() => handleFormatSelect('csv')}
                  disabled={!isSingleObject}
                  disabledHint={
                    !isSingleObject
                      ? t('exportStepper.pdfOnlyBatch')
                      : undefined
                  }
                  selected={false}
                />
              </View>

              <View style={styles.cancelWrap}>
                <Button
                  label={t('common.cancel')}
                  variant="secondary"
                  size="md"
                  onPress={onClose}
                />
              </View>
            </View>
          )}

          {/* ── STEP 2: REVIEW ──────────────────────────────────────────── */}
          {step === 'review' && (
            <View>
              <Text style={styles.stepTitle} accessibilityRole="header">
                {t('exportStepper.reviewScope')}
              </Text>
              <Text style={styles.stepLabel}>
                {t('exportStepper.step', { current: 2, total: 3 })}
              </Text>

              <View style={styles.reviewSection}>
                {/* Format badge */}
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>
                    {t('exportStepper.format')}
                  </Text>
                  <View style={styles.formatBadge}>
                    <Text style={styles.formatBadgeText}>
                      {format.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Divider />

                {/* Scope */}
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>
                    {t('exportStepper.scope')}
                  </Text>
                  <Text style={styles.reviewValue}>{scopeLabel}</Text>
                </View>

                {/* Privacy summary */}
                {scope && privacySummary ? (
                  <>
                    <Divider />
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>
                        {t('exportStepper.privacyBreakdown')}
                      </Text>
                      <Text style={styles.reviewValue}>{privacySummary}</Text>
                    </View>
                  </>
                ) : null}

                {/* Anonymous warning */}
                {scope && scope.anonymousCount > 0 ? (
                  <View style={styles.warningBox}>
                    <WarningIcon size={16} color={colors.warning} />
                    <Text style={styles.warningText}>
                      {t('exportStepper.anonymousWarning', {
                        count: scope.anonymousCount,
                      })}
                    </Text>
                  </View>
                ) : null}

                {/* Legal hold warning */}
                {scope && scope.legalHoldCount > 0 ? (
                  <View style={styles.warningBox}>
                    <WarningIcon size={16} color={colors.error} />
                    <Text style={[styles.warningText, { color: colors.error }]}>
                      {t('exportStepper.legalHoldWarning', {
                        count: scope.legalHoldCount,
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.backButton}
                  onPress={() => setStep('format')}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back')}
                >
                  <BackIcon size={20} color={colors.textSecondary} />
                  <Text style={styles.backText}>{t('common.back')}</Text>
                </Pressable>
                <View style={styles.continueWrap}>
                  <Button
                    label={t('exportStepper.exportAs', {
                      format: formatLabel,
                    })}
                    variant="primary"
                    size="md"
                    onPress={handleExport}
                    fullWidth
                  />
                </View>
              </View>
            </View>
          )}

          {/* ── STEP 3: EXPORTING ───────────────────────────────────────── */}
          {step === 'exporting' && (
            <View style={styles.exportingContainer}>
              {!done && !error && (
                <>
                  <ActivityIndicator
                    size="large"
                    color={colors.primary}
                    style={styles.spinner}
                    accessibilityLabel={t('exportStepper.exporting')}
                  />
                  <Text style={styles.exportingTitle}>
                    {t('exportStepper.exporting')}
                  </Text>
                  {progress ? (
                    <Text style={styles.exportingDetail}>{progress}</Text>
                  ) : null}
                </>
              )}

              {done && (
                <>
                  <View style={styles.successCircle}>
                    <CheckIcon size={32} color={colors.white} />
                  </View>
                  <Text style={styles.exportingTitle}>
                    {t('exportStepper.exportComplete')}
                  </Text>
                  <View style={styles.cancelWrap}>
                    <Button
                      label={t('common.done')}
                      variant="primary"
                      size="md"
                      onPress={onClose}
                      fullWidth
                    />
                  </View>
                </>
              )}

              {error && (
                <>
                  <Text style={styles.errorText}>{error}</Text>
                  <View style={styles.buttonRow}>
                    <View style={styles.continueWrap}>
                      <Button
                        label={t('common.cancel')}
                        variant="secondary"
                        size="md"
                        onPress={onClose}
                      />
                    </View>
                    <View style={styles.continueWrap}>
                      <Button
                        label={t('exportStepper.retry')}
                        variant="primary"
                        size="md"
                        onPress={handleRetry}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Format Card ──────────────────────────────────────────────────────────────

interface FormatCardProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  selected: boolean;
  disabled?: boolean;
  disabledHint?: string;
}

function FormatCard({
  icon,
  title,
  description,
  onPress,
  disabled,
  disabledHint,
}: FormatCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.formatCard,
        disabled && styles.formatCardDisabled,
        pressed && !disabled && styles.formatCardPressed,
      ]}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
    >
      <Text style={styles.formatIcon}>{icon}</Text>
      <View style={styles.formatCardContent}>
        <Text
          style={[styles.formatCardTitle, disabled && styles.textDisabled]}
        >
          {title}
        </Text>
        <Text style={styles.formatCardDesc}>{description}</Text>
        {disabledHint ? (
          <Text style={styles.disabledHint}>{disabledHint}</Text>
        ) : null}
      </View>
      {!disabled && (
        <ExportIcon size={18} color={colors.textTertiary} />
      )}
    </Pressable>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildScope(
  rows: Pick<RegisterObject, 'privacy_tier' | 'legal_hold'>[],
): ScopeInfo {
  let publicCount = 0;
  let confidentialCount = 0;
  let anonymousCount = 0;
  let legalHoldCount = 0;
  for (const row of rows) {
    if (row.privacy_tier === 'public') publicCount++;
    else if (row.privacy_tier === 'confidential') confidentialCount++;
    else if (row.privacy_tier === 'anonymous') anonymousCount++;
    if (row.legal_hold === 1) legalHoldCount++;
  }
  return {
    objectCount: rows.length,
    publicCount,
    confidentialCount,
    anonymousCount,
    legalHoldCount,
  };
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: spacing['3xl'],
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  stepTitle: {
    ...typography.h4,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  // ── Format cards ──
  formatList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    minHeight: touch.minTarget,
  },
  formatCardPressed: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
  },
  formatCardDisabled: {
    opacity: 0.5,
  },
  formatIcon: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  formatCardContent: {
    flex: 1,
  },
  formatCardTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  formatCardDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  textDisabled: {
    color: colors.textTertiary,
  },
  disabledHint: {
    ...typography.caption,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  // ── Review section ──
  reviewSection: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: touch.minTarget,
    paddingVertical: spacing.sm,
  },
  reviewLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  reviewValue: {
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'right',
    flex: 1,
  },
  formatBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  formatBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  warningText: {
    ...typography.caption,
    color: colors.warning,
    flex: 1,
  },
  // ── Buttons ──
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.sm,
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  continueWrap: {
    flex: 1,
  },
  cancelWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  // ── Exporting step ──
  exportingContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  spinner: {
    marginBottom: spacing.lg,
  },
  exportingTitle: {
    ...typography.h4,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  exportingDetail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
