/* eslint-disable react-native/no-inline-styles, react-native/no-color-literals */
import React, { useCallback, useMemo, useState, type JSX } from 'react';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import {
  Animated as RNAnimated,
  Dimensions,
  Image,
  type ImageStyle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { useSettings } from '../hooks/useSettings';
import {
  CaptureTabIcon,
  ForwardIcon,
  SearchIcon,
  SettingsTabIcon,
  PackageIcon,
  CameraIcon,
} from '../theme/icons';
import {
  ChevronRight,
  FolderPlus,
  FolderOpen,
  AlertCircle,
} from 'lucide-react-native';
import Svg, { Path, Rect, Circle, Polyline, Line } from 'react-native-svg';
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { SkeletonList } from '../components/SkeletonLoader';
import { formatRelativeDate } from '../utils/format-date';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { STANDARD_VIEW_TYPES } from '../constants/viewTypes';
import type { RootStackParamList } from '../navigation/RootStack';
import { ExportStepperModal, type ExportSource } from '../components/ExportStepperModal';
import {
  getAllCollections,
  type CollectionWithCount,
} from '../services/collectionService';

// ── Thumbnail URL resolution ─────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SEED_MEDIA_BASE = `${SUPABASE_URL}/storage/v1/object/public/seed-media/`;

/** Image with onError fallback — shows camera icon when URL fails to load. */
function Thumb({ uri, style, iconSize = 16, fallbackColor }: { uri: string; style: ImageStyle; iconSize?: number; fallbackColor: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <CameraIcon size={iconSize} color={fallbackColor} />;
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface DashboardObject {
  id: string;
  title: string;
  description: string | null;
  object_type: string;
  created_at: string;
  file_path: string | null;
  storage_path: string | null;
  view_count: number;
  has_ai: number;
  sync_pending: number;
  in_collection: number;
}

interface Stats { totalObjects: number; totalPhotos: number; storageBytes: number }

// ── Constants ─────────────────────────────────────────────────────────────────

const STANDARD_VIEW_KEYS = STANDARD_VIEW_TYPES.map((v) => v.key);
const TOTAL_STANDARD_VIEWS = STANDARD_VIEW_KEYS.length;
const SCREEN_W = Dimensions.get('window').width;
const PX = 20; // horizontal padding
const ITEM_GAP = 12;
const SEC_GAP = 40;
const R = 14; // border radius
const TOOL_W = (SCREEN_W - PX * 2 - ITEM_GAP * 3) / 4; // exact quarter-width for 4-col grid

const TOOLS = [
  { label: 'Floor Map', nav: 'FloorMap' as const },
  { label: 'QR Codes', nav: 'ObjectList' as const },
  { label: 'Checklists', nav: 'ChecklistOverview' as const },
  { label: 'Export', nav: 'ObjectList' as const },
  { label: '3D Scan', nav: 'Scan3D' as const },
  { label: 'Browse', nav: 'ObjectList' as const },
  { label: 'AI Analysis', nav: 'CaptureCamera' as const },
  { label: 'Scan Doc', nav: 'CaptureCamera' as const },
] as const;

// Custom SVG tool icons (26x26 viewBox, stroke-based)
function ToolSvgIcon({ index, color }: { index: number; color: string }) {
  const p = { stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const icons = [
    // Floor Map: folded map
    <Svg key="0" width={26} height={26} viewBox="0 0 24 24"><Polyline points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" {...p} /><Line x1={9} y1={3} x2={9} y2={18} {...p} /><Line x1={15} y1={6} x2={15} y2={21} {...p} /></Svg>,
    // QR Code: corner squares
    <Svg key="1" width={26} height={26} viewBox="0 0 24 24"><Rect x={3} y={3} width={7} height={7} rx={1} {...p} /><Rect x={14} y={3} width={7} height={7} rx={1} {...p} /><Rect x={3} y={14} width={7} height={7} rx={1} {...p} /><Rect x={6} y={6} width={1} height={1} fill={color} stroke="none" /><Rect x={17} y={6} width={1} height={1} fill={color} stroke="none" /><Rect x={6} y={17} width={1} height={1} fill={color} stroke="none" /><Path d="M14 14h3v3h-3zM20 14v3h-3M14 20h3" {...p} /></Svg>,
    // Checklist: circle with check
    <Svg key="2" width={26} height={26} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={9} {...p} /><Path d="M9 12l2 2 4-4" {...p} /></Svg>,
    // Export: download tray
    <Svg key="3" width={26} height={26} viewBox="0 0 24 24"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" {...p} /></Svg>,
    // 3D Scan: stacked layers
    <Svg key="4" width={26} height={26} viewBox="0 0 24 24"><Path d="M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5" {...p} /></Svg>,
    // Browse: 4 squares grid
    <Svg key="5" width={26} height={26} viewBox="0 0 24 24"><Rect x={3} y={3} width={7} height={7} rx={2} {...p} /><Rect x={14} y={3} width={7} height={7} rx={2} {...p} /><Rect x={3} y={14} width={7} height={7} rx={2} {...p} /><Rect x={14} y={14} width={7} height={7} rx={2} {...p} /></Svg>,
    // AI: sparkle
    <Svg key="6" width={26} height={26} viewBox="0 0 24 24"><Path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M16.24 16.24l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M16.24 7.76l1.41-1.41" {...p} /><Circle cx={12} cy={12} r={4} {...p} /></Svg>,
    // Document scan
    <Svg key="7" width={26} height={26} viewBox="0 0 24 24"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" {...p} /><Path d="M14 2v6h6M8 13h8M8 17h5" {...p} /></Svg>,
  ];
  return icons[index] ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '\u2014';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isComplete(obj: DashboardObject): boolean {
  return obj.view_count >= TOTAL_STANDARD_VIEWS && obj.has_ai === 1 && obj.sync_pending === 0;
}

// ── Wordmark SVG (horizontal logo for header) ──────────────────────────────

function WordmarkLogo({ width = 130, fill }: { width?: number; fill: string }) {
  const h = Math.round(width * (38 / 196));
  return (
    <Svg width={width} height={h} viewBox="0 0 196 38">
      <Path d="M85.245,10.245h7.8c3.81,0,3.81,2.55,3.81,4.5v2.28c0,2.7-.84,3.18-2.729,3.6.93.24,2.88.81,2.88,3.66v4.319c0,1.08.09,2.19.9,2.851h-4.29c-.45-.811-.57-1.71-.57-2.34v-4.53c0-1.439,0-2.46-2.04-2.46h-1.859v9.33h-3.9V10.245ZM89.145,19.094h2.04c1.77,0,1.8-.96,1.8-2.04v-2.01c0-1.74-.931-1.74-1.8-1.74h-2.04v5.79Z" fill={fill} />
      <Path d="M100.695,10.245h10.26v3.24h-6.36v4.98h5.97v3.209h-5.97v6.51h6.63v3.271h-10.529V10.245Z" fill={fill} />
      <Path d="M121.874,17.115v-2.01c0-1.05,0-2.22-1.83-2.22-1.979,0-1.979,1.59-1.979,2.73v11.16c0,1.409.479,2.13,1.859,2.13,1.95,0,1.95-1.44,1.95-2.46v-3.3h-2.43v-3.181h6.329v11.49h-3.329v-1.26c-.57.63-1.5,1.71-3.75,1.71-1.89,0-4.59-.811-4.59-4.32v-12.06c0-2.13.18-5.7,6.029-5.7.96,0,2.79.15,4.05.96,1.2.78,1.59,1.92,1.59,3.24v3.09h-3.899Z" fill={fill} />
      <Path d="M129.914,10.275h3.869v21.18h-3.869V10.275Z" fill={fill} />
      <Path d="M137.503,23.985h3.899v2.46c0,1.229,0,2.46,1.89,2.46,1.92,0,1.92-1.261,1.92-3.15,0-1.5-.3-2.13-1.319-2.819l-3.72-2.491c-1.98-1.35-2.521-2.82-2.521-4.979,0-1.65.15-3.24,1.53-4.38.78-.66,2.22-1.26,4.26-1.26,2.28,0,5.399.93,5.399,4.56v2.1h-3.869v-1.53c0-1.02,0-2.16-1.71-2.16-1.051,0-1.801.39-1.801,2.1,0,1.77.391,2.16,1.23,2.73l3.84,2.61c.75.54,1.56,1.29,2.01,2.071.57.96.57,1.619.57,3.329,0,1.891,0,3.061-.69,4.17-1.17,1.891-3.6,2.101-5.04,2.101-3.329,0-5.879-1.261-5.879-4.83v-3.09Z" fill={fill} />
      <Path d="M150.163,10.275h11.729v3.06h-3.899v18.12h-3.93V13.335h-3.9v-3.06Z" fill={fill} />
      <Path d="M163.483,10.245h10.26v3.24h-6.36v4.98h5.97v3.209h-5.97v6.51h6.63v3.271h-10.529V10.245Z" fill={fill} />
      <Path d="M177.252,10.245h7.8c3.81,0,3.81,2.55,3.81,4.5v2.28c0,2.7-.84,3.18-2.73,3.6.931.24,2.88.81,2.88,3.66v4.319c0,1.08.091,2.19.9,2.851h-4.29c-.45-.811-.569-1.71-.569-2.34v-4.53c0-1.439,0-2.46-2.04-2.46h-1.86v9.33h-3.899V10.245ZM181.152,19.094h2.04c1.77,0,1.8-.96,1.8-2.04v-2.01c0-1.74-.93-1.74-1.8-1.74h-2.04v5.79Z" fill={fill} />
      <Path d="M20.703,29.259c-.036.288-.107.576-.107.863,0,.864.252,1.044.539,1.332h-6.551l.504-2.016c-1.296,1.116-2.916,2.52-5.184,2.52-.396,0-3.815,0-3.815-3.491,0-1.188.756-4.571,1.944-5.939,1.188-1.368,2.915-1.872,9.646-3.815.18-.756.432-1.98.432-2.268,0-1.008-.936-1.08-1.548-1.08-1.619,0-1.907.864-2.447,2.808h-5.472c.828-3.348,1.26-4.463,3.023-5.363,1.332-.684,3.168-1.008,5.184-1.008,3.312,0,6.731.828,6.731,4.211,0,.72-.145,1.439-.324,2.16l-2.556,11.087ZM16.851,22.42c-1.296.396-2.951.899-3.636,1.439-.936.756-1.188,2.808-1.188,3.168,0,.647.288,1.188,1.26,1.188,1.008,0,1.764-.612,2.376-1.152l1.188-4.643Z" fill={fill} />
      <Path d="M34.958,6.042l-1.943,8.315c.864-1.044,2.231-2.52,4.715-2.52,1.98,0,3.96.972,3.96,3.636,0,.54-.108,1.116-.216,1.656l-3.312,14.326h-5.688l3.132-13.57c.071-.288.107-.576.107-.864,0-1.08-.756-1.512-1.512-1.512-1.439,0-1.728,1.152-1.871,1.764l-3.24,14.182h-5.723l5.867-25.413h5.723Z" fill={fill} />
      <Path d="M55.947,29.259c-.036.288-.108.576-.108.863,0,.864.252,1.044.54,1.332h-6.551l.504-2.016c-1.296,1.116-2.916,2.52-5.184,2.52-.396,0-3.815,0-3.815-3.491,0-1.188.756-4.571,1.943-5.939s2.916-1.872,9.646-3.815c.181-.756.433-1.98.433-2.268,0-1.008-.937-1.08-1.548-1.08-1.62,0-1.908.864-2.448,2.808h-5.471c.827-3.348,1.26-4.463,3.023-5.363,1.332-.684,3.168-1.008,5.184-1.008,3.312,0,6.73.828,6.73,4.211,0,.72-.144,1.439-.323,2.16l-2.556,11.087ZM52.095,22.42c-1.296.396-2.952.899-3.636,1.439-.936.756-1.188,2.808-1.188,3.168,0,.647.287,1.188,1.26,1.188,1.008,0,1.764-.612,2.375-1.152l1.188-4.643Z" fill={fill} />
      <Path d="M61.419,25.984h5.327l-1.26,5.471h-5.327l1.26-5.471ZM71.354,6.042l-1.079,4.607-3.924,12.562h-3.275l1.764-12.238,1.188-4.931h5.327Z" fill={fill} />
    </Svg>
  );
}

// ── Press animation wrapper ─────────────────────────────────────────────────

function PressScale({ children, onPress, style, ...rest }: React.ComponentProps<typeof Pressable>) {
  const [scale] = useState(() => new RNAnimated.Value(1));
  return (
    <RNAnimated.View style={{ transform: [{ scale }] }}>
      <Pressable
        {...rest}
        style={style}
        onPressIn={() => RNAnimated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8, tension: 200 }).start()}
        onPressOut={() => RNAnimated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 200 }).start()}
        onPress={onPress}
      >
        {children}
      </Pressable>
    </RNAnimated.View>
  );
}

// (SectionLabel, ViewProgressBar, AttentionRow, CompactRow moved inside HomeScreen for theme access)

function getAttentionInfo(obj: DashboardObject): { reason: string; urgency: number } {
  if (obj.view_count < 3) return { reason: 'Needs photography', urgency: 3 };
  if (!obj.description) return { reason: 'Incomplete documentation', urgency: 2 };
  if (obj.has_ai === 0) return { reason: 'Needs review', urgency: 2 };
  return { reason: 'Needs review', urgency: 2 };
}

// ── Main component ──────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const HEADER_TEXT = colors.white;
  const TOOL_COLOR = colors.textSecondary;

  const db = useDatabase();
  const { t } = useAppTranslation();
  const { collectionDomain } = useSettings();
  const syncStatus = useSyncStatus();

  const insets = useSafeAreaInsets();
  const HEADER_H = insets.top + 56; // safe area + header content

  // ── Sub-components (need access to theme-derived `st` and `colors`) ──

  function SectionLabel({ text, extra, badge, right }: { text: string; extra?: string; badge?: number; right?: React.ReactNode }): JSX.Element {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={st.secLabel}>{text}</Text>
          {extra && <Text style={st.secLabelExtra}>{extra}</Text>}
          {badge != null && (
            <View style={st.sectionBadge}>
              <AlertCircle size={14} color="#D97706" />
              <Text style={st.sectionBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {right}
      </View>
    );
  }

  function ViewProgressBar({ count, total = TOTAL_STANDARD_VIEWS, size = 'normal' }: { count: number; total?: number; size?: 'normal' | 'compact' }): JSX.Element {
    const w = size === 'compact' ? 10 : 16;
    const h = size === 'compact' ? 4 : 5;
    return (
      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ width: w, height: h, borderRadius: 99, backgroundColor: i < count ? colors.textMuted : colors.border }} />
        ))}
        <Text style={{ fontSize: size === 'compact' ? 10 : 11, color: colors.textSecondary, marginLeft: 4, fontWeight: typography.weight.medium }}>
          {count}/{total}
        </Text>
      </View>
    );
  }

  function AttentionRow({ obj, onPress }: { obj: DashboardObject; onPress: () => void }): JSX.Element {
    const { reason, urgency } = getAttentionInfo(obj);
    return (
      <PressScale style={st.attentionRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={obj.title}>
        <View style={obj.file_path ? st.attentionThumb : [st.attentionThumb, st.thumbEmpty]}>
          {obj.file_path ? (
            <Thumb uri={obj.file_path} style={[StyleSheet.absoluteFill, { borderRadius: 10 }] as ImageStyle} iconSize={16} fallbackColor={colors.textTertiary} />
          ) : (
            <CameraIcon size={16} color={colors.textTertiary} />
          )}
        </View>
        <View style={st.attentionInfo}>
          <Text style={st.attentionTitle} numberOfLines={1}>{obj.title || 'Untitled'}</Text>
          <View style={st.attentionReasonRow}>
            <View style={st.attentionDots}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[st.attentionDot, i > urgency && st.attentionDotEmpty]} />
              ))}
            </View>
            <Text style={st.attentionReasonText}>{reason}</Text>
          </View>
        </View>
        <AlertCircle size={20} color="#D97706" />
      </PressScale>
    );
  }

  function CompactRow({ obj, onPress }: { obj: DashboardObject; onPress: () => void }): JSX.Element {
    return (
      <PressScale style={st.compactRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={obj.title}>
        <View style={obj.file_path ? st.compactThumb : [st.compactThumb, st.thumbEmpty]}>
          {obj.file_path ? (
            <Thumb uri={obj.file_path} style={[StyleSheet.absoluteFill, { borderRadius: 8 }] as ImageStyle} iconSize={14} fallbackColor={colors.textTertiary} />
          ) : (
            <CameraIcon size={14} color={colors.textTertiary} />
          )}
        </View>
        <View style={st.compactInfo}>
          <Text style={st.compactTitle} numberOfLines={1}>{obj.title || 'Untitled'}</Text>
          <View style={st.compactMeta}>
            <ViewProgressBar count={obj.view_count} size="compact" />
            <Text style={st.compactTime}>{formatRelativeDate(obj.created_at)}</Text>
          </View>
        </View>
        <ChevronRight size={16} color={colors.textTertiary} />
      </PressScale>
    );
  }

  const [stats, setStats] = useState<Stats>({ totalObjects: 0, totalPhotos: 0, storageBytes: 0 });
  const [objects, setObjects] = useState<DashboardObject[]>([]);
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportSource, setExportSource] = useState<ExportSource | null>(null);
  const [showExport, setShowExport] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_mapPinCount, setMapPinCount] = useState(0);
  const [freeSpace, setFreeSpace] = useState<number | null>(null);

  const viewTypeList = STANDARD_VIEW_KEYS.map((k) => `'${k}'`).join(',');

  const loadData = useCallback(async () => {
    try {
      // Batch-repair dead local file_paths → Supabase Storage public URLs.
      // Only repairs seed-media paths (non-UUID prefix like stadtmuseum/, vera/).
      // The media bucket is private so UUID-prefixed paths can't use public URLs.
      await db.runAsync(
        `UPDATE media SET file_path = ? || storage_path
         WHERE file_path NOT LIKE 'http%'
           AND storage_path IS NOT NULL
           AND storage_path != ''
           AND storage_path NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-*'`,
        [SEED_MEDIA_BASE],
      );

      const [totalRow, photoRow, storageRow, objRows, collRows] = await Promise.all([
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM objects'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM media'),
        db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(file_size), 0) as total FROM media'),
        db.getAllAsync<DashboardObject>(
          `SELECT o.id, o.title, o.description, o.object_type, o.created_at, pm.file_path, pm.storage_path,
             COALESCE(vc.view_count, 0) as view_count,
             CASE WHEN o.description IS NOT NULL AND o.description != '' AND o.title IS NOT NULL AND o.title != 'Untitled' AND o.title != '' THEN 1 ELSE 0 END as has_ai,
             CASE WHEN sq.id IS NOT NULL THEN 1 ELSE 0 END as sync_pending,
             CASE WHEN oc.id IS NOT NULL THEN 1 ELSE 0 END as in_collection
           FROM objects o
           LEFT JOIN media pm ON pm.object_id = o.id AND pm.is_primary = 1
           LEFT JOIN (SELECT object_id, COUNT(DISTINCT view_type) as view_count FROM media WHERE view_type IN (${viewTypeList}) GROUP BY object_id) vc ON vc.object_id = o.id
           LEFT JOIN sync_queue sq ON sq.record_id = o.id AND sq.status IN ('pending', 'syncing')
           LEFT JOIN object_collections oc ON oc.object_id = o.id
           GROUP BY o.id ORDER BY o.created_at DESC`,
        ),
        getAllCollections(db),
      ]);
      setStats({ totalObjects: totalRow?.count ?? 0, totalPhotos: photoRow?.count ?? 0, storageBytes: storageRow?.total ?? 0 });
      setObjects(objRows);
      setCollections(collRows);
      try { const r = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM map_pins WHERE object_id IS NOT NULL'); setMapPinCount(r?.c ?? 0); } catch { /* table may not exist */ }
    } catch { /* silently ignore */ } finally { setLoading(false); }
  }, [db, viewTypeList]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
    FileSystem.getFreeDiskStorageAsync().then((f) => setFreeSpace(f)).catch(() => {});
  }, [loadData]));

  const { needsAttention, complete } = useMemo(() => {
    const needs: DashboardObject[] = []; const done: DashboardObject[] = [];
    for (const obj of objects) (isComplete(obj) ? done : needs).push(obj);
    return { needsAttention: needs, complete: done };
  }, [objects]);

  const unfiled = useMemo(() => objects.filter((o) => o.in_collection === 0), [objects]);

  // Sync status styling
  const syncState = syncStatus.status; // 'idle' | 'syncing' | 'offline' | 'error'
  const syncColor = syncState === 'error' || syncState === 'offline' ? '#C53030'
    : syncState === 'syncing' ? '#D97706' : '#0F766E';
  const syncBg = syncState === 'error' || syncState === 'offline' ? 'rgba(197, 48, 48, 0.1)'
    : syncState === 'syncing' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(15, 118, 110, 0.1)';
  const syncBorder = syncState === 'error' || syncState === 'offline' ? 'rgba(197, 48, 48, 0.3)'
    : syncState === 'syncing' ? 'rgba(217, 119, 6, 0.3)' : 'rgba(15, 118, 110, 0.3)';
  const syncLabel = syncState === 'syncing' ? 'Syncing...'
    : syncState === 'offline' ? 'Offline'
    : syncState === 'error' ? 'Sync failed'
    : syncStatus.pendingCount > 0 ? `Sync: ${syncStatus.pendingCount} pending`
    : 'Sync: all up to date';

  // Storage warning level
  const GB = 1024 * 1024 * 1024;
  const storageWarn = freeSpace != null && freeSpace < 500 * 1024 * 1024 ? 'critical'
    : freeSpace != null && freeSpace < GB ? 'warning' : 'normal';

  return (
    <View style={st.safe}>
      {/* ── Glassmorphism header (absolute, content scrolls underneath) ── */}
      <BlurView intensity={80} tint="dark" style={[st.headerBlur, { height: HEADER_H, paddingTop: insets.top }]}>
        <View style={st.headerInner}>
          <View>
            <WordmarkLogo width={110} fill={colors.white} />
            <Text style={st.headerSubtitle}>{t(`home.domain_subtitle.${collectionDomain}`)}</Text>
          </View>
          <View style={st.headerActions}>
            <Pressable style={st.headerBtn} onPress={() => navigation.navigate('ObjectList')} accessibilityLabel={t('common.search')} hitSlop={touch.hitSlop}>
              <SearchIcon size={18} color={HEADER_TEXT} />
            </Pressable>
            <Pressable style={st.headerBtn} onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings" hitSlop={touch.hitSlop}>
              <SettingsTabIcon size={18} color={HEADER_TEXT} />
            </Pressable>
          </View>
        </View>
      </BlurView>

      <ScrollView style={st.scroll} contentContainerStyle={[st.scrollContent, { paddingTop: HEADER_H + 20 }]} showsVerticalScrollIndicator={false}>

        {/* ═══ 1. CAPTURE CTA ═══ */}
        <View style={st.section}>
          <PressScale
            style={st.cta}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('QuickID'); }}
            accessibilityLabel={t('home.captureCtaTitle')}
          >
            <View style={st.ctaIcon}><CaptureTabIcon size={32} color={colors.white} /></View>
            <View style={st.ctaText}>
              <Text style={st.ctaTitle}>{t('home.captureCtaTitle')}</Text>
              <Text style={st.ctaSub}>{t('home.captureCtaSubtitle')}</Text>
            </View>
            <ForwardIcon size={20} color="rgba(255,255,255,0.5)" />
          </PressScale>
        </View>

        {/* ═══ 2. COLLECTIONS ═══ */}
        {collections.length > 0 && (
          <View style={[st.section, { paddingHorizontal: 0 }]}>
            <View style={{ paddingHorizontal: PX }}>
              <SectionLabel text="Collections" right={
                <Pressable onPress={() => navigation.navigate('CollectionList')} hitSlop={touch.hitSlop} style={st.viewAll}>
                  <Text style={st.viewAllText}>See all</Text>
                </Pressable>
              } />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PX, gap: ITEM_GAP }}>
              {collections.map((col) => (
                <PressScale key={col.id} style={st.colCard} onPress={() => navigation.navigate('CollectionDetail', { collectionId: col.id })}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={st.colName} numberOfLines={1}>{col.name}</Text>
                      <Text style={st.colSub}>{col.objectCount} objects</Text>
                    </View>
                    <View style={{ backgroundColor: '#2A2A2A', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: typography.weight.medium, color: colors.textMuted }}>{Math.round(Math.min((col.objectCount / 8) * 100, 100))}%</Text>
                    </View>
                  </View>
                  <View style={{ height: 2, borderRadius: 1, backgroundColor: '#2A2A2A' }}>
                    <View style={{ height: 2, borderRadius: 1, backgroundColor: '#666666', width: `${Math.min((col.objectCount / 8) * 100, 100)}%` }} />
                  </View>
                </PressScale>
              ))}
            </ScrollView>
            {/* Quick actions below collections */}
            <View style={{ flexDirection: 'row', gap: ITEM_GAP, paddingHorizontal: PX, marginTop: 40 }}>
              <View style={{ flex: 1 }}>
                <PressScale style={st.quickBtn} onPress={() => navigation.navigate('CreateCollection')}>
                  <View style={st.quickBtnIcon}><FolderPlus size={24} color={colors.textSecondary} /></View>
                  <Text style={st.quickBtnText}>New collection</Text>
                </PressScale>
              </View>
              <View style={{ flex: 1 }}>
                <PressScale style={st.quickBtn} onPress={() => navigation.navigate('CollectionList')}>
                  <View style={st.quickBtnIcon}><FolderOpen size={24} color={colors.textSecondary} /></View>
                  <Text style={st.quickBtnText}>Add to existing</Text>
                </PressScale>
              </View>
            </View>
          </View>
        )}

        {/* ═══ 3. RECENT (UNFILED) ═══ */}
        {!loading && unfiled.length > 0 && (
          <View style={[st.section, { paddingHorizontal: 0 }]}>
            <View style={{ paddingHorizontal: PX }}><SectionLabel text="Recent" extra="(unfiled)" /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PX, gap: ITEM_GAP }}>
              {unfiled.slice(0, 10).map((item) => (
                <PressScale key={item.id} style={st.recentCard} onPress={() => navigation.navigate('ObjectDetail', { objectId: item.id })} accessibilityLabel={item.title || 'Untitled'}>
                  {item.file_path ? (
                    <Thumb uri={item.file_path} style={{ width: '100%', height: '100%' } as ImageStyle} iconSize={22} fallbackColor={colors.textTertiary} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, st.thumbEmpty]}><CameraIcon size={22} color={colors.textTertiary} /></View>
                  )}
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                  <Text style={st.recentTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                </PressScale>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ═══ 4. NEEDS ATTENTION ═══ */}
        {loading ? (
          <View style={st.section}><SkeletonList count={3} /></View>
        ) : objects.length === 0 ? (
          <View style={st.section}>
            <View style={st.emptyCard}>
              <PackageIcon size={32} color={colors.textTertiary} />
              <Text style={st.emptyTitle}>{t('home.emptyTitle')}</Text>
              <Text style={st.emptyMsg}>{t('home.emptyMessage')}</Text>
            </View>
          </View>
        ) : (
          <>
            {needsAttention.length > 0 && (
              <View style={st.section}>
                <SectionLabel text="Needs attention" badge={needsAttention.length} right={
                  needsAttention.length > 4 ? (
                    <Pressable onPress={() => navigation.navigate('ObjectList')} hitSlop={touch.hitSlop} style={st.viewAll}>
                      <Text style={st.viewAllText}>View all ({needsAttention.length})</Text>
                    </Pressable>
                  ) : undefined
                } />
                <View>
                  {needsAttention.slice(0, 4).map((obj) => (
                    <AttentionRow key={obj.id} obj={obj} onPress={() => navigation.navigate('ObjectDetail', { objectId: obj.id })} />
                  ))}
                </View>
              </View>
            )}

            {complete.length > 0 && (
              <View style={st.section}>
                <SectionLabel text="Complete" right={
                  complete.length > 5 ? (
                    <Pressable onPress={() => navigation.navigate('ObjectList')} hitSlop={touch.hitSlop} style={st.viewAll}>
                      <Text style={st.viewAllText}>See all</Text>
                    </Pressable>
                  ) : undefined
                } />
                {complete.slice(0, 5).map((obj) => (
                  <CompactRow key={obj.id} obj={obj} onPress={() => navigation.navigate('ObjectDetail', { objectId: obj.id })} />
                ))}
              </View>
            )}
          </>
        )}

        {/* ═══ 6. TOOLS (4-column grid) ═══ */}
        <View style={st.section}>
          <SectionLabel text="Tools" />
          <View style={st.toolGrid}>
            {TOOLS.map((tool, i) => (
              <PressScale key={tool.label} style={[st.toolCell, { width: TOOL_W }]} onPress={() => navigation.navigate(tool.nav)} accessibilityLabel={tool.label}>
                <View style={[st.toolCellIcon, { backgroundColor: colors.surfaceContainer }]}>
                  <ToolSvgIcon index={i} color={TOOL_COLOR} />
                </View>
                <Text style={st.toolCellLabel}>{tool.label}</Text>
              </PressScale>
            ))}
          </View>
        </View>

        {/* ═══ 7. STATUS ═══ */}
        <View style={st.section}>
          <SectionLabel text="Status" />
          <View style={st.statsGrid}>
            <View style={st.statCard}>
              <Text style={st.statValue}>{stats.totalObjects}</Text>
              <Text style={st.statLabel}>{t('home.statObjects')}</Text>
            </View>
            <View style={st.statCard}>
              <Text style={st.statValue}>{stats.totalPhotos}</Text>
              <Text style={st.statLabel}>{t('home.statPhotos')}</Text>
            </View>
            <View style={[st.statCard, storageWarn !== 'normal' && { borderColor: storageWarn === 'critical' ? '#C53030' : '#D97706' }]}>
              <Text style={[st.statValue, storageWarn !== 'normal' && { color: storageWarn === 'critical' ? '#C53030' : '#D97706' }]}>{formatStorageSize(stats.storageBytes)}</Text>
              <Text style={st.statLabel}>{t('home.statStorage')}</Text>
            </View>
          </View>
          <View style={[st.syncBar, { backgroundColor: syncBg, borderColor: syncBorder }]}>
            <View style={[st.syncDot, { backgroundColor: syncColor }]} />
            <Text style={[st.syncText, { color: syncColor }]}>{syncLabel}</Text>
          </View>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <ExportStepperModal visible={showExport} onClose={() => { setShowExport(false); setExportSource(null); }} source={exportSource} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingTop: 16, paddingBottom: 40 },

    // Header — glassmorphism blur
    headerBlur: {
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      backgroundColor: 'rgba(10, 10, 10, 0.75)',
    },
    headerInner: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: PX, paddingBottom: 8,
    },
    headerSubtitle: {
      fontSize: 12, fontWeight: typography.weight.regular, color: colors.textSecondary, marginTop: 2,
    },
    headerActions: { flexDirection: 'row', gap: 10 },
    headerBtn: {
      width: 38, height: 38, borderRadius: 19, backgroundColor: 'transparent',
      borderWidth: 1, borderColor: colors.white + '40', alignItems: 'center', justifyContent: 'center',
      minWidth: touch.minTarget, minHeight: touch.minTarget,
    },

    // Section
    section: { paddingHorizontal: PX, marginBottom: SEC_GAP },
    secLabel: { fontSize: 16, fontWeight: typography.weight.bold, color: colors.text },
    secLabelExtra: { fontSize: 13, color: colors.textTertiary },
    sectionBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8,
      backgroundColor: 'rgba(217, 119, 6, 0.15)', borderWidth: 1, borderColor: '#D97706',
      paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12,
    },
    sectionBadgeText: { fontSize: 12, fontWeight: typography.weight.semibold, color: '#D97706' },
    viewAll: { minHeight: touch.minTarget, justifyContent: 'center' },
    viewAllText: { fontSize: 13, fontWeight: typography.weight.medium, color: colors.textSecondary },

    // CTA (96px)
    cta: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
      height: 96, backgroundColor: colors.heroGreen, borderRadius: R, borderWidth: 1, borderColor: '#3D7A35', marginBottom: ITEM_GAP,
    },
    ctaIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    ctaText: { flex: 1, marginLeft: 14 },
    ctaTitle: { fontSize: 20, fontWeight: typography.weight.bold, color: colors.white },
    ctaSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

    // Quick buttons (100px, vertical layout)
    quickRow: { flexDirection: 'row', gap: ITEM_GAP },
    quickBtn: {
      width: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surfaceElevated, borderRadius: R, borderWidth: 1,
      borderColor: '#3A3A3A', height: 100,
    },
    quickBtnIcon: { alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    quickBtnText: { fontSize: 14, fontWeight: typography.weight.medium, color: colors.text, textAlign: 'center' },

    // Collection cards (170x100 with progress)
    colCard: {
      width: 220, height: 100, backgroundColor: colors.surfaceElevated, borderRadius: R,
      borderWidth: 1, borderColor: '#3A3A3A', padding: 14, justifyContent: 'space-between',
    },
    colName: { fontSize: 16, fontWeight: typography.weight.bold, color: colors.text },
    colSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
    colProgress: { fontSize: 10, color: colors.textTertiary, textAlign: 'right', marginTop: 3 },

    // Recent (unfiled) — 140x140 square photo-fill
    recentCard: {
      width: 140, height: 140, borderRadius: R, borderWidth: 1, borderColor: '#3A3A3A',
      overflow: 'hidden', backgroundColor: colors.surface,
    },
    thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    recentTitle: { position: 'absolute', bottom: 6, left: 8, right: 8, fontSize: 11, fontWeight: typography.weight.semibold, color: colors.white, zIndex: 2 },

    // Empty
    emptyCard: {
      alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
      backgroundColor: colors.surfaceElevated, borderRadius: R, borderWidth: 1, borderColor: '#3A3A3A',
    },
    emptyTitle: { fontSize: 14, fontWeight: typography.weight.medium, color: colors.text, marginTop: spacing.sm },
    emptyMsg: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

    // AttentionRow (vertical list)
    attentionRow: {
      flexDirection: 'row', alignItems: 'center', minHeight: 88,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: '#3A3A3A',
      borderRadius: 12, paddingHorizontal: 12, marginBottom: 10,
    },
    attentionThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
    attentionInfo: { flex: 1, marginLeft: 12 },
    attentionTitle: { fontSize: 15, fontWeight: typography.weight.semibold, color: colors.text },
    attentionReasonRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    attentionDots: { flexDirection: 'row', gap: 4 },
    attentionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706' },
    attentionDotEmpty: { backgroundColor: '#3A3A3A' },
    attentionReasonText: { fontSize: 12, color: colors.textSecondary, marginLeft: 8 },

    // ActionCard (2-col grid, photo 100px top)
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ITEM_GAP },
    actionCard: {
      backgroundColor: colors.surfaceElevated, borderRadius: R,
      borderWidth: 1, borderColor: '#3A3A3A', overflow: 'hidden',
    },
    actionPhotoTop: { width: '100%', height: 120, backgroundColor: colors.surface },
    actionInfo: { padding: 10, gap: 4 },
    actionTitle: { fontSize: 13, fontWeight: typography.weight.bold, color: colors.text },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    pill: { borderRadius: radii.full, paddingHorizontal: 6, paddingVertical: 2 },
    pillAmber: { backgroundColor: colors.surfaceContainer },
    pillGreen: { backgroundColor: colors.successLight },
    pillText: { fontSize: 10, fontWeight: typography.weight.semibold },
    pillTextAmber: { color: colors.textSecondary },
    pillTextGreen: { color: colors.success },

    // CompactRow (52px)
    compactRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated,
      borderWidth: 1, borderColor: '#3A3A3A', borderRadius: R,
      paddingHorizontal: 14, height: 52, marginBottom: 8, gap: 10,
    },
    compactThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface, overflow: 'hidden' },
    compactInfo: { flex: 1 },
    compactTitle: { fontSize: 13, fontWeight: typography.weight.medium, color: colors.text },
    compactMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    compactTime: { fontSize: 10, color: colors.textTertiary },

    // Tools (4-column grid, 88px tall)
    toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ITEM_GAP },
    toolCell: {
      height: 88, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surfaceElevated, borderRadius: R,
      borderWidth: 1, borderColor: '#3A3A3A',
    },
    toolCellIcon: {
      width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
      marginBottom: 6,
    },
    toolCellLabel: { fontSize: 10.5, fontWeight: typography.weight.semibold, color: colors.text, textAlign: 'center' },

    // Stats (52px)
    statsGrid: { flexDirection: 'row', gap: ITEM_GAP, marginBottom: ITEM_GAP },
    statCard: {
      flex: 1, alignItems: 'center', justifyContent: 'center', height: 52,
      backgroundColor: colors.surfaceElevated, borderRadius: R, borderWidth: 1, borderColor: '#3A3A3A',
    },
    statValue: { fontSize: 17, fontWeight: typography.weight.bold, color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary },

    // Sync (44px)
    syncBar: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated,
      borderRadius: R, borderWidth: 1, borderColor: '#3A3A3A',
      paddingHorizontal: 16, paddingVertical: 16, marginTop: 12, gap: 8,
    },
    syncDot: { width: 8, height: 8, borderRadius: 4 },
    syncText: { fontSize: 12, color: colors.textSecondary },

    // Badge (kept for compatibility)
    countBadge: { backgroundColor: colors.warning, borderRadius: radii.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    countBadgeText: { fontSize: 11, fontWeight: typography.weight.bold, color: colors.white },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  });
}
