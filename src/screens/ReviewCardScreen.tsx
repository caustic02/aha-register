import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, radii, spacing, touch, typography } from '../theme';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { useDatabase } from '../contexts/DatabaseContext';
import {
  Badge,
  Button,
  Card,
  ChipGroup,
  ConfidenceBar,
  Divider,
  SectionHeader,
  TextInput,
} from '../components/ui';
import type { AIAnalysisResult } from '../services/ai-analysis';
import type { CaptureMetadata } from '../services/metadata';
import { saveReviewedObject } from '../services/objectService';
import {
  addObjectToCollection,
  createCollection,
  getAllCollections,
  type CollectionWithCount,
} from '../services/collectionService';

// ── Props ────────────────────────────────────────────────────────────────────

export interface ReviewCardScreenProps {
  imageUri: string;
  analysisResult: AIAnalysisResult;
  captureMetadata: CaptureMetadata;
  sha256Hash?: string;
  onSave?: (objectId: string) => void;
  onDiscard?: () => void;
}

// ── Object type keys (labels resolved via i18n inside component) ─────────────

const OBJECT_TYPE_KEYS = [
  'painting', 'sculpture', 'drawing', 'print', 'photograph', 'textile',
  'ceramic', 'glass', 'metal', 'furniture', 'jewelry', 'manuscript',
  'mixed_media', 'other',
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fieldString(value: string | string[] | null): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return value;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function formatCoords(meta: CaptureMetadata, fallback: string): string {
  if (meta.latitude == null || meta.longitude == null) return fallback;
  return `${meta.latitude.toFixed(6)}, ${meta.longitude.toFixed(6)}`;
}

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReviewCardScreen({
  imageUri,
  analysisResult,
  captureMetadata,
  sha256Hash,
  onSave,
  onDiscard,
}: ReviewCardScreenProps) {
  const { t } = useAppTranslation();
  const db = useDatabase();

  // ── Editable field state ──────────────────────────────────────────────────

  const [title, setTitle] = useState(fieldString(analysisResult.title.value));
  const [objectType, setObjectType] = useState(
    fieldString(analysisResult.object_type.value) || 'other',
  );
  const [dateCreated, setDateCreated] = useState(
    fieldString(analysisResult.date_created.value),
  );
  const [medium, setMedium] = useState(fieldString(analysisResult.medium.value));
  const [dimensions, setDimensions] = useState(
    fieldString(analysisResult.dimensions_description.value),
  );
  const [stylePeriod, setStylePeriod] = useState(
    fieldString(analysisResult.style_period.value),
  );
  const [cultureOrigin, setCultureOrigin] = useState(
    fieldString(analysisResult.culture_origin.value),
  );
  const [description, setDescription] = useState(
    fieldString(analysisResult.description.value),
  );
  const [condition, setCondition] = useState(
    fieldString(analysisResult.condition_summary.value),
  );
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(() => {
    const kw = analysisResult.keywords.value;
    return Array.isArray(kw) ? kw : [];
  });

  // ── Save state ────────────────────────────────────────────────────────────

  const [saving, setSaving] = useState(false);

  // ── Collection picker state ───────────────────────────────────────────────

  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const collectionSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '80%'], []);

  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  );

  const loadCollections = useCallback(async () => {
    const rows = await getAllCollections(db);
    setCollections(rows);
  }, [db]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // ── Derived values ────────────────────────────────────────────────────────

  const hasAIData = analysisResult.title.confidence > 0 ||
    analysisResult.object_type.confidence > 0 ||
    analysisResult.medium.confidence > 0;

  const avgConfidence = useMemo(() => {
    const scores = [
      analysisResult.title.confidence,
      analysisResult.object_type.confidence,
      analysisResult.medium.confidence,
    ];
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [analysisResult]);

  const confidenceBadge = useMemo(() => {
    if (avgConfidence >= 75)
      return { variant: 'success' as const, label: t('reviewCard.highConfidence') };
    if (avgConfidence >= 50)
      return { variant: 'warning' as const, label: t('reviewCard.reviewSuggested') };
    return { variant: 'error' as const, label: t('reviewCard.lowConfidence') };
  }, [avgConfidence, t]);

  const objectTypeOptions = useMemo(
    () => OBJECT_TYPE_KEYS.map((k) => ({ value: k, label: t(`reviewCard.objectTypes.${k}`) })),
    [t],
  );

  const keywordOptions = useMemo(() => {
    const kw = analysisResult.keywords.value;
    if (!Array.isArray(kw)) return [];
    return kw.map((k) => ({ value: k, label: k }));
  }, [analysisResult.keywords.value]);

  const artists = analysisResult.suggested_artists.value;

  // ── Collection picker handlers ────────────────────────────────────────────

  const openCollectionPicker = useCallback(() => {
    loadCollections();
    collectionSheetRef.current?.snapToIndex(0);
  }, [loadCollections]);

  const handleCreateInline = useCallback(async () => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    setCreatingCollection(true);
    try {
      const created = await createCollection(db, {
        name: trimmed,
        collection_type: 'general',
      });
      setSelectedCollectionId(created.id);
      setNewCollectionName('');
      await loadCollections();
      collectionSheetRef.current?.close();
    } catch (err) {
      if (__DEV__) console.error('Inline collection creation failed:', err);
    } finally {
      setCreatingCollection(false);
    }
  }, [newCollectionName, db, loadCollections]);

  const selectCollection = useCallback((id: string) => {
    setSelectedCollectionId(id);
    collectionSheetRef.current?.close();
  }, []);

  const clearCollection = useCallback(() => {
    setSelectedCollectionId(null);
  }, []);

  // ── Save handler ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Persist the object (copy → hash → transaction)
      const objectId = await saveReviewedObject(db, {
        imageUri,
        mimeType: guessMimeType(imageUri),
        captureMetadata,
        title: title.trim() || 'Untitled',
        objectType: objectType || 'museum_object',
        description: description.trim() || undefined,
        condition: condition.trim() || undefined,
        dateCreated: dateCreated.trim() || undefined,
        medium: medium.trim() || undefined,
        dimensions: dimensions.trim() || undefined,
        stylePeriod: stylePeriod.trim() || undefined,
        cultureOrigin: cultureOrigin.trim() || undefined,
        keywords: selectedKeywords.length > 0 ? selectedKeywords : undefined,
      });

      // Optionally assign to collection (non-blocking for save)
      if (selectedCollectionId) {
        try {
          await addObjectToCollection(db, objectId, selectedCollectionId);
        } catch (err) {
          if (__DEV__) console.warn('addObjectToCollection failed:', err);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      onSave?.(objectId);
    } catch (err) {
      if (__DEV__) console.error('saveReviewedObject failed:', err);
      Alert.alert(
        t('common.error'),
        t('reviewCard.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  }, [
    db, imageUri, captureMetadata, title, objectType, description, condition,
    dateCreated, medium, dimensions, stylePeriod, cultureOrigin,
    selectedKeywords, selectedCollectionId, onSave, t,
  ]);

  const handleDiscard = () => {
    onDiscard?.();
  };

  // ── Bottom sheet backdrop ─────────────────────────────────────────────────

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
      />
    ),
    [],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. IMAGE HEADER */}
        <Card variant="flat" style={styles.imageCard}>
          <Image
            source={{ uri: imageUri }}
            style={styles.headerImage}
            resizeMode="cover"
            accessibilityLabel="Captured photograph"
          />
          <View style={styles.captureMetaRow}>
            <Text style={styles.captureMeta}>
              {formatTimestamp(captureMetadata.timestamp)}
            </Text>
            <Text style={styles.captureMeta}>
              {formatCoords(captureMetadata, t('reviewCard.coordsNotAvailable'))}
            </Text>
            {sha256Hash != null && (
              <Text style={[styles.captureMeta, typography.mono]}>
                {sha256Hash.slice(0, 8)}
              </Text>
            )}
          </View>
        </Card>

        {/* 2. AI CONFIDENCE SUMMARY (hidden when no AI data) */}
        {hasAIData && (
          <>
            <View style={styles.section}>
              <SectionHeader title={t('reviewCard.aiAnalysis')} />
              <View style={styles.confidenceRow}>
                <View style={styles.confidenceItem}>
                  <ConfidenceBar
                    confidence={analysisResult.title.confidence}
                    label={t('reviewCard.confidenceTitle')}
                  />
                </View>
                <View style={styles.confidenceItem}>
                  <ConfidenceBar
                    confidence={analysisResult.object_type.confidence}
                    label={t('reviewCard.confidenceObjectType')}
                  />
                </View>
                <View style={styles.confidenceItem}>
                  <ConfidenceBar
                    confidence={analysisResult.medium.confidence}
                    label={t('reviewCard.confidenceMedium')}
                  />
                </View>
              </View>
              <View style={styles.badgeRow}>
                <Badge variant="ai" label="Gemini 2.5 Pro" size="sm" />
                <View style={styles.badgeSpacer} />
                <Badge
                  variant={confidenceBadge.variant}
                  label={confidenceBadge.label}
                  size="sm"
                />
              </View>
            </View>

            <Divider />
          </>
        )}

        {/* 3. CORE METADATA (editable) */}
        <View style={styles.section}>
          <SectionHeader title={t('reviewCard.objectDetails')} />

          <AIField
            label={t('reviewCard.titleLabel')}
            confidence={analysisResult.title.confidence}
          >
            <TextInput
              label={t('reviewCard.titleLabel')}
              value={title}
              onChangeText={setTitle}
              placeholder={t('reviewCard.titlePlaceholder')}
            />
          </AIField>

          <AIField
            label={t('reviewCard.objectTypeLabel')}
            confidence={analysisResult.object_type.confidence}
          >
            <Text style={styles.fieldLabel}>{t('reviewCard.objectTypeLabel')}</Text>
            <ChipGroup
              options={objectTypeOptions}
              selected={objectType}
              onSelect={(v) => setObjectType(Array.isArray(v) ? v[0] : v)}
            />
          </AIField>

          <AIField
            label={t('reviewCard.dateCreatedLabel')}
            confidence={analysisResult.date_created.confidence}
          >
            <TextInput
              label={t('reviewCard.dateCreatedLabel')}
              value={dateCreated}
              onChangeText={setDateCreated}
              placeholder={t('reviewCard.dateCreatedPlaceholder')}
            />
          </AIField>

          <AIField
            label={t('reviewCard.mediumLabel')}
            confidence={analysisResult.medium.confidence}
          >
            <TextInput
              label={t('reviewCard.mediumLabel')}
              value={medium}
              onChangeText={setMedium}
              placeholder={t('reviewCard.mediumPlaceholder')}
            />
          </AIField>

          <AIField
            label={t('reviewCard.dimensionsLabel')}
            confidence={analysisResult.dimensions_description.confidence}
          >
            <TextInput
              label={t('reviewCard.dimensionsLabel')}
              value={dimensions}
              onChangeText={setDimensions}
              placeholder={t('reviewCard.dimensionsPlaceholder')}
            />
          </AIField>

          <AIField
            label={t('reviewCard.stylePeriodLabel')}
            confidence={analysisResult.style_period.confidence}
          >
            <TextInput
              label={t('reviewCard.stylePeriodLabel')}
              value={stylePeriod}
              onChangeText={setStylePeriod}
              placeholder={t('reviewCard.stylePeriodPlaceholder')}
            />
          </AIField>

          <AIField
            label={t('reviewCard.cultureOriginLabel')}
            confidence={analysisResult.culture_origin.confidence}
          >
            <TextInput
              label={t('reviewCard.cultureOriginLabel')}
              value={cultureOrigin}
              onChangeText={setCultureOrigin}
              placeholder={t('reviewCard.cultureOriginPlaceholder')}
            />
          </AIField>
        </View>

        <Divider />

        {/* 4. DESCRIPTION */}
        <View style={styles.section}>
          <SectionHeader title={t('reviewCard.descriptionSection')} />
          <TextInput
            label={t('reviewCard.descriptionLabel')}
            value={description}
            onChangeText={setDescription}
            placeholder={t('reviewCard.descriptionPlaceholder')}
            multiline
          />
          {hasAIData && (
            <View style={styles.confidenceBarWrap}>
              <ConfidenceBar
                confidence={analysisResult.description.confidence}
                label={t('reviewCard.descriptionConfidence')}
              />
            </View>
          )}
        </View>

        <Divider />

        {/* 5. CONDITION */}
        <View style={styles.section}>
          <SectionHeader title={t('reviewCard.conditionSection')} />
          <TextInput
            label={t('reviewCard.conditionLabel')}
            value={condition}
            onChangeText={setCondition}
            placeholder={t('reviewCard.conditionPlaceholder')}
            multiline
          />
        </View>

        <Divider />

        {/* 6. SUGGESTED ARTISTS */}
        <View style={styles.section}>
          <SectionHeader
            title={t('reviewCard.artistsSection')}
            action={t('reviewCard.artistsAdd')}
            onAction={() => {
              // TODO: Open artist picker/creation modal
            }}
          />
          {artists.length > 0 ? (
            artists.map((artist, idx) => (
              <Card variant="flat" key={`artist-${idx}`} style={styles.artistCard}>
                <View style={styles.artistRow}>
                  <Text style={styles.artistName}>
                    {artist.name ?? t('reviewCard.unknownArtist')}
                  </Text>
                  <Badge variant="neutral" label={artist.role} size="sm" />
                </View>
                <ConfidenceBar
                  confidence={artist.confidence}
                  label={t('reviewCard.artistConfidence')}
                />
              </Card>
            ))
          ) : (
            <Text style={styles.emptyText}>{t('reviewCard.noArtists')}</Text>
          )}
        </View>

        <Divider />

        {/* 7. KEYWORDS */}
        <View style={styles.section}>
          <SectionHeader title={t('reviewCard.keywordsSection')} />
          {keywordOptions.length > 0 ? (
            <ChipGroup
              options={keywordOptions}
              selected={selectedKeywords}
              onSelect={(v) =>
                setSelectedKeywords(Array.isArray(v) ? v : [v])
              }
              multiSelect
            />
          ) : (
            <Text style={styles.emptyText}>{t('reviewCard.noKeywords')}</Text>
          )}
        </View>

        <Divider />

        {/* 8. COLLECTION PICKER */}
        <View style={styles.section}>
          <SectionHeader title={t('reviewCard.collectionSection')} />
          {selectedCollection ? (
            <View style={styles.selectedCollectionRow}>
              <View style={styles.selectedCollectionInfo}>
                <Text style={styles.selectedCollectionName} numberOfLines={1}>
                  {selectedCollection.name}
                </Text>
                <Text style={styles.selectedCollectionType}>
                  {t(`collections.type.${selectedCollection.collection_type}`)}
                </Text>
              </View>
              <Pressable
                onPress={clearCollection}
                hitSlop={touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={t('reviewCard.removeCollection')}
              >
                <Text style={styles.removeCollectionText}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.collectionHint}>
              {t('reviewCard.collectionOptional')}
            </Text>
          )}
          <Pressable
            style={styles.chooseCollectionBtn}
            onPress={openCollectionPicker}
            accessibilityRole="button"
            accessibilityLabel={t('reviewCard.chooseCollection')}
          >
            <Text style={styles.chooseCollectionText}>
              {selectedCollection
                ? t('reviewCard.changeCollection')
                : t('reviewCard.chooseCollection')}
            </Text>
          </Pressable>
        </View>

        <Divider />

        {/* 9. SAVE ACTIONS */}
        <View style={styles.actions}>
          <Button
            label={saving ? t('reviewCard.saving') : t('reviewCard.saveObject')}
            variant="primary"
            size="lg"
            onPress={handleSave}
            fullWidth
            disabled={saving}
          />
          <View style={styles.actionSpacer} />
          <Button
            label={t('reviewCard.discard')}
            variant="ghost"
            size="md"
            onPress={handleDiscard}
            fullWidth
            disabled={saving}
          />
        </View>
      </ScrollView>

      {/* ── Collection Picker Bottom Sheet ─────────────────────────────────── */}
      <BottomSheet
        ref={collectionSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{t('reviewCard.chooseCollection')}</Text>

          {/* Inline create */}
          <View style={styles.inlineCreateRow}>
            <RNTextInput
              style={styles.inlineCreateInput}
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              placeholder={t('reviewCard.newCollectionPlaceholder')}
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable
              style={[
                styles.inlineCreateBtn,
                (!newCollectionName.trim() || creatingCollection) &&
                  styles.inlineCreateBtnDisabled,
              ]}
              onPress={handleCreateInline}
              disabled={!newCollectionName.trim() || creatingCollection}
              accessibilityRole="button"
              accessibilityLabel={t('reviewCard.createAndSelect')}
            >
              <Text style={styles.inlineCreateBtnText}>
                {t('reviewCard.createAndSelect')}
              </Text>
            </Pressable>
          </View>

          {/* Collection list or empty state */}
          {collections.length === 0 ? (
            <View style={styles.sheetEmpty}>
              <Text style={styles.sheetEmptyTitle}>
                {t('reviewCard.noCollections')}
              </Text>
              <Text style={styles.sheetEmptySubtitle}>
                {t('reviewCard.createFirstCollection')}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.sheetList}>
              {collections.map((col) => {
                const isSelected = col.id === selectedCollectionId;
                return (
                  <Pressable
                    key={col.id}
                    style={[
                      styles.sheetItem,
                      isSelected && styles.sheetItemSelected,
                    ]}
                    onPress={() => selectCollection(col.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={col.name}
                  >
                    <Text
                      style={[
                        styles.sheetItemName,
                        isSelected && styles.sheetItemNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {col.name}
                    </Text>
                    <Text style={styles.sheetItemMeta}>
                      {t(`collections.type.${col.collection_type}`)}
                      {' · '}
                      {col.objectCount === 1
                        ? t('collections.object_count_one')
                        : col.objectCount === 0
                          ? t('collections.object_count_zero')
                          : t('collections.object_count', { count: col.objectCount })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ── AIField wrapper — shows AI badge + confidence next to field label ────────

function AIField({
  label: _label,
  confidence,
  children,
}: {
  label: string;
  confidence: number;
  children: React.ReactNode;
}) {
  const hasAI = confidence > 0;
  return (
    <View style={[styles.aiField, hasAI && styles.aiFieldActive]}>
      {hasAI && (
        <View style={styles.aiFieldHeader}>
          <Badge variant="ai" label="AI" size="sm" />
          <Text style={styles.aiConfidenceText}>{confidence}%</Text>
        </View>
      )}
      {children}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },
  // Image header
  imageCard: {
    borderRadius: 0,
    borderWidth: 0,
    padding: 0,
  },
  headerImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  captureMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.lg,
  },
  captureMeta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  // Sections
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  // AI Confidence summary
  confidenceRow: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  confidenceItem: {
    // each bar gets full width
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  badgeSpacer: {
    width: spacing.sm,
  },
  // AI field wrapper
  aiField: {
    marginTop: spacing.md,
  },
  aiFieldActive: {
    backgroundColor: colors.aiSurface,
    borderWidth: 1,
    borderColor: colors.aiBorder,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  aiFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  aiConfidenceText: {
    ...typography.caption,
    color: colors.aiText,
  },
  fieldLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  // Confidence bar under description
  confidenceBarWrap: {
    marginTop: spacing.sm,
  },
  // Artists
  artistCard: {
    marginTop: spacing.sm,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  artistName: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  // Empty states
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  // Collection picker (inline)
  selectedCollectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  selectedCollectionInfo: {
    flex: 1,
  },
  selectedCollectionName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  selectedCollectionType: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeCollectionText: {
    ...typography.body,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
  },
  collectionHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  chooseCollectionBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minHeight: touch.minTargetSmall,
    justifyContent: 'center',
  },
  chooseCollectionText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  // Actions
  actions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  actionSpacer: {
    height: spacing.md,
  },
  // ── Bottom Sheet ──────────────────────────────────────────────────────────
  sheetBg: {
    backgroundColor: colors.surface,
  },
  sheetHandle: {
    backgroundColor: colors.border,
    width: 36,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  sheetTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  // Inline create row
  inlineCreateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  inlineCreateInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: typography.bodySmall.fontSize,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touch.minTargetSmall,
  },
  inlineCreateBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minHeight: touch.minTargetSmall,
  },
  inlineCreateBtnDisabled: {
    opacity: 0.4,
  },
  inlineCreateBtnText: {
    ...typography.bodySmall,
    color: colors.textInverse,
    fontWeight: '600',
  },
  // Collection list
  sheetList: {
    flex: 1,
  },
  sheetItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  sheetItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  sheetItemName: {
    ...typography.body,
    color: colors.text,
  },
  sheetItemNameSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  sheetItemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Empty state in sheet
  sheetEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  sheetEmptyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sheetEmptySubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
