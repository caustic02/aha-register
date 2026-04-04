import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import {
  CheckIcon,
  ConditionIcon,
  LayersIcon,
  RulerIcon,
  TagIcon,
} from '../theme/icons';
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
import { FormSection } from '../components/FormSection';
import { AIFieldBadge } from '../components/AIFieldBadge';
import type { AIAnalysisResult } from '../services/ai-analysis';
import type { CaptureMetadata } from '../services/metadata';
import { saveReviewedObject, updateReviewedObject } from '../services/objectService';
import {
  addObjectToCollection,
  createCollection,
  getAllCollections,
  type CollectionWithCount,
} from '../services/collectionService';
import { VocabularyPicker } from '../components/VocabularyPicker';
import type { GettyTerm, VocabularySelection } from '../data/getty/types';
import { cleanAatLabel } from '../utils/vocabulary';
import objectTypesData from '../data/getty/object-types.json';
import materialsData from '../data/getty/materials.json';
import techniquesData from '../data/getty/techniques.json';
import stylesPeriodsData from '../data/getty/styles-periods.json';

// ── Props ────────────────────────────────────────────────────────────────────

export interface ReviewCardScreenProps {
  imageUri: string;
  analysisResult: AIAnalysisResult;
  captureMetadata: CaptureMetadata;
  sha256Hash?: string;
  /** When set, updates the existing object instead of creating a new one */
  existingObjectId?: string;
  onSave?: (objectId: string) => void;
  onDiscard?: () => void;
}

// ── Getty vocabulary data (cast for TypeScript — JSON imports have no type) ──

const objectTypesVocab = objectTypesData as GettyTerm[];
const materialsVocab = materialsData as GettyTerm[];
const techniquesVocab = techniquesData as GettyTerm[];
const stylesPeriodsVocab = stylesPeriodsData as GettyTerm[];

/**
 * Try to match an AI-supplied free-text value to a Getty term.
 * Returns a VocabularySelection with AAT URI if found, otherwise free text.
 */
function matchToGetty(
  text: string,
  vocabulary: GettyTerm[],
): VocabularySelection {
  if (!text.trim()) return { label: '', uri: null };
  const lower = text.trim().toLowerCase();
  const match = vocabulary.find(
    (t) =>
      t.label_en.toLowerCase() === lower ||
      (t.label_de && t.label_de.toLowerCase() === lower),
  );
  if (match) return { label: cleanAatLabel(match.label_en), uri: match.uri };
  // Try substring match for compound terms like "oil on canvas"
  const partialMatch = vocabulary.find(
    (t) =>
      lower.includes(t.label_en.toLowerCase()) ||
      t.label_en.toLowerCase().includes(lower),
  );
  if (partialMatch) return { label: cleanAatLabel(partialMatch.label_en), uri: partialMatch.uri };
  return { label: text.trim(), uri: null };
}

/**
 * Match a comma-separated or single AI value to multiple Getty terms.
 */
