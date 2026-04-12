import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { File } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { spacing, radii, typography, shadows, touch } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { CheckIcon, BackIcon } from '../theme/icons';
import {
  Eye,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Search,
  Camera,
} from 'lucide-react-native';
import { VIEW_TYPES, type ViewTypeDefinition } from '../constants/viewTypes';
import type { RegisterViewType } from '../db/types';
import type { RootStackParamList } from '../navigation/RootStack';
import { resolveMediaUri } from '../utils/resolveMediaUri';

type Props = NativeStackScreenProps<RootStackParamList, 'ViewChecklist'>;

interface CapturedView {
  viewType: RegisterViewType;
  mediaId: string;
  filePath: string;
}

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  'eye': Eye,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'arrow-left': ArrowLeft,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'search': Search,
};

function ViewIcon({ iconName, size, color }: { iconName: string; size: number; color: string }) {
  const Icon = ICON_MAP[iconName];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={1.5} />;
}

export function ViewChecklistScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { objectId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();
  // No tab nav needed - single stack

  const [objectTitle, setObjectTitle] = useState<string | null>(null);
  const [inventoryNumber, setInventoryNumber] = useState<string | null>(null);
  const [capturedViews, setCapturedViews] = useState<CapturedView[]>([]);

  // Load object title and captured views on focus.
  //
  // Row acceptance rules:
  //  - http(s) URL (e.g. Supabase Storage signed URL, Met CDN) → trust it,
  //    no local file check — remote content is valid even without a cached copy.
  //  - local file:// URI → resolve via resolveMediaUri (iOS container UUID can
  //    change between sessions, so the raw absolute path may be stale) and
  //    check the resolved URI on disk.
  //  - NEVER delete media rows from the display path. Deleting here means
  //    evidence-linked media silently disappears on every focus if the file
  //    existence check has any false negatives, which was the entry point for
  //    the "photos don't populate view slots" bug.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        // Get object title + inventory number
        const obj = await db.getFirstAsync<{ title: string; inventory_number: string | null }>(
          `SELECT title, inventory_number FROM objects WHERE id = ?`,
          [objectId],
        );
        if (!cancelled && obj) {
          setObjectTitle(obj.title);
          setInventoryNumber(obj.inventory_number);
        }

        // Get media rows with a view_type for this object
        const rows = await db.getAllAsync<{
          id: string;
          view_type: string;
          file_path: string;
          thumbnail_uri: string | null;
        }>(
          `SELECT id, view_type, file_path, thumbnail_uri FROM media
           WHERE object_id = ?
             AND view_type IS NOT NULL
             AND (media_type IS NULL OR media_type = 'original')
           ORDER BY created_at DESC`,
          [objectId],
        );
        console.log('[viewchecklist] loaded', rows.length, 'media rows for', objectId);

        const verified: CapturedView[] = [];
        const seen = new Set<string>();
        for (const r of rows) {
          if (seen.has(r.view_type)) continue; // keep the newest per view_type

          const isRemote = r.file_path.startsWith('http://') || r.file_path.startsWith('https://');
          let accept = isRemote;
          let resolvedPath = r.file_path;
          if (!isRemote) {
            // Rebuild the URI for the current session's documents directory and
            // then check disk — handles iOS container UUID rollover.
            resolvedPath = resolveMediaUri(r.file_path);
            try {
              accept = new File(resolvedPath).exists;
            } catch {
              accept = false;
            }
            if (!accept) {
              // Fall back to the raw stored path in case resolveMediaUri
              // stripped a legitimate prefix.
              try {
                accept = new File(r.file_path).exists;
              } catch {
                accept = false;
              }
            }
          }

          if (accept) {
            verified.push({
              viewType: r.view_type as RegisterViewType,
              mediaId: r.id,
              filePath: r.thumbnail_uri ?? r.file_path,
            });
            seen.add(r.view_type);
          } else {
            console.warn('[viewchecklist] skipping row (file not found):', r.id, r.file_path.substring(0, 120));
          }
        }
        if (!cancelled) {
          console.log('[viewchecklist] verified', verified.length, '/', rows.length);
          setCapturedViews(verified);
        }
      })();

      return () => { cancelled = true; };
    }, [db, objectId]),
  );

  const isCaptured = useCallback(
    (key: RegisterViewType) => capturedViews.some((v) => v.viewType === key),
    [capturedViews],
  );

  const getThumbnail = useCallback(
    (key: RegisterViewType) => capturedViews.find((v) => v.viewType === key),
    [capturedViews],
  );

  const handleCardPress = useCallback(
    (viewDef: ViewTypeDefinition) => {
      const existing = getThumbnail(viewDef.key);
      if (existing) {
        // Already captured — offer retake. handleViewTypeShutter will
        // replace the existing media row for this view_type on save.
        Alert.alert(
          t(viewDef.labelKey),
          t('view_checklist.retake_confirm') || 'Retake this view?',
          [
            { text: t('common.cancel') || 'Cancel', style: 'cancel' },
            {
              text: t('view_checklist.retake') || 'Retake',
              onPress: () =>
                navigation.navigate('CaptureCamera', {
                  viewType: viewDef.key,
                  objectId,
                }),
            },
          ],
        );
        return;
      }
      // Empty slot — capture a new photo for this view
      navigation.navigate('CaptureCamera', { viewType: viewDef.key, objectId });
    },
    [navigation, objectId, getThumbnail, t],
  );

  const handleDone = useCallback(() => {
    navigation.navigate('ObjectDetail', { objectId });
  }, [navigation, objectId]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const titleForSubtitle = objectTitle
    ? inventoryNumber
      ? `${objectTitle} · ${inventoryNumber}`
      : objectTitle
    : null;
  const subtitle = titleForSubtitle
    ? t('view_checklist.subtitle_with_title', { title: titleForSubtitle })
    : t('view_checklist.subtitle_default');

  // Only show the 6 standard views in the grid (exclude detail for now, show as separate button)
  const standardViews = VIEW_TYPES.filter((v) => v.key !== 'detail');
  const detailView = VIEW_TYPES.find((v) => v.key === 'detail')!;
  const capturedCount = capturedViews.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={touch.hitSlop}
          accessibilityLabel={t('common.back')}
        >
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('view_checklist.title')}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress indicator */}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {capturedCount} / {VIEW_TYPES.length}
          </Text>
        </View>

        {/* 6-view grid (2 columns, 3 rows) */}
        <View style={styles.grid}>
          {standardViews.map((viewDef) => {
            const captured = isCaptured(viewDef.key);
            const thumb = getThumbnail(viewDef.key);
            return (
              <Pressable
                key={viewDef.key}
                style={[styles.card, captured && styles.cardCaptured]}
                onPress={() => handleCardPress(viewDef)}
                accessibilityLabel={t(viewDef.labelKey)}
                accessibilityHint={
                  captured ? t('view_checklist.captured') : t('view_checklist.not_captured')
                }
              >
                {captured && thumb ? (
                  <Image source={{ uri: resolveMediaUri(thumb.filePath) }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                  <View style={styles.iconContainer}>
                    <ViewIcon iconName={viewDef.icon} size={28} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.cardLabel}>
                  <Text
                    style={[styles.cardLabelText, captured && styles.cardLabelTextCaptured]}
                    numberOfLines={1}
                  >
                    {t(viewDef.labelKey)}
                  </Text>
                  {captured && (
                    <CheckIcon size={16} color={colors.success} />
                  )}
                </View>
                {!captured && (
                  <View style={styles.cameraHint}>
                    <Camera size={14} color={colors.textTertiary} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Detail photo button */}
        <Pressable
          style={[styles.detailButton, isCaptured('detail') && styles.detailButtonCaptured]}
          onPress={() => handleCardPress(detailView)}
          accessibilityLabel={t('view_checklist.add_detail')}
        >
          <ViewIcon iconName="search" size={20} color={isCaptured('detail') ? colors.accent : colors.textSecondary} />
          <Text style={[styles.detailButtonText, isCaptured('detail') && styles.detailButtonTextCaptured]}>
            {isCaptured('detail') ? t('view_types.detail') : t('view_checklist.add_detail')}
          </Text>
          {isCaptured('detail') && <CheckIcon size={16} color={colors.accent} />}
        </Pressable>
      </ScrollView>

      {/* Done button */}
      <View style={styles.footer}>
        <Pressable
          style={styles.doneButton}
          onPress={handleDone}
          accessibilityLabel={t('view_checklist.done')}
        >
          <Text style={styles.doneButtonText}>{t('view_checklist.done')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const CARD_GAP = spacing.md;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - CARD_GAP) / 2;

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  backButton: {
    width: touch.minTarget,
    height: touch.minTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: c.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  progressRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  progressText: {
    ...typography.label,
    color: c.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    aspectRatio: 1,
    backgroundColor: c.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  cardCaptured: {
    borderStyle: 'solid',
    borderColor: c.success,
    borderWidth: 2,
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg - 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: c.labelOverlay,
  },
  cardLabelText: {
    ...typography.bodySmall,
    color: c.textSecondary,
    textAlign: 'center',
  },
  cardLabelTextCaptured: {
    color: c.success,
    fontWeight: typography.weight.semibold,
  },
  cameraHint: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: c.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: 'dashed',
    minHeight: touch.minTarget,
  },
  detailButtonCaptured: {
    borderStyle: 'solid',
    borderColor: c.accent,
  },
  detailButtonText: {
    ...typography.body,
    color: c.textSecondary,
    flex: 1,
  },
  detailButtonTextCaptured: {
    color: c.accent,
    fontWeight: typography.weight.semibold,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },
  doneButton: {
    backgroundColor: c.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touch.minTarget,
  },
  doneButtonText: {
    ...typography.bodyMedium,
    color: c.textInverse,
  },
}); }
