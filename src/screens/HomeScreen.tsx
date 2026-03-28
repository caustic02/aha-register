import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Alert,
  Animated as RNAnimated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// LinearGradient replaced with pure JS overlay (no native module needed)
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  CaptureTabIcon,
  ForwardIcon,
  SearchIcon,
  SettingsTabIcon,
  PackageIcon,
  CameraIcon,
  ExportIcon,
} from '../theme/icons';
import {
  ChevronRight,
  QrCode,
  Map as MapIcon,
  Box as BoxIcon,
  CheckCircle,
  FolderPlus,
  FolderOpen,
  Search,
  Sparkles,
  ScanLine,
  FileDown,
  Layers,
} from 'lucide-react-native';
import Svg, { Path, Rect, Circle, Polyline, Line } from 'react-native-svg';
import { colors, radii, spacing, touch, typography } from '../theme';
import { SkeletonList } from '../components/SkeletonLoader';
import { formatRelativeDate } from '../utils/format-date';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { STANDARD_VIEW_TYPES } from '../constants/viewTypes';
import type { RootStackParamList } from '../navigation/RootStack';
import { ExportStepperModal, type ExportSource } from '../components/ExportStepperModal';
import type { RegisterObject, Media } from '../db/types';
import {
  getAllCollections,
  type CollectionWithCount,
} from '../services/collectionService';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface DashboardObject {
  id: string;
  title: string;
  description: string | null;
  object_type: string;
  created_at: string;
  file_path: string | null;
  view_count: number;
  has_ai: number;
  sync_pending: number;
  in_collection: number;
}

interface Stats { totalObjects: number; totalPhotos: number; storageBytes: number }

// ── Constants ─────────────────────────────────────────────────────────────────

const NAVY = '#2B3A4E';
const CREAM = '#F5F2EB';
const STANDARD_VIEW_KEYS = STANDARD_VIEW_TYPES.map((v) => v.key);
const TOTAL_STANDARD_VIEWS = STANDARD_VIEW_KEYS.length;
const SCREEN_W = Dimensions.get('window').width;
const PX = 20; // horizontal padding
const ITEM_GAP = 12;
const SEC_GAP = 24;
const R = 14; // border radius
const CARD_W = (SCREEN_W - PX * 2 - ITEM_GAP) / 2; // exact half-width for 2-col grid
const TOOL_W = (SCREEN_W - PX * 2 - ITEM_GAP * 3) / 4; // exact quarter-width for 4-col grid

// Tool definitions with distinct muted colors
const TOOLS = [
  { label: 'Floor Map', color: '#7B6B4A', nav: 'FloorMap' as const },
  { label: 'QR Codes', color: '#4A7A8A', nav: 'ObjectList' as const },
  { label: 'Checklists', color: '#2D5A27', nav: 'ChecklistOverview' as const },
  { label: 'Export', color: '#7A4A8A', nav: 'ObjectList' as const },
  { label: '3D Scan', color: '#4A6A8A', nav: 'Scan3D' as const },
  { label: 'Browse', color: '#8A5A4A', nav: 'ObjectList' as const },
  { label: 'AI Analysis', color: '#4A8A7A', nav: 'CaptureCamera' as const },
  { label: 'Scan Doc', color: '#8A7A4A', nav: 'CaptureCamera' as const },
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

// ── Press animation wrapper ─────────────────────────────────────────────────

function PressScale({ children, onPress, style, ...rest }: React.ComponentProps<typeof Pressable>) {
  const scale = useRef(new RNAnimated.Value(1)).current;
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

// ── SectionLabel ────────────────────────────────────────────────────────────

function SectionLabel({ text, extra, right }: { text: string; extra?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text style={st.secLabel}>{text}</Text>
        {extra && <Text style={st.secLabelExtra}>{extra}</Text>}
      </View>
      {right}
    </View>
  );
}

// ── ViewProgressBar ─────────────────────────────────────────────────────────

function ViewProgressBar({ count, total = TOTAL_STANDARD_VIEWS, size = 'normal' }: { count: number; total?: number; size?: 'normal' | 'compact' }) {
  const w = size === 'compact' ? 10 : 16;
  const h = size === 'compact' ? 4 : 5;
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ width: w, height: h, borderRadius: 99, backgroundColor: i < count ? colors.heroGreen : colors.border }} />
      ))}
      <Text style={{ fontSize: size === 'compact' ? 10 : 11, color: colors.textSecondary, marginLeft: 4, fontWeight: typography.weight.medium }}>
        {count}/{total}
      </Text>
    </View>
  );
}

// ── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ label, variant }: { label: string; variant: 'amber' | 'green' }) {
  return (
    <View style={[st.pill, variant === 'amber' ? st.pillAmber : st.pillGreen]}>
      <Text style={[st.pillText, variant === 'amber' ? st.pillTextAmber : st.pillTextGreen]}>{label}</Text>
    </View>
  );
}