function matchMultiToGetty(
  text: string,
  vocabulary: GettyTerm[],
): VocabularySelection[] {
  if (!text.trim()) return [];
  // Split on common separators: comma, semicolon, " and ", " on "
  const parts = text.split(/[,;]|\band\b|\bon\b/i).map((s) => s.trim()).filter(Boolean);
  return parts.map((p) => matchToGetty(p, vocabulary));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fieldString(value: string | string[] | null): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return value;
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
  sha256Hash: _sha256Hash,
  existingObjectId,
  onSave,
  onDiscard,
}: ReviewCardScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, i18n } = useAppTranslation();
  const db = useDatabase();
  const vocabLang = (i18n.language?.startsWith('de') ? 'de' : 'en') as 'en' | 'de';

  // ── Editable field state ──────────────────────────────────────────────────

  const [title, setTitle] = useState(fieldString(analysisResult.title.value));
  const [objectTypeSel, setObjectTypeSel] = useState<VocabularySelection>(() =>
    matchToGetty(fieldString(analysisResult.object_type.value) || 'other', objectTypesVocab),
  );
  const [dateCreated, setDateCreated] = useState(
    fieldString(analysisResult.date_created.value),
  );
  const [mediumSel, setMediumSel] = useState<VocabularySelection[]>(() =>
    matchMultiToGetty(fieldString(analysisResult.medium.value), materialsVocab),
  );
  const [dimensions, setDimensions] = useState(
    fieldString(analysisResult.dimensions_description.value),
  );
  const [stylePeriodSel, setStylePeriodSel] = useState<VocabularySelection>(() =>
    matchToGetty(fieldString(analysisResult.style_period.value), stylesPeriodsVocab),
  );
  const [techniqueSel, setTechniqueSel] = useState<VocabularySelection[]>([]);
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

  // ── Form section state ──────────────────────────────────────────────────

  const scrollRef = useRef<ScrollView>(null);
  const [expandedSections, setExpandedSections] = useState({
    identification: true,
    physical: true,
    classification: false,
    condition: false,
  });
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string | null>
  >({});

  type SectionKey = keyof typeof expandedSections;
  const toggleSection = useCallback((key: SectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

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
    try {
      const rows = await getAllCollections(db);
      setCollections(rows);
    } catch (err) {
      console.error('[ReviewCard] loadCollections failed:', err);
    }
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

  const keywordOptions = useMemo(() => {
    const kw = analysisResult.keywords.value;
    if (!Array.isArray(kw)) return [];
    return kw.map((k) => ({ value: k, label: k }));
  }, [analysisResult.keywords.value]);

  const artists = analysisResult.suggested_artists.value;

  // ── AI field counts per section ─────────────────────────────────────────

  const identificationAICount = useMemo(
    () =>
      [
        analysisResult.title.confidence,
        analysisResult.object_type.confidence,
        analysisResult.date_created.confidence,
        analysisResult.description.confidence,
      ].filter((c) => c > 0).length,
    [analysisResult],
  );

  const physicalAICount = useMemo(
    () =>
      [
        analysisResult.medium.confidence,
        analysisResult.dimensions_description.confidence,
      ].filter((c) => c > 0).length,
    [analysisResult],
  );

  const classificationAICount = useMemo(
    () =>
      [
        analysisResult.style_period.confidence,
        analysisResult.culture_origin.confidence,
        analysisResult.keywords.confidence,
      ].filter((c) => c > 0).length,
    [analysisResult],
  );

  const conditionAICount = useMemo(
    () =>
      [analysisResult.condition_summary.confidence].filter((c) => c > 0)
        .length,
    [analysisResult],
  );

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
    } catch (err: unknown) {
      console.error('[ReviewCard] inline collection creation failed:', err);
      Alert.alert(t('common.error'), String(err instanceof Error ? err.message : err));
    } finally {
      setCreatingCollection(false);
    }
  }, [newCollectionName, db, loadCollections, t]);

  const selectCollection = useCallback((id: string) => {
    setSelectedCollectionId(id);
    collectionSheetRef.current?.close();
  }, []);

  const clearCollection = useCallback(() => {
    setSelectedCollectionId(null);
  }, []);

  // ── Save handler ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    // ── Inline validation ────────────────────────────────────────────────
    const errors: Record<string, string | null> = {};
    if (!title.trim()) errors.title = t('validation.titleRequired');
    if (!objectTypeSel.label) errors.objectType = t('validation.objectTypeRequired');
    setValidationErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setExpandedSections((prev) => ({ ...prev, identification: true }));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSaving(true);
    try {
      let objectId: string;

      if (existingObjectId) {
        // Review-existing: UPDATE the quick-captured object (no copy, no hash)
        await updateReviewedObject(db, {
          objectId: existingObjectId,
          title: title.trim() || 'Untitled',
          objectType: objectTypeSel.label || 'museum_object',
          description: description.trim() || undefined,
          condition: condition.trim() || undefined,
          dateCreated: dateCreated.trim() || undefined,
          medium: mediumSel.map((s) => s.label).filter(Boolean).join(', ') || undefined,
          dimensions: dimensions.trim() || undefined,
          stylePeriod: stylePeriodSel.label || undefined,
          cultureOrigin: cultureOrigin.trim() || undefined,
          keywords: selectedKeywords.length > 0 ? selectedKeywords : undefined,
        });
        objectId = existingObjectId;
      } else {
        // New capture: copy → hash → INSERT
        objectId = await saveReviewedObject(db, {
          imageUri,
          mimeType: guessMimeType(imageUri),
          captureMetadata,
          title: title.trim() || 'Untitled',
          objectType: objectTypeSel.label || 'museum_object',
          description: description.trim() || undefined,
          condition: condition.trim() || undefined,
          dateCreated: dateCreated.trim() || undefined,
          medium: mediumSel.map((s) => s.label).filter(Boolean).join(', ') || undefined,
          dimensions: dimensions.trim() || undefined,
          stylePeriod: stylePeriodSel.label || undefined,
          cultureOrigin: cultureOrigin.trim() || undefined,
          keywords: selectedKeywords.length > 0 ? selectedKeywords : undefined,
        });
      }

      // Optionally assign to collection (non-blocking for save)
      if (selectedCollectionId) {
        try {
          await addObjectToCollection(db, objectId, selectedCollectionId);
        } catch (err) {
          const colMsg = err instanceof Error ? err.message : String(err);
          console.warn('[ReviewCard] addObjectToCollection failed:', colMsg);
          Alert.alert(
            t('common.error'),
            `Object saved, but collection assignment failed:\n\n${colMsg}`,
          );
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      onSave?.(objectId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ReviewCard] save failed:', msg, err);
      Alert.alert(
        t('common.error'),
        `${t('reviewCard.saveFailed')}\n\n${msg}`,
      );
    } finally {
      setSaving(false);
    }
  }, [
    db, imageUri, captureMetadata, title, objectTypeSel, description, condition,
    dateCreated, mediumSel, dimensions, stylePeriodSel, cultureOrigin,
    selectedKeywords, selectedCollectionId, existingObjectId, onSave, t,
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
        ref={scrollRef}
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
          <View style={styles.capturedBadge}>
            <CheckIcon size={13} color={colors.heroGreen} />
            <Text style={styles.capturedBadgeText}>{t('reviewCard.photoCaptured')}</Text>
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

        {/* 3. IDENTIFICATION — title, type, date, description */}
        <FormSection
          title={t('formSection.identification')}
          icon={TagIcon}
          expanded={expandedSections.identification}
          onToggle={() => toggleSection('identification')}
          aiFieldCount={identificationAICount}
        >
          <AIField confidence={analysisResult.title.confidence}>
            <TextInput
              label={t('reviewCard.titleLabel')}
              value={title}
              onChangeText={setTitle}
              placeholder={t('reviewCard.titlePlaceholder')}
            />
          </AIField>
          {validationErrors.title && (
            <Text style={styles.validationError} accessibilityRole="alert">
              {validationErrors.title}
            </Text>
          )}

          <AIField confidence={analysisResult.object_type.confidence}>
            <VocabularyPicker
              vocabulary={objectTypesVocab}
              value={objectTypeSel}
              onChange={(v) => setObjectTypeSel(Array.isArray(v) ? v[0] : v)}
              language={vocabLang}
              label={t('reviewCard.objectTypeLabel')}
              placeholder={t('reviewCard.objectTypeLabel')}
            />
          </AIField>
          {validationErrors.objectType && (
            <Text style={styles.validationError} accessibilityRole="alert">
              {validationErrors.objectType}
            </Text>
          )}

          <AIField confidence={analysisResult.date_created.confidence}>
            <TextInput
              label={t('reviewCard.dateCreatedLabel')}
              value={dateCreated}
              onChangeText={setDateCreated}
              placeholder={t('reviewCard.dateCreatedPlaceholder')}
            />
          </AIField>

          <AIField confidence={analysisResult.description.confidence}>
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
          </AIField>
        </FormSection>

        {/* 4. PHYSICAL DESCRIPTION — medium, technique, dimensions */}
        <FormSection
          title={t('formSection.physical')}
          icon={RulerIcon}
          expanded={expandedSections.physical}
          onToggle={() => toggleSection('physical')}
          aiFieldCount={physicalAICount}
        >
          <AIField confidence={analysisResult.medium.confidence}>
            <VocabularyPicker
              vocabulary={materialsVocab}
              value={mediumSel}
              onChange={(v) => setMediumSel(Array.isArray(v) ? v : [v])}
              multiSelect
              language={vocabLang}
              label={t('reviewCard.mediumLabel')}
              placeholder={t('reviewCard.mediumPlaceholder')}
            />
          </AIField>

          <AIField confidence={0}>
            <VocabularyPicker
              vocabulary={techniquesVocab}
              value={techniqueSel}
              onChange={(v) => setTechniqueSel(Array.isArray(v) ? v : [v])}
              multiSelect
              language={vocabLang}
              label={t('reviewCard.techniqueLabel')}
              placeholder={t('reviewCard.techniquePlaceholder')}
            />
          </AIField>

          <AIField confidence={analysisResult.dimensions_description.confidence}>
            <TextInput
              label={t('reviewCard.dimensionsLabel')}
              value={dimensions}
              onChangeText={setDimensions}
              placeholder={t('reviewCard.dimensionsPlaceholder')}
            />
          </AIField>
        </FormSection>

        {/* 5. CLASSIFICATION — style, culture, keywords */}
        <FormSection
          title={t('formSection.classification')}
          icon={LayersIcon}
          expanded={expandedSections.classification}
          onToggle={() => toggleSection('classification')}
          aiFieldCount={classificationAICount}
        >
          <AIField confidence={analysisResult.style_period.confidence}>
            <VocabularyPicker
              vocabulary={stylesPeriodsVocab}
              value={stylePeriodSel}
              onChange={(v) => setStylePeriodSel(Array.isArray(v) ? v[0] : v)}
              language={vocabLang}
              label={t('reviewCard.stylePeriodLabel')}
              placeholder={t('reviewCard.stylePeriodPlaceholder')}
            />
          </AIField>

          <AIField confidence={analysisResult.culture_origin.confidence}>
            <TextInput
              label={t('reviewCard.cultureOriginLabel')}
              value={cultureOrigin}
              onChangeText={setCultureOrigin}
              placeholder={t('reviewCard.cultureOriginPlaceholder')}
            />
          </AIField>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldGroupLabel}>
              {t('reviewCard.keywordsSection')}
            </Text>
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
              <Text style={styles.emptyText}>
                {t('reviewCard.noKeywords')}
              </Text>
            )}
          </View>
        </FormSection>

        {/* 6. CONDITION */}
        <FormSection
          title={t('formSection.condition')}
          icon={ConditionIcon}
          expanded={expandedSections.condition}
          onToggle={() => toggleSection('condition')}
          aiFieldCount={conditionAICount}
        >
          <AIField confidence={analysisResult.condition_summary.confidence}>
            <TextInput
              label={t('reviewCard.conditionLabel')}
              value={condition}
              onChangeText={setCondition}
              placeholder={t('reviewCard.conditionPlaceholder')}
              multiline
            />
          </AIField>
        </FormSection>

        {/* 7. SUGGESTED ARTISTS */}
        <Divider />
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

