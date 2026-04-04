import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { createDraftObject } from '../services/draftObject';
import { typography, spacing, radii, touch } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { VIEW_TYPES, DEFAULT_FIRST_VIEW } from '../constants/viewTypes';
import { ChevronDown, Check } from 'lucide-react-native';
import type { RegisterViewType } from '../db/types';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'CaptureReview'>;

export function CaptureReviewScreen({ route, navigation }: Props) {
  const { imageUri, mimeType, metadata } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [selectedView, setSelectedView] = useState<RegisterViewType>(DEFAULT_FIRST_VIEW);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleRetake = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleUsePhoto = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const objectId = await createDraftObject(db, {
        imageUri,
        fileName: null,
        fileSize: null,
        mimeType,
        metadata,
        objectType: 'museum_object',
      });

      // Tag primary media with selected view_type
      const now = new Date().toISOString();
      await db.runAsync(
        'UPDATE media SET view_type = ?, updated_at = ? WHERE object_id = ? AND is_primary = 1',
        [selectedView, now, objectId],
      );
      const pRow = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM media WHERE object_id = ? AND is_primary = 1',
        [objectId],
      );
      if (pRow) {
        const { SyncEngine: SE } = await import('../sync/engine');
        const se = new SE(db);
        await se.queueChange('media', pRow.id, 'update', { view_type: selectedView });
      }

      navigation.replace('ObjectDetail', { objectId });
    } catch {
      setSaving(false);
    }
  }, [saving, db, imageUri, mimeType, metadata, selectedView, navigation]);

  const viewLabel = t(`view_types.${selectedView}`);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Full-screen image preview */}
      <View style={s.preview}>
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>

      {/* View type picker overlay */}
      {showPicker && (
        <View style={s.pickerOverlay}>
          <Pressable style={s.pickerBackdrop} onPress={() => setShowPicker(false)} />
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>{t('capture.select_view')}</Text>
            <ScrollView style={s.pickerScroll}>
              {VIEW_TYPES.map((vt) => {
                const active = vt.key === selectedView;
                return (
                  <Pressable
                    key={vt.key}
                    style={[s.pickerItem, active && s.pickerItemActive]}
                    onPress={() => { setSelectedView(vt.key); setShowPicker(false); }}
                    accessibilityRole="button"
                  >
                    <Text style={[s.pickerItemText, active && s.pickerItemTextActive]}>
                      {t(vt.labelKey)}
                    </Text>
                    {active && <Check size={18} color={colors.accent} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Bottom action bar */}
      <View style={s.bar}>
        <Pressable style={s.retakeBtn} onPress={handleRetake} accessibilityRole="button">
          <Text style={s.retakeText}>{t('capture.retake')}</Text>
        </Pressable>

        <Pressable style={s.viewBtn} onPress={() => setShowPicker(true)} accessibilityRole="button">
          <Text style={s.viewBtnText} numberOfLines={1}>{viewLabel}</Text>
          <ChevronDown size={16} color={colors.text} />
        </Pressable>

        <Pressable
          style={[s.useBtn, saving && s.useBtnDisabled]}
          onPress={handleUsePhoto}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={s.useText}>{t('capture.use_photo')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.black },
    preview: { flex: 1 },
    // Bottom bar
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    retakeBtn: {
      minHeight: touch.minTarget,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    retakeText: {
      color: c.textSecondary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.semibold,
    },
    viewBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: touch.minTarget,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
    },
    viewBtnText: {
      color: c.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    useBtn: {
      minHeight: touch.minTarget,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      backgroundColor: c.accent,
      borderRadius: radii.md,
    },
    useBtnDisabled: { opacity: 0.5 },
    useText: {
      color: c.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    // Picker overlay
    pickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      zIndex: 100,
    },
    pickerBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
    },
    pickerSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      maxHeight: '60%',
    },
    pickerTitle: {
      fontSize: typography.size.lg,
      fontWeight: typography.weight.bold,
      color: c.text,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    pickerScroll: { paddingHorizontal: spacing.lg },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      minHeight: touch.minTarget,
      borderRadius: radii.md,
    },
    pickerItemActive: { backgroundColor: c.surfaceElevated },
    pickerItemText: {
      fontSize: typography.size.md,
      color: c.text,
    },
    pickerItemTextActive: {
      color: c.accent,
      fontWeight: typography.weight.semibold,
    },
  });
}