// ── ActionCard (vertical, for 2-column grid) ────────────────────────────────

function ActionCard({ obj, onDetail }: { obj: DashboardObject; onDetail: () => void; onAddViews: () => void; onRunAI: () => void; onExport: () => void }) {
  const viewsMissing = TOTAL_STANDARD_VIEWS - obj.view_count;
  const noAI = obj.has_ai === 0;
  return (
    <PressScale style={[st.actionCard, { width: CARD_W }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDetail(); }} accessibilityRole="button" accessibilityLabel={obj.title}>
      {obj.file_path ? (
        <View style={st.actionPhotoTop}><Image source={{ uri: obj.file_path }} style={[StyleSheet.absoluteFill, { borderTopLeftRadius: R, borderTopRightRadius: R }]} resizeMode="cover" /></View>
      ) : (
        <View style={[st.actionPhotoTop, st.thumbEmpty]}><CameraIcon size={24} color={colors.textTertiary} /></View>
      )}
      <View style={st.actionInfo}>
        <Text style={st.actionTitle} numberOfLines={1}>{obj.title || 'Untitled'}</Text>
        {/* Progress segments — flex: 1 per segment */}
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {Array.from({ length: TOTAL_STANDARD_VIEWS }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < obj.view_count ? colors.heroGreen : colors.border }} />
          ))}
        </View>
        {(noAI || viewsMissing > 0) && <StatusPill label={noAI ? 'No AI' : `${viewsMissing} views`} variant="amber" />}
      </View>
    </PressScale>
  );
}

// ── CompactRow ───────────────────────────────────────────────────────────────