// ── AIField wrapper — shows AIFieldBadge + confidence-tinted border ──────────

function AIField({
  confidence,
  children,
}: {
  confidence: number;
  children: React.ReactNode;
}) {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const hasAI = confidence > 0;
  return (
    <View style={[s.aiField, hasAI && s.aiFieldActive]}>
      {hasAI && (
        <View style={s.aiFieldHeader}>
          <AIFieldBadge visible confidence={confidence} />
        </View>
      )}
      {children}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.background,
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
  capturedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  capturedBadgeText: {
    ...typography.caption,
    color: c.heroGreen,
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
  // Validation error
  validationError: {
    ...typography.caption,
    color: c.statusError,
    marginTop: spacing.xs,
    marginLeft: spacing.md,
  },
  // Field group (sub-label inside FormSection)
  fieldGroup: {
    marginTop: spacing.md,
  },
  fieldGroupLabel: {
    ...typography.bodySmall,
    color: c.textSecondary,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.sm,
  },
  // AI field wrapper
  aiField: {
    marginTop: spacing.md,
  },
  aiFieldActive: {
    backgroundColor: c.aiSurface,
    borderWidth: 1,
    borderColor: c.aiBorder,
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
    color: c.aiText,
  },
  fieldLabel: {
    ...typography.bodySmall,
    color: c.textSecondary,
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
    color: c.text,
    flex: 1,
  },
  // Empty states
  emptyText: {
    ...typography.bodySmall,
    color: c.textTertiary,
    marginTop: spacing.sm,
  },
  // Collection picker (inline)
  selectedCollectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.primaryLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.primary,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  selectedCollectionInfo: {
    flex: 1,
  },
  selectedCollectionName: {
    ...typography.bodyMedium,
    color: c.text,
  },
  selectedCollectionType: {
    ...typography.caption,
    color: c.textSecondary,
    marginTop: 2,
  },
  removeCollectionText: {
    ...typography.body,
    color: c.textSecondary,
    paddingHorizontal: spacing.sm,
  },
  collectionHint: {
    ...typography.bodySmall,
    color: c.textTertiary,
    marginTop: spacing.xs,
  },
  chooseCollectionBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    minHeight: touch.minTargetSmall,
    justifyContent: 'center',
  },
  chooseCollectionText: {
    ...typography.bodySmall,
    color: c.primary,
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
    backgroundColor: c.surface,
  },
  sheetHandle: {
    backgroundColor: c.border,
    width: 36,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  sheetTitle: {
    ...typography.h4,
    color: c.text,
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
    backgroundColor: c.surfaceContainer,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    color: c.text,
    fontSize: typography.bodySmall.fontSize,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touch.minTargetSmall,
  },
  inlineCreateBtn: {
    backgroundColor: c.primary,
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
    color: c.textInverse,
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
    backgroundColor: c.primaryLight,
  },
  sheetItemName: {
    ...typography.body,
    color: c.text,
  },
  sheetItemNameSelected: {
    color: c.primary,
    fontWeight: '600',
  },
  sheetItemMeta: {
    ...typography.caption,
    color: c.textSecondary,
    marginTop: 2,
  },
  // Empty state in sheet
  sheetEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  sheetEmptyTitle: {
    ...typography.body,
    color: c.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sheetEmptySubtitle: {
    ...typography.bodySmall,
    color: c.textSecondary,
    textAlign: 'center',
  },
}); }
