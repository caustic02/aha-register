import React, { useMemo, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
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

// ── Props ────────────────────────────────────────────────────────────────────

export interface ReviewCardScreenProps {
  imageUri: string;
  analysisResult: AIAnalysisResult;
  captureMetadata: CaptureMetadata;
  sha256Hash?: string;
}

// ── Object type options for ChipGroup ────────────────────────────────────────

const OBJECT_TYPE_OPTIONS = [
  { value: 'painting', label: 'Painting' },
  { value: 'sculpture', label: 'Sculpture' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'print', label: 'Print' },
  { value: 'photograph', label: 'Photograph' },
  { value: 'textile', label: 'Textile' },
  { value: 'ceramic', label: 'Ceramic' },
  { value: 'glass', label: 'Glass' },
  { value: 'metal', label: 'Metal' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'jewelry', label: 'Jewelry' },
  { value: 'manuscript', label: 'Manuscript' },
  { value: 'mixed_media', label: 'Mixed Media' },
  { value: 'other', label: 'Other' },
];

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

function formatCoords(meta: CaptureMetadata): string {
  if (meta.latitude == null || meta.longitude == null) return 'Not available';
  return `${meta.latitude.toFixed(6)}, ${meta.longitude.toFixed(6)}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReviewCardScreen({
  imageUri,
  analysisResult,
  captureMetadata,
  sha256Hash,
}: ReviewCardScreenProps) {
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

  // ── Derived values ────────────────────────────────────────────────────────

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
      return { variant: 'success' as const, label: 'High confidence' };
    if (avgConfidence >= 50)
      return { variant: 'warning' as const, label: 'Review suggested' };
    return { variant: 'error' as const, label: 'Low confidence \u2014 review carefully' };
  }, [avgConfidence]);

  const keywordOptions = useMemo(() => {
    const kw = analysisResult.keywords.value;
    if (!Array.isArray(kw)) return [];
    return kw.map((k) => ({ value: k, label: k }));
  }, [analysisResult.keywords.value]);

  const artists = analysisResult.suggested_artists.value;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = () => {
    // TODO: Wire to object creation service — insert into objects table,
    // create object_persons entries, save media record
    console.log('Save pressed', {
      title,
      objectType,
      dateCreated,
      medium,
      dimensions,
      stylePeriod,
      cultureOrigin,
      description,
      condition,
      selectedKeywords,
      captureMetadata,
      imageUri,
      artists,
    });
  };

  const handleDiscard = () => {
    // TODO: Navigate back to capture screen, optionally confirm discard
    console.log('Discard pressed');
  };

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
              {formatCoords(captureMetadata)}
            </Text>
            {sha256Hash != null && (
              <Text style={[styles.captureMeta, typography.mono]}>
                {sha256Hash.slice(0, 8)}
              </Text>
            )}
          </View>
        </Card>

        {/* 2. AI CONFIDENCE SUMMARY */}
        <View style={styles.section}>
          <SectionHeader title="AI Analysis" />
          <View style={styles.confidenceRow}>
            <View style={styles.confidenceItem}>
              <ConfidenceBar
                confidence={analysisResult.title.confidence}
                label="Title"
              />
            </View>
            <View style={styles.confidenceItem}>
              <ConfidenceBar
                confidence={analysisResult.object_type.confidence}
                label="Object type"
              />
            </View>
            <View style={styles.confidenceItem}>
              <ConfidenceBar
                confidence={analysisResult.medium.confidence}
                label="Medium"
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

        {/* 3. CORE METADATA (editable) */}
        <View style={styles.section}>
          <SectionHeader title="Object details" />

          <AIField
            label="Title"
            confidence={analysisResult.title.confidence}
          >
            <TextInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Object title"
            />
          </AIField>

          <AIField
            label="Object type"
            confidence={analysisResult.object_type.confidence}
          >
            <Text style={styles.fieldLabel}>Object type</Text>
            <ChipGroup
              options={OBJECT_TYPE_OPTIONS}
              selected={objectType}
              onSelect={(v) => setObjectType(Array.isArray(v) ? v[0] : v)}
            />
          </AIField>

          <AIField
            label="Date created"
            confidence={analysisResult.date_created.confidence}
          >
            <TextInput
              label="Date created"
              value={dateCreated}
              onChangeText={setDateCreated}
              placeholder="e.g. ca. 1650, 1920-1925"
            />
          </AIField>

          <AIField
            label="Medium / Materials"
            confidence={analysisResult.medium.confidence}
          >
            <TextInput
              label="Medium / Materials"
              value={medium}
              onChangeText={setMedium}
              placeholder="e.g. Oil on canvas"
            />
          </AIField>

          <AIField
            label="Dimensions"
            confidence={analysisResult.dimensions_description.confidence}
          >
            <TextInput
              label="Dimensions"
              value={dimensions}
              onChangeText={setDimensions}
              placeholder="e.g. 30 × 40 cm"
            />
          </AIField>

          <AIField
            label="Style / Period"
            confidence={analysisResult.style_period.confidence}
          >
            <TextInput
              label="Style / Period"
              value={stylePeriod}
              onChangeText={setStylePeriod}
              placeholder="e.g. Baroque, Art Nouveau"
            />
          </AIField>

          <AIField
            label="Culture / Origin"
            confidence={analysisResult.culture_origin.confidence}
          >
            <TextInput
              label="Culture / Origin"
              value={cultureOrigin}
              onChangeText={setCultureOrigin}
              placeholder="e.g. Dutch, Mesoamerican"
            />
          </AIField>
        </View>

        <Divider />

        {/* 4. DESCRIPTION */}
        <View style={styles.section}>
          <SectionHeader title="Description" />
          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Object description"
            multiline
          />
          <View style={styles.confidenceBarWrap}>
            <ConfidenceBar
              confidence={analysisResult.description.confidence}
              label="Description confidence"
            />
          </View>
        </View>

        <Divider />

        {/* 5. CONDITION */}
        <View style={styles.section}>
          <SectionHeader title="Condition" />
          <TextInput
            label="Condition"
            value={condition}
            onChangeText={setCondition}
            placeholder="Visible condition notes"
            multiline
          />
        </View>

        <Divider />

        {/* 6. SUGGESTED ARTISTS */}
        <View style={styles.section}>
          <SectionHeader
            title="Artists"
            action="Add"
            onAction={() => {
              // TODO: Open artist picker/creation modal
            }}
          />
          {artists.length > 0 ? (
            artists.map((artist, idx) => (
              <Card variant="flat" key={`artist-${idx}`} style={styles.artistCard}>
                <View style={styles.artistRow}>
                  <Text style={styles.artistName}>
                    {artist.name ?? 'Unknown artist'}
                  </Text>
                  <Badge variant="neutral" label={artist.role} size="sm" />
                </View>
                <ConfidenceBar
                  confidence={artist.confidence}
                  label="Confidence"
                />
              </Card>
            ))
          ) : (
            <Text style={styles.emptyText}>No artists identified</Text>
          )}
        </View>

        <Divider />

        {/* 7. KEYWORDS */}
        <View style={styles.section}>
          <SectionHeader title="Keywords" />
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
            <Text style={styles.emptyText}>No keywords suggested</Text>
          )}
        </View>

        <Divider />

        {/* 8. SAVE ACTIONS */}
        <View style={styles.actions}>
          <Button
            label="Save to collection"
            variant="primary"
            size="lg"
            onPress={handleSave}
            fullWidth
          />
          <View style={styles.actionSpacer} />
          <Button
            label="Discard"
            variant="ghost"
            size="md"
            onPress={handleDiscard}
            fullWidth
          />
        </View>
      </ScrollView>
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
  return (
    <View style={styles.aiField}>
      <View style={styles.aiFieldHeader}>
        <Badge variant="ai" label="AI" size="sm" />
        <Text style={styles.aiConfidenceText}>{confidence}%</Text>
      </View>
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
  aiFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  aiConfidenceText: {
    ...typography.caption,
    color: colors.ai,
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
  // Actions
  actions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  actionSpacer: {
    height: spacing.md,
  },
});
