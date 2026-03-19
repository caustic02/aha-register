import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  useExportConfig,
  type ExportFormat,
  type ExportSections,
} from '../hooks/useExportConfig';
import type { ExportTier } from '../config/exportTemplates';
import { getViewInventory } from '../config/viewRequirements';
import { Button, Divider } from './ui';
import {
  ExportIcon,
  BackIcon,
  WarningIcon,
  CheckIcon,
  CloseIcon,
  DocumentScanIcon,
  ListViewIcon,
} from '../theme/icons';
import { colors, radii, spacing, typography, touch, shadows } from '../theme';
import type { ExportableObject } from '../services/export-service';
import { exportAsJSON, exportAsCSV, exportAsPDF } from '../services/export-service';
import { shareExport, buildExportFilename } from '../services/export-share';
import {
  exportCollectionToPDF,
  exportBatchToPDF,
  sharePDF,
} from '../services/exportService';
import type { RegisterObject, Media } from '../db/types';

// ── Public types ────────────────────────────────────────────────────────────

export type ExportSource =
  | { mode: 'object'; data: ExportableObject }
  | { mode: 'batch'; objectIds: string[]; title: string }
  | { mode: 'collection'; collectionId: string; collectionName: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  source: ExportSource | null;
  onExportComplete?: () => void;
}

// ── Step types ──────────────────────────────────────────────────────────────

type ObjectStep =
  | 'format'
  | 'template'
  | 'images'
  | 'content'
  | 'preview'
  | 'exporting';

const OBJECT_PDF_STEPS: ObjectStep[] = [
  'format',
  'template',
  'images',
  'content',
  'preview',
];

// ── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  current,
  labels,
}: {
  steps: string[];
  current: number;
  labels: string[];
}) {
  return (
    <View style={si.row} accessibilityRole="progressbar">
      {steps.map((_, i) => (
        <View key={i} style={si.item}>
          <View
            style={[
              si.dot,
              i < current && si.dotDone,
              i === current && si.dotActive,
            ]}
          >
            {i < current ? (
              <CheckIcon size={10} color={colors.white} />
            ) : (
              <Text
                style={[
                  si.dotText,
                  i === current && si.dotTextActive,
                ]}
              >
                {i + 1}
              </Text>
            )}
          </View>
          <Text
            style={[si.label, i === current && si.labelActive]}
            numberOfLines={1}
          >
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const si = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  item: { alignItems: 'center', gap: spacing.xs },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotText: { ...typography.caption, color: colors.textTertiary, fontWeight: '600' },
  dotTextActive: { color: colors.white },
  label: { ...typography.caption, color: colors.textTertiary },
  labelActive: { color: colors.primary, fontWeight: '600' },
});

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export function ExportStepperModal({
  visible,
  onClose,
  source,
  onExportComplete,
}: Props) {
  const isObjectMode = source?.mode === 'object';

  return (
    <Modal
      visible={visible}
      transparent={!isObjectMode}
      animationType="slide"
      onRequestClose={onClose}
    >
      {isObjectMode ? (
        <ObjectExportFlow
          source={source}
          onClose={onClose}
          onExportComplete={onExportComplete}
        />
      ) : visible && source ? (
        <LegacyExportFlow
          source={source}
          onClose={onClose}
          onExportComplete={onExportComplete}
        />
      ) : null}
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// OBJECT EXPORT FLOW (5-step)
// ═════════════════════════════════════════════════════════════════════════════

function ObjectExportFlow({
  source,
  onClose,
  onExportComplete,
}: {
  source: ExportSource & { mode: 'object' };
  onClose: () => void;
  onExportComplete?: () => void;
}) {
  const { t } = useAppTranslation();
  const {
    config,
    reset,
    setFormat,
    applyTemplate,
    toggleImage,
    toggleSection,
    setFlag,
  } = useExportConfig();

  const [step, setStep] = useState<ObjectStep>('format');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { data } = source;
  const media = data.media;

  // Filter to originals for the image selector
  const originals = useMemo(
    () => media.filter((m) => !m.media_type || m.media_type === 'original'),
    [media],
  );

  // View inventory (using 'general' domain — domain-specific tagging is future work)
  const inventory = useMemo(
    () => getViewInventory('general', media),
    [media],
  );

  // Check if any isolated derivatives exist
  const hasIsolated = useMemo(
    () => media.some((m) => m.media_type === 'derivative_isolated'),
    [media],
  );

  // Reset on open
  useEffect(() => {
    reset();
    setStep('format');
    setError(null);
    setDone(false);
    setProgress('');
  }, [reset]);

  // Step index for indicator
  const stepIndex = OBJECT_PDF_STEPS.indexOf(step);
  const isPdfStep = stepIndex >= 0;

  const stepLabels = useMemo(
    () => [
      t('export.step_format'),
      t('export.step_template'),
      t('export.step_images'),
      t('export.step_content'),
      t('export.step_preview'),
    ],
    [t],
  );

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleFormatSelect = useCallback(
    (fmt: ExportFormat) => {
      setFormat(fmt);
      if (fmt === 'json' || fmt === 'csv') {
        // Skip directly to generation
        setStep('exporting');
      } else {
        setStep('template');
      }
    },
    [setFormat],
  );

  const handleTemplateSelect = useCallback(
    (tier: ExportTier) => {
      applyTemplate(tier, media, 'general');
      setStep('images');
    },
    [applyTemplate, media],
  );

  const goBack = useCallback(() => {
    const order: ObjectStep[] = [
      'format',
      'template',
      'images',
      'content',
      'preview',
    ];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  }, [step]);

  const goNext = useCallback(() => {
    const order: ObjectStep[] = [
      'format',
      'template',
      'images',
      'content',
      'preview',
    ];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  }, [step]);

  // ── Export execution ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setStep('exporting');
    setError(null);
    setDone(false);

    try {
      const title = data.object.title;

      if (config.format === 'json') {
        setProgress(t('exportStepper.exportingObject', { title }));
        const content = exportAsJSON(data);
        const filename = buildExportFilename(title, 'json');
        await shareExport(content, filename, 'application/json');
      } else if (config.format === 'csv') {
        setProgress(t('exportStepper.exportingObject', { title }));
        const content = exportAsCSV(data);
        const filename = buildExportFilename(title, 'csv');
        await shareExport(content, filename, 'text/csv');
      } else {
        // PDF — pass through existing generation for now
        setProgress(t('export.preview_generating'));
        const uri = await exportAsPDF(data, config);
        const filename = buildExportFilename(title, 'pdf');
        await shareExport(uri, filename, 'application/pdf', true);
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
  }, [config, data, t, onExportComplete]);

  // Can we advance from the current step?
  const canNext =
    step === 'images'
      ? config.selectedImageIds.length > 0
      : step === 'content'
        ? true
        : false;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={
            step === 'format' || step === 'exporting' ? onClose : goBack
          }
          style={styles.headerBtn}
          hitSlop={touch.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={step === 'format' ? t('common.cancel') : t('export.back')}
        >
          {step === 'format' || step === 'exporting' ? (
            <CloseIcon size={22} color={colors.text} />
          ) : (
            <BackIcon size={22} color={colors.text} />
          )}
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {t('export.modalTitle')}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Step indicator (only for PDF steps) */}
      {isPdfStep && (
        <StepIndicator
          steps={OBJECT_PDF_STEPS as unknown as string[]}
          current={stepIndex}
          labels={stepLabels}
        />
      )}

      {/* Step content */}
      <View style={styles.content}>
        {step === 'format' && (
          <FormatStep onSelect={handleFormatSelect} t={t} />
        )}
        {step === 'template' && (
          <TemplateStep
            selected={config.template}
            onSelect={handleTemplateSelect}
            t={t}
          />
        )}
        {step === 'images' && (
          <ImagesStep
            media={originals}
            selectedIds={config.selectedImageIds}
            useIsolated={config.useIsolated}
            showDimensions={config.showDimensions}
            hasIsolated={hasIsolated}
            inventory={inventory}
            onToggle={toggleImage}
            onSetFlag={setFlag}
            t={t}
          />
        )}
        {step === 'content' && (
          <ContentStep
            sections={config.sections}
            showAiBadges={config.showAiBadges}
            includeBranding={config.includeBranding}
            onToggleSection={toggleSection}
            onSetFlag={setFlag}
            t={t}
          />
        )}
        {step === 'preview' && (
          <PreviewStep
            config={config}
            imageCount={config.selectedImageIds.length}
            t={t}
          />
        )}
        {step === 'exporting' && (
          <ExportingStep
            done={done}
            error={error}
            progress={progress}
            onClose={onClose}
            onRetry={handleGenerate}
            t={t}
          />
        )}
      </View>

      {/* Bottom bar (not shown during exporting) */}
      {isPdfStep && step !== 'format' && step !== 'template' && (
        <View style={styles.bottomBar}>
          <Pressable
            onPress={goBack}
            style={styles.bottomBack}
            accessibilityRole="button"
          >
            <BackIcon size={18} color={colors.textSecondary} />
            <Text style={styles.bottomBackText}>{t('export.back')}</Text>
          </Pressable>
          {step === 'preview' ? (
            <View style={styles.bottomNext}>
              <Button
                label={t('export.preview_generate')}
                variant="primary"
                size="md"
                onPress={handleGenerate}
                fullWidth
              />
            </View>
          ) : (
            <View style={styles.bottomNext}>
              <Button
                label={t('export.next')}
                variant="primary"
                size="md"
                onPress={goNext}
                disabled={!canNext}
                fullWidth
              />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1: FORMAT
// ═════════════════════════════════════════════════════════════════════════════

function FormatStep({
  onSelect,
  t,
}: {
  onSelect: (f: ExportFormat) => void;
  t: (k: string) => string;
}) {
  const formats: { key: ExportFormat; icon: React.ReactNode; title: string; desc: string }[] = [
    {
      key: 'pdf_datasheet',
      icon: <ExportIcon size={22} color={colors.primary} />,
      title: t('export.format_pdf_datasheet'),
      desc: t('export.pdfDescription'),
    },
    {
      key: 'pdf_condition',
      icon: <ExportIcon size={22} color={colors.primary} />,
      title: t('export.format_pdf_condition'),
      desc: t('export.csvDescription'),
    },
    {
      key: 'json',
      icon: <DocumentScanIcon size={22} color={colors.primary} />,
      title: t('export.format_json'),
      desc: t('export.jsonDescription'),
    },
    {
      key: 'csv',
      icon: <ListViewIcon size={22} color={colors.primary} />,
      title: t('export.format_csv'),
      desc: t('export.csvDescription'),
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stepPad}>
      <Text style={styles.stepHeading}>{t('export.step_format')}</Text>
      <View style={styles.cardList}>
        {formats.map((f) => (
          <Pressable
            key={f.key}
            style={({ pressed }) => [
              styles.formatCard,
              pressed && styles.formatCardPressed,
            ]}
            onPress={() => onSelect(f.key)}
            accessibilityRole="button"
            accessibilityLabel={f.title}
          >
            <View style={styles.formatIconWrap}>{f.icon}</View>
            <View style={styles.formatCardContent}>
              <Text style={styles.formatCardTitle}>{f.title}</Text>
              <Text style={styles.formatCardDesc}>{f.desc}</Text>
            </View>
            <ExportIcon size={16} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2: TEMPLATE
// ═════════════════════════════════════════════════════════════════════════════

function TemplateStep({
  selected,
  onSelect,
  t,
}: {
  selected: ExportTier;
  onSelect: (tier: ExportTier) => void;
  t: (k: string) => string;
}) {
  const tiers: { key: ExportTier; title: string; desc: string }[] = [
    {
      key: 'quick',
      title: t('export.template_quick'),
      desc: t('export.template_quick_desc'),
    },
    {
      key: 'standard',
      title: t('export.template_standard'),
      desc: t('export.template_standard_desc'),
    },
    {
      key: 'detailed',
      title: t('export.template_detailed'),
      desc: t('export.template_detailed_desc'),
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stepPad}>
      <Text style={styles.stepHeading}>{t('export.step_template')}</Text>
      <View style={styles.cardList}>
        {tiers.map((tier) => {
          const isActive = selected === tier.key;
          return (
            <Pressable
              key={tier.key}
              style={[
                styles.templateCard,
                isActive && styles.templateCardActive,
              ]}
              onPress={() => onSelect(tier.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.templateHeader}>
                <Text
                  style={[
                    styles.templateTitle,
                    isActive && styles.templateTitleActive,
                  ]}
                >
                  {tier.title}
                </Text>
                {isActive && (
                  <View style={styles.checkCircle}>
                    <CheckIcon size={14} color={colors.white} />
                  </View>
                )}
              </View>
              <Text style={styles.templateDesc}>{tier.desc}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3: IMAGES
// ═════════════════════════════════════════════════════════════════════════════

const IMG_SIZE = 100;
const IMG_GAP = spacing.sm;

function ImagesStep({
  media,
  selectedIds,
  useIsolated,
  showDimensions,
  hasIsolated,
  inventory,
  onToggle,
  onSetFlag,
  t,
}: {
  media: Media[];
  selectedIds: string[];
  useIsolated: boolean;
  showDimensions: boolean;
  hasIsolated: boolean;
  inventory: ReturnType<typeof getViewInventory>;
  onToggle: (id: string) => void;
  onSetFlag: (key: 'useIsolated' | 'showDimensions', v: boolean) => void;
  t: (k: string, p?: Record<string, unknown>) => string;
}) {
  const requiredTotal = inventory.missing_required.length + inventory.captured.length;
  const capturedCount = requiredTotal - inventory.missing_required.length;

  return (
    <ScrollView contentContainerStyle={styles.stepPad}>
      <Text style={styles.stepHeading}>{t('export.images_select')}</Text>

      {/* Completeness indicator */}
      {requiredTotal > 0 && (
        <View style={styles.completenessRow}>
          <Text style={styles.completenessText}>
            {t('export.images_completeness', {
              count: capturedCount,
              total: requiredTotal,
            })}
          </Text>
          <View style={styles.completenessBar}>
            <View
              style={[
                styles.completenessBarFill,
                { width: `${inventory.completeness}%` as unknown as number },
              ]}
            />
          </View>
        </View>
      )}

      {/* Image grid */}
      <View style={styles.imageGrid}>
        {media.map((m) => {
          const selected = selectedIds.includes(m.id);
          const viewLabel = m.view_type
            ? t(`views.${m.view_type}`)
            : t('export.images_select');
          return (
            <Pressable
              key={m.id}
              style={[styles.imageCell, selected && styles.imageCellSelected]}
              onPress={() => onToggle(m.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={viewLabel}
            >
              <Image
                source={{ uri: m.file_path }}
                style={styles.imageThumb}
                resizeMode="cover"
              />
              {selected && (
                <View style={styles.imageCheck}>
                  <CheckIcon size={14} color={colors.white} />
                </View>
              )}
              <Text style={styles.imageLabel} numberOfLines={1}>
                {m.view_type ? t(`views.${m.view_type}`) : '—'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginVertical: spacing.lg }}><Divider /></View>

      {/* Toggles */}
      {hasIsolated && (
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>
              {t('export.images_use_isolated')}
            </Text>
          </View>
          <Switch
            value={useIsolated}
            onValueChange={(v) => onSetFlag('useIsolated', v)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      )}
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>
            {t('export.images_show_dimensions')}
          </Text>
        </View>
        <Switch
          value={showDimensions}
          onValueChange={(v) => onSetFlag('showDimensions', v)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>
    </ScrollView>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4: CONTENT
// ═════════════════════════════════════════════════════════════════════════════

function ContentStep({
  sections,
  showAiBadges,
  includeBranding,
  onToggleSection,
  onSetFlag,
  t,
}: {
  sections: ExportSections;
  showAiBadges: boolean;
  includeBranding: boolean;
  onToggleSection: (key: 'identification' | 'physical' | 'classification' | 'condition' | 'provenance' | 'documents') => void;
  onSetFlag: (key: 'showAiBadges' | 'includeBranding', v: boolean) => void;
  t: (k: string) => string;
}) {
  const sectionKeys: {
    key: 'identification' | 'physical' | 'classification' | 'condition' | 'provenance' | 'documents';
    label: string;
    locked?: boolean;
  }[] = [
    { key: 'identification', label: t('export.content_identification'), locked: true },
    { key: 'physical', label: t('export.content_physical') },
    { key: 'classification', label: t('export.content_classification') },
    { key: 'condition', label: t('export.content_condition') },
    { key: 'provenance', label: t('export.content_provenance') },
    { key: 'documents', label: t('export.content_documents') },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stepPad}>
      <Text style={styles.stepHeading}>{t('export.step_content')}</Text>

      {sectionKeys.map((s) => (
        <View key={s.key} style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>{s.label}</Text>
          </View>
          <Switch
            value={sections[s.key]}
            onValueChange={s.locked ? undefined : () => onToggleSection(s.key)}
            disabled={s.locked}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      ))}

      <View style={{ marginVertical: spacing.lg }}><Divider /></View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>
            {t('export.content_ai_badges')}
          </Text>
        </View>
        <Switch
          value={showAiBadges}
          onValueChange={(v) => onSetFlag('showAiBadges', v)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>
            {t('export.content_branding')}
          </Text>
        </View>
        <Switch
          value={includeBranding}
          onValueChange={(v) => onSetFlag('includeBranding', v)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>
    </ScrollView>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 5: PREVIEW
// ═════════════════════════════════════════════════════════════════════════════

function PreviewStep({
  config,
  imageCount,
  t,
}: {
  config: ReturnType<typeof useExportConfig>['config'];
  imageCount: number;
  t: (k: string) => string;
}) {
  const activeSections = Object.entries(config.sections)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <ScrollView contentContainerStyle={styles.stepPad}>
      <Text style={styles.stepHeading}>{t('export.step_preview')}</Text>

      {/* Simplified PDF preview diagram */}
      <View style={styles.previewPage}>
        {/* Title bar placeholder */}
        <View style={styles.prevHeader}>
          <View style={styles.prevTitleBlock} />
          <View style={styles.prevBadge} />
        </View>

        <View style={styles.prevDivider} />

        {/* Image placeholders */}
        {imageCount > 0 && (
          <View style={styles.prevImageRow}>
            {Array.from({ length: Math.min(imageCount, 4) }).map((_, i) => (
              <View key={i} style={styles.prevImageBox}>
                <ExportIcon size={16} color={colors.textTertiary} />
              </View>
            ))}
          </View>
        )}

        <View style={styles.prevDivider} />

        {/* Section placeholders */}
        {activeSections.map((key) => (
          <View key={key} style={styles.prevSectionRow}>
            <View style={styles.prevSectionDot} />
            <Text style={styles.prevSectionLabel}>
              {t(`export.content_${key}`)}
            </Text>
          </View>
        ))}

        <View style={styles.prevDivider} />

        {/* Footer */}
        <Text style={styles.prevFooter}>aha! Register</Text>
      </View>

      {/* Config summary */}
      <View style={styles.prevSummary}>
        <SummaryRow
          label={t('exportStepper.format')}
          value={config.format.toUpperCase().replace('_', ' ')}
        />
        <SummaryRow label={t('export.step_template')} value={config.template} />
        <SummaryRow
          label={t('export.step_images')}
          value={String(imageCount)}
        />
      </View>
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTING / DONE STATE
// ═════════════════════════════════════════════════════════════════════════════

function ExportingStep({
  done,
  error,
  progress,
  onClose,
  onRetry,
  t,
}: {
  done: boolean;
  error: string | null;
  progress: string;
  onClose: () => void;
  onRetry: () => void;
  t: (k: string) => string;
}) {
  return (
    <View style={styles.exportingContainer}>
      {!done && !error && (
        <>
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.spinner}
          />
          <Text style={styles.exportingTitle}>
            {t('export.preview_generating')}
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
                onPress={onRetry}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LEGACY FLOW (batch / collection — unchanged)
// ═════════════════════════════════════════════════════════════════════════════

function LegacyExportFlow({
  source,
  onClose,
  onExportComplete,
}: {
  source: ExportSource;
  onClose: () => void;
  onExportComplete?: () => void;
}) {
  const db = useDatabase();
  const { t } = useAppTranslation();

  type LegacyFormat = 'pdf' | 'json' | 'csv';
  const [step, setStep] = useState<'format' | 'review' | 'exporting'>('format');
  const [format, setFormat] = useState<LegacyFormat>('pdf');
  const [scope, setScope] = useState<ScopeInfo | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setStep('format');
    setFormat('pdf');
    setScope(null);
    setError(null);
    setDone(false);
    setProgress('');
  }, []);

  useEffect(() => {
    if (source.mode === 'batch') {
      loadBatchScope(source.objectIds);
    } else if (source.mode === 'collection') {
      loadCollectionScope(source.collectionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

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

  const handleFormatSelect = useCallback((f: LegacyFormat) => {
    setFormat(f);
    setStep('review');
  }, []);

  const handleExport = useCallback(async () => {
    setStep('exporting');
    setError(null);
    setDone(false);

    try {
      if (source.mode === 'batch') {
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
  }, [source, db, t, onExportComplete]);

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
    const labels: Record<LegacyFormat, string> = {
      pdf: t('export.pdfOption'),
      json: t('export.jsonOption'),
      csv: t('export.csvOption'),
    };
    return labels[format];
  }, [format, t]);

  return (
    <Pressable
      style={styles.overlay}
      onPress={step !== 'exporting' ? onClose : undefined}
      accessibilityRole="button"
      accessibilityLabel={t('common.cancel')}
    >
      <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
        <View style={styles.handle} />

        {step === 'format' && (
          <View>
            <Text style={styles.legacyStepTitle} accessibilityRole="header">
              {t('exportStepper.selectFormat')}
            </Text>
            <Text style={styles.legacyStepLabel}>
              {t('exportStepper.step', { current: 1, total: 3 })}
            </Text>
            <View style={styles.cardList}>
              <LegacyFormatCard
                icon={<ExportIcon size={22} color={colors.primary} />}
                title={t('export.pdfOption')}
                description={t('export.pdfDescription')}
                onPress={() => handleFormatSelect('pdf')}
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

        {step === 'review' && (
          <View>
            <Text style={styles.legacyStepTitle} accessibilityRole="header">
              {t('exportStepper.reviewScope')}
            </Text>
            <Text style={styles.legacyStepLabel}>
              {t('exportStepper.step', { current: 2, total: 3 })}
            </Text>
            <View style={styles.reviewSection}>
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
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>
                  {t('exportStepper.scope')}
                </Text>
                <Text style={styles.reviewValue}>{scopeLabel}</Text>
              </View>
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
                style={styles.bottomBack}
                onPress={() => setStep('format')}
                accessibilityRole="button"
              >
                <BackIcon size={20} color={colors.textSecondary} />
                <Text style={styles.bottomBackText}>{t('common.back')}</Text>
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

        {step === 'exporting' && (
          <ExportingStep
            done={done}
            error={error}
            progress={progress}
            onClose={onClose}
            onRetry={handleExport}
            t={t}
          />
        )}
      </Pressable>
    </Pressable>
  );
}

function LegacyFormatCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.formatCard,
        pressed && styles.formatCardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.formatIconWrap}>{icon}</View>
      <View style={styles.formatCardContent}>
        <Text style={styles.formatCardTitle}>{title}</Text>
        <Text style={styles.formatCardDesc}>{description}</Text>
      </View>
      <ExportIcon size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface ScopeInfo {
  objectCount: number;
  publicCount: number;
  confidentialCount: number;
  anonymousCount: number;
  legalHoldCount: number;
}

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

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // ── Full-screen layout ──
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    width: touch.minTarget,
    height: touch.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...typography.h4,
    color: colors.text,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  bottomBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.sm,
  },
  bottomBackText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  bottomNext: {
    flex: 1,
  },

  // ── Step content ──
  stepPad: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  stepHeading: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  cardList: {
    gap: spacing.sm,
  },

  // ── Format cards ──
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
  formatIconWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
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

  // ── Template cards ──
  templateCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  templateCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  templateTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  templateTitleActive: {
    color: colors.primary,
  },
  templateDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Image grid ──
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IMG_GAP,
  },
  imageCell: {
    width: IMG_SIZE,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  imageCellSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  imageThumb: {
    width: '100%' as unknown as number,
    height: IMG_SIZE,
    backgroundColor: colors.surfaceContainer,
  },
  imageCheck: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },

  // ── Completeness ──
  completenessRow: {
    marginBottom: spacing.lg,
  },
  completenessText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  completenessBar: {
    height: 6,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 3,
    overflow: 'hidden',
  },
  completenessBarFill: {
    height: '100%' as unknown as number,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },

  // ── Toggle rows ──
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.minTarget,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  // ── Preview ──
  previewPage: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    ...shadows.sm,
    marginBottom: spacing.lg,
  },
  prevHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  prevTitleBlock: {
    width: '60%' as unknown as number,
    height: 14,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.sm,
  },
  prevBadge: {
    width: 48,
    height: 14,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.sm,
  },
  prevDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  prevImageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  prevImageBox: {
    width: 56,
    height: 56,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  prevSectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  prevSectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  prevFooter: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  prevSummary: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // ── Exporting state ──
  exportingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
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
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%' as unknown as number,
  },
  continueWrap: {
    flex: 1,
  },
  cancelWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // ── Legacy bottom sheet ──
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
  legacyStepTitle: {
    ...typography.h4,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  legacyStepLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
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
});
