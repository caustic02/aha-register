import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import { ChevronLeft, Check, Pencil } from 'lucide-react-native';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { useSettings } from '../hooks/useSettings';
import {
  analyzeObject,
  type AIAnalysisResult,
  type AIFieldResult,
} from '../services/ai-analysis';
import { colors, spacing, radii, touch } from '../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIReviewParams {
  objectId: string;
  photoUri: string;
}

type FieldStatus = 'accepted' | 'needs_edit' | 'editing';

interface FieldState {
  key: string;
  label: string;
  value: string;
  confidence: number;
  status: FieldStatus;
  dbColumn: string | null;
}

interface Props {
  objectId: string;
  photoUri: string;
  onSave: (objectId: string) => void;
  onBack: () => void;
}

// ── Field mapping: AI key → display label → DB column ─────────────────────────

const FIELD_MAP: Array<{
  key: keyof AIAnalysisResult;
  labelKey: string;
  dbColumn: string | null;
}> = [
  { key: 'title', labelKey: 'aiReview.fieldTitle', dbColumn: 'title' },
  { key: 'medium', labelKey: 'aiReview.fieldMedium', dbColumn: null },
  {
    key: 'dimensions_description',
    labelKey: 'aiReview.fieldDimensions',
    dbColumn: null,
  },
  {
    key: 'condition_summary',
    labelKey: 'aiReview.fieldCondition',
    dbColumn: null,
  },
  {
    key: 'date_created',
    labelKey: 'aiReview.fieldDate',
    dbColumn: 'event_start',
  },
  {
    key: 'description',
    labelKey: 'aiReview.fieldDescription',
    dbColumn: 'description',
  },
  {
    key: 'style_period',
    labelKey: 'aiReview.fieldStylePeriod',
    dbColumn: null,
  },
  {
    key: 'culture_origin',
    labelKey: 'aiReview.fieldCultureOrigin',
    dbColumn: null,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function AIReviewScreen({ objectId, photoUri, onSave, onBack }: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const { collectionDomain } = useSettings();

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [objectType, setObjectType] = useState<string | null>(null);
  const [objectConfidence, setObjectConfidence] = useState(0);
  const [fields, setFields] = useState<FieldState[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const editValueRef = useRef('');

  // Pulse animation for loading
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!loading) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [loading, pulseAnim]);

  // ── Load AI analysis ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const file = new File(photoUri);
        const imageBase64 = await file.base64();
        const domain = collectionDomain ?? 'museum_collection';

        const response = await analyzeObject(imageBase64, 'image/jpeg', domain);

        if (cancelled) return;

        if (!response.success || !response.metadata) {
          setError(response.error ?? t('aiReview.analysisFailed'));
          setLoading(false);
          return;
        }

        const meta = response.metadata;

        // Set detected object type
        if (meta.object_type?.value) {
          setObjectType(
            typeof meta.object_type.value === 'string'
              ? meta.object_type.value
              : String(meta.object_type.value),
          );
          setObjectConfidence(meta.object_type.confidence);
        }

        // Read the object's capture timestamp for the Date field
        const objRow = await db.getFirstAsync<{ created_at: string }>(
          'SELECT created_at FROM objects WHERE id = ?',
          [objectId],
        );
        const captureDate = objRow?.created_at
          ? new Date(objRow.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : null;

        // Build field states from AI response
        const fieldStates: FieldState[] = [];
        for (const mapping of FIELD_MAP) {
          const field = meta[mapping.key] as AIFieldResult | undefined;

          // For date_created, use the actual capture date instead of AI guess
          if (mapping.key === 'date_created' && captureDate) {
            fieldStates.push({
              key: mapping.key,
              label: t(mapping.labelKey),
              value: captureDate,
              confidence: 100,
              status: 'accepted',
              dbColumn: mapping.dbColumn,
            });
            continue;
          }

          if (!field) continue;
          const val =
            typeof field.value === 'string'
              ? field.value.trim()
              : Array.isArray(field.value)
                ? field.value.join(', ')
                : '';
          if (!val) continue;

          fieldStates.push({
            key: mapping.key,
            label: t(mapping.labelKey),
            value: val,
            confidence: field.confidence,
            status: field.confidence >= 70 ? 'accepted' : 'needs_edit',
            dbColumn: mapping.dbColumn,
          });
        }

        setFields(fieldStates);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('aiReview.analysisFailed'));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photoUri, collectionDomain, db, t]);

  // ── Field interactions ─────────────────────────────────────────────────────

  const handleEditField = useCallback((index: number) => {
    setFields((prev) =>
      prev.map((f, i) => ({
        ...f,
        status:
          i === index
            ? 'editing'
            : f.status === 'editing'
              ? 'accepted'
              : f.status,
      })),
    );
    setEditingIndex(index);
    editValueRef.current = '';
  }, []);

  const handleFieldBlur = useCallback((index: number) => {
    setFields((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: 'accepted' } : f,
      ),
    );
    setEditingIndex(null);
  }, []);

  const handleFieldChangeText = useCallback(
    (index: number, text: string) => {
      setFields((prev) =>
        prev.map((f, i) => (i === index ? { ...f, value: text } : f)),
      );
    },
    [],
  );

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const sets: string[] = ['updated_at = ?'];
      const values: (string | number | null)[] = [now];

      // Build type_specific_data from non-DB fields
      const typeSpecific: Record<string, string> = {};

      for (const field of fields) {
        if (field.dbColumn) {
          sets.push(`${field.dbColumn} = ?`);
          values.push(field.value);
        } else {
          // Store in type_specific_data JSON
          typeSpecific[field.key] = field.value;
        }
      }

      // If there are type-specific fields, merge with existing
      if (Object.keys(typeSpecific).length > 0) {
        const existing = await db.getFirstAsync<{ type_specific_data: string | null }>(
          'SELECT type_specific_data FROM objects WHERE id = ?',
          [objectId],
        );
        let merged: Record<string, unknown> = {};
        if (existing?.type_specific_data) {
          try {
            merged = JSON.parse(existing.type_specific_data);
          } catch {
            // ignore parse errors
          }
        }
        Object.assign(merged, typeSpecific);
        sets.push('type_specific_data = ?');
        values.push(JSON.stringify(merged));
      }

      values.push(objectId);

      await db.runAsync(
        `UPDATE objects SET ${sets.join(', ')} WHERE id = ?`,
        values,
      );
    } catch {
      // Even if update fails, navigate forward
    }

    onSave(objectId);
  }, [db, fields, objectId, onSave]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={onBack}
            accessibilityLabel={t('common.back')}
            accessibilityRole="button"
            hitSlop={touch.hitSlop}
          >
            <ChevronLeft size={20} color="#1A1A1A" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('aiReview.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Photo with detection overlay ─────────────────────────────────── */}
        <View style={styles.photoWrap}>
          <Image
            source={{ uri: photoUri }}
            style={styles.photo}
            resizeMode="cover"
          />

          {/* Loading pulse overlay */}
          {loading && (
            <Animated.View
              style={[styles.pulseOverlay, { opacity: pulseAnim }]}
              pointerEvents="none"
            />
          )}

          {/* Bounding box + label (only after AI completes) */}
          {!loading && !error && objectType && (
            <View style={styles.boundingBox}>
              <View style={styles.labelPill}>
                <Text style={styles.labelPillText}>
                  {objectType} &middot; {objectConfidence}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Loading state ──────────────────────────────────────────────── */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.heroGreen} />
            <Text style={styles.loadingText}>
              {t('aiReview.analyzing')}
            </Text>
          </View>
        )}

        {/* ── Error state ────────────────────────────────────────────────── */}
        {!loading && error && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Suggested fields ──────────────────────────────────────────── */}
        {!loading && fields.length > 0 && (
          <View style={styles.fieldsSection}>
            <Text style={styles.fieldsSectionTitle}>
              {t('aiReview.suggestedFields')}
            </Text>
            {fields.map((field, index) => (
              <View
                key={field.key}
                style={[
                  styles.fieldCard,
                  field.status === 'editing' && styles.fieldCardEditing,
                ]}
              >
                <View style={styles.fieldLeft}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  {field.status === 'editing' ? (
                    <TextInput
                      style={styles.fieldInput}
                      defaultValue={field.value}
                      onChangeText={(text) =>
                        handleFieldChangeText(index, text)
                      }
                      onBlur={() => handleFieldBlur(index)}
                      onSubmitEditing={() => handleFieldBlur(index)}
                      autoFocus
                      returnKeyType="done"
                      multiline={field.key === 'description'}
                    />
                  ) : (
                    <Text style={styles.fieldValue} numberOfLines={3}>
                      {field.value}
                    </Text>
                  )}
                </View>
                {field.status !== 'editing' && (
                  <Pressable
                    style={[
                      styles.fieldActionBtn,
                      field.status === 'accepted'
                        ? styles.fieldActionAccepted
                        : styles.fieldActionEdit,
                    ]}
                    onPress={
                      field.status === 'needs_edit'
                        ? () => handleEditField(index)
                        : () => handleEditField(index)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      field.status === 'accepted'
                        ? t('aiReview.accepted')
                        : t('common.edit')
                    }
                    hitSlop={touch.hitSlop}
                  >
                    {field.status === 'accepted' ? (
                      <Check
                        size={18}
                        color={colors.heroGreen}
                        strokeWidth={2.5}
                      />
                    ) : (
                      <Pencil size={16} color={colors.amber} strokeWidth={2} />
                    )}
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Bottom spacer for CTA */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      {!loading && (
        <View style={styles.ctaWrap}>
          <Pressable
            style={styles.ctaBtn}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel={
              error
                ? t('aiReview.saveWithoutAi')
                : t('aiReview.saveObject')
            }
          >
            <Text style={styles.ctaBtnText}>
              {error
                ? t('aiReview.saveWithoutAi')
                : t('aiReview.saveObject')}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // Photo
  photoWrap: {
    marginHorizontal: spacing.lg,
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  pulseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.heroGreen,
  },
  boundingBox: {
    position: 'absolute',
    top: '12%',
    left: '12%',
    right: '12%',
    bottom: '12%',
    borderWidth: 2.5,
    borderColor: colors.heroGreen,
    borderRadius: 6,
  },
  labelPill: {
    position: 'absolute',
    top: -12,
    left: 8,
    backgroundColor: colors.heroGreen,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  labelPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // Error
  errorWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.warningLight,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  errorText: {
    fontSize: 14,
    color: colors.brownDark,
    textAlign: 'center',
  },

  // Fields section
  fieldsSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  fieldsSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },

  // Field card
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderCard,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    minHeight: 64,
  },
  fieldCardEditing: {
    borderLeftWidth: 2,
    borderLeftColor: colors.heroGreen,
  },
  fieldLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 0.44,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginTop: 2,
  },
  fieldInput: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginTop: 2,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.heroGreen,
    minHeight: 24,
  },

  // Field action buttons
  fieldActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldActionAccepted: {
    backgroundColor: colors.greenLight,
  },
  fieldActionEdit: {
    backgroundColor: colors.warningLight,
  },

  // Bottom CTA
  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: 34,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  ctaBtn: {
    backgroundColor: colors.heroGreen,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});
