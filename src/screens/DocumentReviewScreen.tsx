/**
 * Document review screen (C4).
 *
 * Shows a scanned document image (zoomable) with editable OCR text.
 * Supports save, re-scan, and delete.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { Badge, Button, Divider, IconButton } from '../components/ui';
import { AIFieldBadge } from '../components/AIFieldBadge';
import {
  BackIcon,
  DeleteIcon,
  ScanIcon,
} from '../theme/icons';
import { colors, radii, spacing, touch, typography } from '../theme';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import {
  launchDocumentScanner,
  processDocumentScan,
  extractTextOnDevice,
} from '../services/documentScanService';
import type { Media, OcrSource } from '../db/types';
import type { HomeStackParamList } from '../navigation/HomeStack';

type Props = NativeStackScreenProps<HomeStackParamList, 'DocumentReview'>;

const IMAGE_HEIGHT = 300;

export function DocumentReviewScreen({ route, navigation }: Props) {
  const { mediaId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [rawMedia, setRawMedia] = useState<Media | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrSource, setOcrSource] = useState<OcrSource>('none');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const raw = await db.getFirstAsync<Media>(
      'SELECT * FROM media WHERE id = ?',
      [mediaId],
    );
    if (!raw) return;
    setRawMedia(raw);
    setOcrText(raw.ocr_text ?? '');
    setOcrConfidence(raw.ocr_confidence ?? null);
    setOcrSource((raw.ocr_source as OcrSource) ?? 'none');
    setDirty(false);

    // Find deskewed derivative for display
    const deskewed = await db.getFirstAsync<Media>(
      `SELECT * FROM media WHERE parent_media_id = ? AND media_type = 'document_deskewed'`,
      [mediaId],
    );
    setDisplayUri(deskewed?.file_path ?? raw.file_path);
  }, [db, mediaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Save OCR text ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!rawMedia) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE media SET ocr_text = ?, updated_at = ? WHERE id = ?`,
        [ocrText, now, mediaId],
      );
      await logAuditEntry(db, {
        tableName: 'media',
        recordId: mediaId,
        action: 'ocr_text_edit',
        newValues: { ocrText },
      });
      const syncEngine = new SyncEngine(db);
      await syncEngine.queueChange('media', mediaId, 'update', {
        ocrText,
      });
      setDirty(false);
      Alert.alert(t('documents.saved'));
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  }, [db, mediaId, ocrText, rawMedia, t]);

  // ── Delete document ────────────────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    Alert.alert(t('documents.delete'), t('documents.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await db.withTransactionAsync(async () => {
              // Delete deskewed derivative first (FK)
              await db.runAsync(
                `DELETE FROM media WHERE parent_media_id = ? AND media_type = 'document_deskewed'`,
                [mediaId],
              );
              // Delete raw scan
              await db.runAsync('DELETE FROM media WHERE id = ?', [mediaId]);
              await logAuditEntry(db, {
                tableName: 'media',
                recordId: mediaId,
                action: 'document_deleted',
              });
            });
            navigation.goBack();
          } catch {
            Alert.alert(t('common.error'));
          }
        },
      },
    ]);
  }, [db, mediaId, navigation, t]);

  // ── Re-scan ────────────────────────────────────────────────────────────────

  const handleRescan = useCallback(async () => {
    if (!rawMedia?.object_id) return;
    const objectId = rawMedia.object_id;

    const scanResult = await launchDocumentScanner();
    if (!scanResult) return;

    try {
      // Delete old scan pair
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `DELETE FROM media WHERE parent_media_id = ? AND media_type = 'document_deskewed'`,
          [mediaId],
        );
        await db.runAsync('DELETE FROM media WHERE id = ?', [mediaId]);
      });

      // Store new scan
      const record = await processDocumentScan(
        db,
        objectId,
        scanResult.scannedImageUri,
        scanResult.scannedImageUri,
      );

      // Run OCR
      try {
        await extractTextOnDevice(db, record.rawMediaId, record.deskewedFilePath);
      } catch {
        // OCR failure is non-fatal
      }

      // Navigate to the new document
      navigation.setParams({ mediaId: record.rawMediaId });
    } catch {
      Alert.alert(t('common.error'));
    }
  }, [db, mediaId, navigation, rawMedia, t]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const ocrSourceLabel =
    ocrSource === 'cloud'
      ? t('objects.ocr_cloud')
      : ocrSource === 'on_device'
        ? t('objects.ocr_on_device')
        : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.headerRow}>
        <IconButton
          icon={<BackIcon size={24} color={colors.text} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        />
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {t('objects.view_document')}
        </Text>
        {dirty && (
          <Button
            label={t('documents.save')}
            variant="primary"
            size="sm"
            onPress={handleSave}
            disabled={saving}
          />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Zoomable document image */}
        {displayUri && (
          <ScrollView
            horizontal
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageContainer}
          >
            <Image
              source={{ uri: displayUri }}
              style={styles.documentImage}
              resizeMode="contain"
              accessibilityLabel={t('objects.view_document')}
            />
          </ScrollView>
        )}

        {/* OCR metadata badges */}
        <View style={styles.badgeRow}>
          {ocrConfidence != null && ocrConfidence > 0 && (
            <AIFieldBadge visible confidence={ocrConfidence} />
          )}
          {ocrSourceLabel && (
            <Badge variant="neutral" label={ocrSourceLabel} size="sm" />
          )}
        </View>

        <Divider />

        {/* Editable OCR text */}
        <View style={styles.textSection}>
          <Text style={styles.sectionLabel}>{t('documents.edit_text')}</Text>
          <TextInput
            style={styles.textInput}
            value={ocrText}
            onChangeText={(v) => {
              setOcrText(v);
              setDirty(true);
            }}
            multiline
            textAlignVertical="top"
            placeholder={t('documents.no_text')}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={t('documents.edit_text')}
          />
        </View>

        <Divider />

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.actionButton}
            onPress={handleRescan}
            accessibilityRole="button"
            accessibilityLabel={t('documents.rescan')}
          >
            <ScanIcon size={18} color={colors.primary} />
            <Text style={styles.actionText}>{t('documents.rescan')}</Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel={t('documents.delete')}
          >
            <DeleteIcon size={18} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>
              {t('documents.delete')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  documentImage: {
    width: '100%' as unknown as number,
    height: IMAGE_HEIGHT,
    alignSelf: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  textSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  textInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 160,
    maxHeight: 400,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: touch.minTarget,
  },
  actionText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
});