function CompactRow({ obj, onPress }: { obj: DashboardObject; onPress: () => void }) {
  return (
    <PressScale style={st.compactRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={obj.title}>
      {obj.file_path ? (
        <View style={st.compactThumb}><Image source={{ uri: obj.file_path }} style={[StyleSheet.absoluteFill, { borderRadius: 8 }]} resizeMode="cover" /></View>
      ) : (
        <View style={[st.compactThumb, st.thumbEmpty]}><CameraIcon size={14} color={colors.textTertiary} /></View>
      )}
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

// ── Animated pulse dot ──────────────────────────────────────────────────────

function PulseDot({ active }: { active: boolean }) {
  const pulseScale = useRef(new RNAnimated.Value(1)).current;
  const pulseOpacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.parallel([
          RNAnimated.timing(pulseScale, { toValue: 2, duration: 1000, useNativeDriver: true }),
          RNAnimated.timing(pulseOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
        RNAnimated.parallel([
          RNAnimated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          RNAnimated.timing(pulseOpacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    pulseOpacity.setValue(0.4);
    anim.start();
    return () => anim.stop();
  }, [active, pulseScale, pulseOpacity]);

  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      {active && (
        <RNAnimated.View style={{
          position: 'absolute', width: 8, height: 8, borderRadius: 4,
          backgroundColor: colors.heroGreen, opacity: pulseOpacity,
          transform: [{ scale: pulseScale }],
        }} />
      )}
      <View style={[st.syncDot, active ? st.dotSynced : st.dotPending]} />
    </View>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const syncStatus = useSyncStatus();

  const [stats, setStats] = useState<Stats>({ totalObjects: 0, totalPhotos: 0, storageBytes: 0 });
  const [objects, setObjects] = useState<DashboardObject[]>([]);
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportSource, setExportSource] = useState<ExportSource | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [mapPinCount, setMapPinCount] = useState(0);

  const viewTypeList = STANDARD_VIEW_KEYS.map((k) => `'${k}'`).join(',');

  const loadData = useCallback(async () => {
    try {
      const [totalRow, photoRow, storageRow, objRows, collRows] = await Promise.all([
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM objects'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM media'),
        db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(file_size), 0) as total FROM media'),
        db.getAllAsync<DashboardObject>(
          `SELECT o.id, o.title, o.description, o.object_type, o.created_at, pm.file_path,
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
      try { const r = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM map_pins WHERE object_id IS NOT NULL'); setMapPinCount(r?.c ?? 0); } catch {}
    } catch {} finally { setLoading(false); }
  }, [db, viewTypeList]);

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [loadData]));

  const { needsAttention, complete } = useMemo(() => {
    const needs: DashboardObject[] = []; const done: DashboardObject[] = [];
    for (const obj of objects) (isComplete(obj) ? done : needs).push(obj);
    return { needsAttention: needs, complete: done };
  }, [objects]);

  const unfiled = useMemo(() => objects.filter((o) => o.in_collection === 0), [objects]);

  const handleExportObject = useCallback(async (objectId: string) => {
    const obj = await db.getFirstAsync<RegisterObject>('SELECT * FROM objects WHERE id = ?', [objectId]);
    const media = await db.getAllAsync<Media>('SELECT * FROM media WHERE object_id = ? ORDER BY sort_order', [objectId]);
    if (obj) { setExportSource({ mode: 'object', data: { object: obj, media, persons: [] } }); setShowExport(true); }
  }, [db]);

  const handleRunAI = useCallback(async (objectId: string) => {
    const pm = await db.getFirstAsync<{ file_path: string }>('SELECT file_path FROM media WHERE object_id = ? AND is_primary = 1', [objectId]);
    if (pm) navigation.navigate('AIReview', { objectId, photoUri: pm.file_path });
  }, [db, navigation]);

  const syncActive = syncStatus.pendingCount === 0;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* ── Glassmorphism header ── */}
      <View style={st.header}>
        <Image
          source={require('../../assets/images/register-logo.png')}
          style={{ width: 120, height: 44 }}
          resizeMode="contain"
        />
        <View style={st.headerActions}>
          <Pressable style={st.headerBtn} onPress={() => navigation.navigate('ObjectList')} accessibilityLabel={t('common.search')} hitSlop={touch.hitSlop}>
            <SearchIcon size={18} color={CREAM} />
          </Pressable>
          <Pressable style={st.headerBtn} onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings" hitSlop={touch.hitSlop}>
            <SettingsTabIcon size={18} color={CREAM} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ═══ 1. ACTIONS ═══ */}
        <View style={st.section}>
          <SectionLabel text="Actions" />
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

          <View style={st.quickRow}>
            <PressScale style={st.quickBtn} onPress={() => navigation.navigate('CreateCollection')}>
              <View style={[st.quickBtnIcon, { backgroundColor: colors.greenLight }]}><FolderPlus size={16} color={colors.heroGreen} /></View>
              <Text style={st.quickBtnText}>New collection</Text>
            </PressScale>
            <PressScale style={st.quickBtn} onPress={() => navigation.navigate('CollectionList')}>
              <View style={[st.quickBtnIcon, { backgroundColor: colors.infoLight }]}><FolderOpen size={16} color={colors.blueDark} /></View>
              <Text style={st.quickBtnText}>Add to existing</Text>
            </PressScale>
          </View>
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
                  <View>
                    <Text style={st.colName} numberOfLines={1}>{col.name}</Text>
                    <Text style={st.colSub}>{col.objectCount} objects</Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', gap: 1 }}>
                      {Array.from({ length: 8 }, (_, i) => (
                        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < Math.min(col.objectCount, 8) ? colors.heroGreen : colors.border }} />
                      ))}
                    </View>
                    <Text style={st.colProgress}>{Math.min(col.objectCount, 8)}/8</Text>
                  </View>
                </PressScale>
              ))}
            </ScrollView>
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
                    <Image source={{ uri: item.file_path }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
                <SectionLabel text="Needs attention" right={
                  needsAttention.length > 4 ? (
                    <Pressable onPress={() => navigation.navigate('ObjectList')} hitSlop={touch.hitSlop} style={st.viewAll}>
                      <Text style={st.viewAllText}>View all ({needsAttention.length})</Text>
                    </Pressable>
                  ) : undefined
                } />
                <View style={st.actionGrid}>
                  {needsAttention.slice(0, 4).map((obj) => (
                    <ActionCard key={obj.id} obj={obj}
                      onDetail={() => navigation.navigate('ObjectDetail', { objectId: obj.id })}
                      onAddViews={() => navigation.navigate('ViewChecklist', { objectId: obj.id })}
                      onRunAI={() => handleRunAI(obj.id)}
                      onExport={() => handleExportObject(obj.id)}
                    />
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
                <View style={[st.toolCellIcon, { backgroundColor: tool.color + '14' }]}>
                  <ToolSvgIcon index={i} color={tool.color} />
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
            <View style={st.statCard}>
              <Text style={st.statValue}>{formatStorageSize(stats.storageBytes)}</Text>
              <Text style={st.statLabel}>{t('home.statStorage')}</Text>
            </View>
          </View>
          <View style={st.syncBar}>
            <PulseDot active={syncActive} />
            <Text style={st.syncText}>
              {syncStatus.pendingCount > 0 ? `Sync: ${syncStatus.pendingCount} pending` : 'Sync: all up to date'}
            </Text>
          </View>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <ExportStepperModal visible={showExport} onClose={() => { setShowExport(false); setExportSource(null); }} source={exportSource} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Glassmorphism header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: PX, paddingTop: 8, paddingBottom: 12,
    backgroundColor: 'rgba(43, 58, 78, 0.92)',
  },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'transparent',
    borderWidth: 1, borderColor: CREAM + '40', alignItems: 'center', justifyContent: 'center',
    minWidth: touch.minTarget, minHeight: touch.minTarget,
  },

  // Section
  section: { paddingHorizontal: PX, marginBottom: SEC_GAP },
  secLabel: { fontSize: 16, fontWeight: typography.weight.bold, color: colors.text },
  secLabelExtra: { fontSize: 13, color: colors.textTertiary },
  viewAll: { minHeight: touch.minTarget, justifyContent: 'center' },
  viewAllText: { fontSize: 13, fontWeight: typography.weight.semibold, color: colors.heroGreen },

  // CTA (96px)
  cta: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    height: 96, backgroundColor: colors.heroGreen, borderRadius: R, marginBottom: ITEM_GAP,
  },
  ctaIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  ctaText: { flex: 1, marginLeft: 14 },
  ctaTitle: { fontSize: 20, fontWeight: typography.weight.bold, color: colors.white },
  ctaSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Quick buttons (64px)
  quickRow: { flexDirection: 'row', gap: ITEM_GAP },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surfaceElevated, borderRadius: R, borderWidth: 0.5,
    borderColor: colors.border, paddingHorizontal: 14, height: 64,
  },
  quickBtnIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  quickBtnText: { fontSize: 15, fontWeight: typography.weight.semibold, color: colors.text },

  // Collection cards (180x110 with progress)
  colCard: {
    width: 180, height: 110, backgroundColor: colors.surfaceElevated, borderRadius: R,
    borderWidth: 0.5, borderColor: colors.border, padding: 14, justifyContent: 'space-between',
  },
  colName: { fontSize: 16, fontWeight: typography.weight.bold, color: colors.text },
  colSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  colProgress: { fontSize: 10, color: colors.textTertiary, textAlign: 'right', marginTop: 3 },

  // Recent (unfiled) — 140x140 square photo-fill
  recentCard: {
    width: 140, height: 140, borderRadius: R, borderWidth: 2.5,
    borderColor: colors.warning, overflow: 'hidden', backgroundColor: colors.surface,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  recentTitle: { position: 'absolute', bottom: 6, left: 8, right: 8, fontSize: 11, fontWeight: typography.weight.semibold, color: colors.white, zIndex: 2 },

  // Empty
  emptyCard: {
    alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceElevated, borderRadius: R, borderWidth: 1, borderColor: colors.border,
  },
  emptyTitle: { fontSize: 14, fontWeight: typography.weight.medium, color: colors.text, marginTop: spacing.sm },
  emptyMsg: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

  // ActionCard (2-col grid, photo 100px top)
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ITEM_GAP },
  actionCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: R,
    borderWidth: 0.5, borderColor: colors.border, overflow: 'hidden',
  },
  actionPhotoTop: { width: '100%', height: 120, backgroundColor: colors.surface },
  actionInfo: { padding: 10, gap: 4 },
  actionTitle: { fontSize: 13, fontWeight: typography.weight.bold, color: colors.text },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  pill: { borderRadius: radii.full, paddingHorizontal: 6, paddingVertical: 2 },
  pillAmber: { backgroundColor: '#FFF8E8' },
  pillGreen: { backgroundColor: '#EAF3DE' },
  pillText: { fontSize: 10, fontWeight: typography.weight.semibold },
  pillTextAmber: { color: '#854F0B' },
  pillTextGreen: { color: '#27500A' },

  // CompactRow (52px)
  compactRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border, borderRadius: R,
    paddingHorizontal: 14, height: 52, marginBottom: 8, gap: 10,
  },
  compactThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface },
  compactInfo: { flex: 1 },
  compactTitle: { fontSize: 13, fontWeight: typography.weight.medium, color: colors.text },
  compactMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  compactTime: { fontSize: 10, color: colors.textTertiary },

  // Tools (4-column grid, 88px tall)
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ITEM_GAP },
  toolCell: {
    height: 88, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: R,
    borderWidth: 0.5, borderColor: colors.border,
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
    backgroundColor: colors.surfaceElevated, borderRadius: R, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 17, fontWeight: typography.weight.bold, color: colors.text },
  statLabel: { fontSize: 11, color: colors.textSecondary },

  // Sync (44px)
  syncBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated,
    borderRadius: R, borderWidth: 1, borderColor: colors.border,
    height: 44, paddingHorizontal: 14, gap: 8,
  },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  dotSynced: { backgroundColor: colors.heroGreen },
  dotPending: { backgroundColor: colors.warning },
  syncText: { fontSize: 12, color: colors.textSecondary },

  // Badge (kept for compatibility)
  countBadge: { backgroundColor: colors.warning, borderRadius: radii.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countBadgeText: { fontSize: 11, fontWeight: typography.weight.bold, color: colors.white },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
