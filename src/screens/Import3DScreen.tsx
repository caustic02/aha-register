/**
 * Import3DScreen
 *
 * Landing screen for the "3D Scan" tool tile on HomeScreen. Shows an
 * explanatory card with an "Upload 3D Model" button. Tapping the button
 * opens the system document picker (via `importNew3DObject`), validates
 * the selected file, creates a new draft object with the 3D file as its
 * primary media, and navigates to ObjectDetail.
 *
 * Navigation uses `replace` so the back button on ObjectDetail returns
 * to Home (not to this intermediate screen).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box } from 'lucide-react-native';

import { BackIcon } from '../theme/icons';
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { importNew3DObject } from '../services/import3D';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'Import3D'>;

export function Import3DScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const db = useDatabase();
  const { t } = useAppTranslation();
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const newObjectId = await importNew3DObject(db, t);
      if (newObjectId) {
        navigation.replace('ObjectDetail', { objectId: newObjectId });
      }
    } finally {
      setUploading(false);
    }
  }, [db, t, uploading, navigation]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={s.back}
          hitSlop={touch.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>{t('import3d.title')}</Text>
        <View style={s.headerSpacer} />
      </View>

      <View style={s.center}>
        <View style={s.iconBox}>
          <Box size={72} color={colors.accent} />
        </View>

        <Text style={s.heading}>{t('import3d.heading')}</Text>
        <Text style={s.description}>{t('import3d.description')}</Text>

        <Pressable
          style={({ pressed }) => [
            s.uploadBtn,
            pressed && s.uploadBtnPressed,
            uploading && s.uploadBtnDisabled,
          ]}
          onPress={handleUpload}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={t('import3d.uploadButton')}
          accessibilityState={{ disabled: uploading, busy: uploading }}
        >
          {uploading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={s.uploadBtnText}>{t('import3d.uploadButton')}</Text>
          )}
        </Pressable>

        <Text style={s.formats}>{t('import3d.supportedFormats')}</Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    back: {
      width: touch.minTarget,
      height: touch.minTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSpacer: {
      width: touch.minTarget,
      height: touch.minTarget,
    },
    title: {
      fontSize: 16,
      fontWeight: typography.weight.semibold,
      color: c.text,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    iconBox: {
      width: 128,
      height: 128,
      borderRadius: radii.lg,
      backgroundColor: c.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    heading: {
      ...typography.h3,
      color: c.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    description: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
      lineHeight: 20,
    },
    uploadBtn: {
      backgroundColor: c.accent,
      borderRadius: radii.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      minHeight: touch.minTarget,
      minWidth: 220,
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadBtnPressed: {
      opacity: 0.85,
    },
    uploadBtnDisabled: {
      opacity: 0.6,
    },
    uploadBtnText: {
      ...typography.body,
      color: c.white,
      fontWeight: typography.weight.bold,
    },
    formats: {
      ...typography.bodySmall,
      color: c.textTertiary,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
  });
}
