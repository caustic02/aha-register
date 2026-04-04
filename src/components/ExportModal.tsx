import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { Button, Divider, ListItem } from './ui';
import { ExportIcon } from '../theme/icons';
import { radii, spacing, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import type { ExportableObject } from '../services/export-service';
import { exportAsJSON, exportAsCSV, exportAsPDF } from '../services/export-service';
import { shareExport, buildExportFilename } from '../services/export-share';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  data: ExportableObject | null;
}

type ExportFormat = 'pdf' | 'json' | 'csv';

// ── Component ─────────────────────────────────────────────────────────────────

export function ExportModal({ visible, onClose, data }: ExportModalProps) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    if (!data || loading) return;
    setLoading(format);

    try {
      const title = data.object.title;

      if (format === 'pdf') {
        const uri = await exportAsPDF(data, undefined, colors);
        const filename = buildExportFilename(title, 'pdf');
        await shareExport(uri, filename, 'application/pdf', true);
      } else if (format === 'json') {
        const content = exportAsJSON(data);
        const filename = buildExportFilename(title, 'json');
        await shareExport(content, filename, 'application/json');
      } else {
        const content = exportAsCSV(data);
        const filename = buildExportFilename(title, 'csv');
        await shareExport(content, filename, 'text/csv');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      onClose();
    } catch {
      Alert.alert(t('export.error_title'), t('export.error_message'));
    } finally {
      setLoading(null);
    }
  };

  const iconSize = 20;
  const iconColor = colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessibilityLabel={t('common.cancel')}
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.handle} />

          <Text style={styles.title}>{t('export.modalTitle')}</Text>

          <Divider />

          {/* PDF option */}
          <ListItem
            title={t('export.pdfOption')}
            subtitle={t('export.pdfDescription')}
            onPress={() => handleExport('pdf')}
            rightElement={
              loading === 'pdf' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <ExportIcon size={iconSize} color={iconColor} />
              )
            }
          />

          <Divider />

          {/* JSON option */}
          <ListItem
            title={t('export.jsonOption')}
            subtitle={t('export.jsonDescription')}
            onPress={() => handleExport('json')}
            rightElement={
              loading === 'json' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <ExportIcon size={iconSize} color={iconColor} />
              )
            }
          />

          <Divider />

          {/* CSV option */}
          <ListItem
            title={t('export.csvOption')}
            subtitle={t('export.csvDescription')}
            onPress={() => handleExport('csv')}
            rightElement={
              loading === 'csv' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <ExportIcon size={iconSize} color={iconColor} />
              )
            }
          />

          {/* Cancel button */}
          <View style={styles.cancelWrap}>
            <Button
              label={t('common.cancel')}
              variant="secondary"
              size="md"
              onPress={onClose}
              disabled={loading != null}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: c.overlay,
    },
    sheet: {
      backgroundColor: c.surfaceElevated,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      paddingBottom: spacing['3xl'],
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radii.full,
      backgroundColor: c.border,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    title: {
      ...typography.h4,
      color: c.text,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    cancelWrap: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
  });
}
