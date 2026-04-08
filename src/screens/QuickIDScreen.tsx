/**
 * Quick-ID Screen
 *
 * Museum workflow: identify the object (title + accession number)
 * before capturing photos. Creates the object record in SQLite,
 * then navigates to CaptureScreen with the new object_id.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootStack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { generateId } from '../utils/uuid';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import { getSetting, SETTING_KEYS } from '../services/settingsService';
import { BackIcon, ForwardIcon } from '../theme/icons';
import { IconButton } from '../components/ui';
import { typography, spacing, radii, touch } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface CollectionRow {
  id: string;
  name: string;
}

export function QuickIDScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const db = useDatabase();
  const { t } = useAppTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [title, setTitle] = useState('');
  const [inventoryNumber, setInventoryNumber] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Load collections for picker
  useEffect(() => {
    db.getAllAsync<CollectionRow>(
      'SELECT id, name FROM collections ORDER BY name ASC',
    ).then(setCollections).catch(() => {});
  }, [db]);

  const handleContinue = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const objectId = generateId();
      const now = new Date().toISOString();
      const privacyTier =
        (await getSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER)) ?? 'public';

      await db.withTransactionAsync(async () => {
        // Insert object with title + optional inventory number
        await db.runAsync(
          `INSERT INTO objects
             (id, object_type, status, title, inventory_number, privacy_tier,
              legal_hold, created_at, updated_at)
           VALUES (?, 'museum_object', 'draft', ?, ?, ?, 0, ?, ?)`,
          [objectId, trimmed, inventoryNumber.trim() || null, privacyTier, now, now],
        );

        // Link to collection if selected
        if (selectedCollectionId) {
          const linkId = generateId();
          await db.runAsync(
            `INSERT INTO object_collections (id, object_id, collection_id, created_at)
             VALUES (?, ?, ?, ?)`,
            [linkId, objectId, selectedCollectionId, now],
          );
        }

        // Audit trail
        await logAuditEntry(db, {
          tableName: 'objects',
          recordId: objectId,
          action: 'insert',
          newValues: {
            title: trimmed,
            inventory_number: inventoryNumber.trim() || null,
            source: 'quick_id',
          },
        });

        // Queue sync
        const syncEngine = new SyncEngine(db);
        await syncEngine.queueChange('objects', objectId, 'insert', {
          title: trimmed,
          source: 'quick_id',
        });
      });

      // Navigate to the guided view overview. The user picks a view slot
      // and each capture attaches to this object_id with the correct view_type.
      navigation.replace('ViewChecklist', { objectId });
    } catch {
      setSaving(false);
    }
  }, [db, title, inventoryNumber, selectedCollectionId, saving, navigation]);

  const handleSkip = useCallback(() => {
    navigation.replace('CaptureCamera');
  }, [navigation]);

  const canContinue = title.trim().length > 0 && !saving;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon={<BackIcon size={24} color={colors.text} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back')}
          />
          <Text style={styles.headerTitle}>{t('quickId.title')}</Text>
          <View style={{ width: touch.minTarget }} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('quickId.bezeichnung')}</Text>
            <TextInput
              style={styles.inputLarge}
              value={title}
              onChangeText={setTitle}
              placeholder={t('quickId.placeholder.title')}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              returnKeyType="next"
              maxLength={200}
              accessibilityLabel={t('quickId.bezeichnung')}
            />
          </View>

          {/* Inventory number input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('quickId.inventarnummer')}</Text>
            <TextInput
              style={styles.input}
              value={inventoryNumber}
              onChangeText={setInventoryNumber}
              placeholder={t('quickId.placeholder.number')}
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
              maxLength={100}
              accessibilityLabel={t('quickId.inventarnummer')}
            />
          </View>

          {/* Collection picker */}
          {collections.length > 0 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('quickId.collection')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.collectionRow}
              >
                <Pressable
                  style={[
                    styles.collectionChip,
                    !selectedCollectionId && styles.collectionChipActive,
                  ]}
                  onPress={() => setSelectedCollectionId(null)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.collectionChipText,
                      !selectedCollectionId && styles.collectionChipTextActive,
                    ]}
                  >
                    {t('common.none') || 'None'}
                  </Text>
                </Pressable>
                {collections.map((col) => (
                  <Pressable
                    key={col.id}
                    style={[
                      styles.collectionChip,
                      selectedCollectionId === col.id && styles.collectionChipActive,
                    ]}
                    onPress={() => setSelectedCollectionId(col.id)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.collectionChipText,
                        selectedCollectionId === col.id && styles.collectionChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {col.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.bottom}>
          <Pressable
            style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityLabel={t('quickId.continue')}
          >
            <Text style={styles.continueBtnText}>{t('quickId.continue')}</Text>
            <ForwardIcon size={18} color={colors.white} />
          </Pressable>

          <Pressable
            style={styles.skipBtn}
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel={t('quickId.skip')}
          >
            <Text style={styles.skipBtnText}>{t('quickId.skip')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerTitle: {
    ...typography.h4,
    color: c.text,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
    gap: spacing.xl,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: c.textSecondary,
  },
  inputLarge: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...typography.h4,
    color: c.text,
    minHeight: 56,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: c.text,
    minHeight: touch.minTarget,
  },
  collectionRow: {
    gap: spacing.sm,
  },
  collectionChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    minHeight: touch.minTargetSmall,
    justifyContent: 'center',
  },
  collectionChipActive: {
    borderColor: c.heroGreen,
    backgroundColor: c.greenLight,
  },
  collectionChipText: {
    ...typography.bodySmall,
    color: c.textSecondary,
  },
  collectionChipTextActive: {
    color: c.heroGreen,
    fontWeight: typography.weight.semibold,
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.heroGreen,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    minHeight: touch.minTarget,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    ...typography.body,
    color: c.white,
    fontWeight: typography.weight.semibold,
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: touch.minTarget,
  },
  skipBtnText: {
    ...typography.bodySmall,
    color: c.textSecondary,
  },
}); }
