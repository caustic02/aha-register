import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import { Map, Plus, X, Eye, Trash2, MapPin } from 'lucide-react-native';
import { BackIcon, CameraIcon, PackageIcon } from '../theme/icons';
import { useDatabase } from '../contexts/DatabaseContext';
import { generateId } from '../utils/uuid';
import { colors, radii, spacing, touch, typography } from '../theme';
import type { FloorMap, MapPin as MapPinType } from '../db/types';
import type { RootStackParamList } from '../navigation/RootStack';

type Props = NativeStackScreenProps<RootStackParamList, 'FloorMap'>;

const SCREEN_W = Dimensions.get('window').width;
const PIN_SIZE = 24;

interface PinWithObject extends MapPinType {
  obj_title: string | null;
  obj_file_path: string | null;
  obj_room: string | null;
  obj_shelf: string | null;
}

interface PickerObject {
  id: string;
  title: string;
  file_path: string | null;
}

// ── Pin component ────────────────────────────────────────────────────────────

function PinDot({
  pin,
  imageW,
  imageH,
  onPress,
}: {
  pin: PinWithObject;
  imageW: number;
  imageH: number;
  onPress: (p: PinWithObject) => void;
}) {
  const left = (pin.x_percent / 100) * imageW - PIN_SIZE / 2;
  const top = (pin.y_percent / 100) * imageH - PIN_SIZE / 2;

  return (
    <Pressable
      style={[s.pin, { left, top }]}
      onPress={() => onPress(pin)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={pin.obj_title ?? pin.label ?? 'Pin'}
    >
      <View style={s.pinInner}>
        <MapPin size={12} color={colors.white} fill={colors.white} />
      </View>
    </Pressable>
  );
}

// ── Object picker modal ──────────────────────────────────────────────────────

function ObjectPickerModal({
  visible,
  objects,
  onSelect,
  onClose,
}: {
  visible: boolean;
  objects: PickerObject[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? objects.filter((o) => o.title.toLowerCase().includes(search.toLowerCase()))
    : objects;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select object</Text>
            <Pressable onPress={onClose} hitSlop={touch.hitSlop} style={s.modalClose}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            style={s.modalSearch}
            placeholder="Search objects..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView style={s.modalList}>
            {filtered.length === 0 ? (
              <Text style={s.modalEmpty}>No objects available</Text>
            ) : (
              filtered.map((obj) => (
                <Pressable
                  key={obj.id}
                  style={s.modalRow}
                  onPress={() => {
                    onSelect(obj.id);
                    setSearch('');
                  }}
                  accessibilityRole="button"
                >
                  {obj.file_path ? (
                    <Image source={{ uri: obj.file_path }} style={s.modalThumb} />
                  ) : (
                    <View style={[s.modalThumb, s.thumbEmpty]}>
                      <CameraIcon size={14} color={colors.textTertiary} />
                    </View>
                  )}
                  <Text style={s.modalObjTitle} numberOfLines={1}>{obj.title}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Pin detail popup ─────────────────────────────────────────────────────────

function PinDetailPopup({
  pin,
  onView,
  onRemove,
  onClose,
}: {
  pin: PinWithObject;
  onView: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade">
      <Pressable style={s.popupOverlay} onPress={onClose}>
        <View style={s.popupCard}>
          <View style={s.popupTop}>
            {pin.obj_file_path ? (
              <Image source={{ uri: pin.obj_file_path }} style={s.popupThumb} />
            ) : (
              <View style={[s.popupThumb, s.thumbEmpty]}>
                <CameraIcon size={20} color={colors.textTertiary} />
              </View>
            )}
            <View style={s.popupInfo}>
              <Text style={s.popupTitle} numberOfLines={2}>
                {pin.obj_title ?? pin.label ?? 'Unknown'}
              </Text>
              {(pin.obj_room || pin.obj_shelf) && (
                <Text style={s.popupSub} numberOfLines={1}>
                  {[pin.obj_room, pin.obj_shelf].filter(Boolean).join(' / ')}
                </Text>
              )}
            </View>
          </View>
          <View style={s.popupActions}>
            <Pressable style={s.popupBtn} onPress={onView} accessibilityLabel="View object">
              <Eye size={16} color={colors.heroGreen} />
              <Text style={s.popupBtnText}>View</Text>
            </Pressable>
            <View style={s.popupDivider} />
            <Pressable style={s.popupBtn} onPress={onRemove} accessibilityLabel="Remove pin">
              <Trash2 size={16} color={colors.error} />
              <Text style={[s.popupBtnText, { color: colors.error }]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export function FloorMapScreen({ route, navigation }: Props) {
  const db = useDatabase();
  const targetObjectId = route.params?.objectId;

  const [maps, setMaps] = useState<FloorMap[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [pins, setPins] = useState<PinWithObject[]>([]);
  const [loading, setLoading] = useState(true);

  // Map add form
  const [showNameInput, setShowNameInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBuilding, setNewBuilding] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [pendingImageW, setPendingImageW] = useState(0);
  const [pendingImageH, setPendingImageH] = useState(0);

  // Pin interaction
  const [selectedPin, setSelectedPin] = useState<PinWithObject | null>(null);
  const [showObjectPicker, setShowObjectPicker] = useState(false);
  const [pendingPinPos, setPendingPinPos] = useState<{ x: number; y: number } | null>(null);
  const [unpinnedObjects, setUnpinnedObjects] = useState<PickerObject[]>([]);

  // Map display
  const [displayW, setDisplayW] = useState(SCREEN_W);
  const [displayH, setDisplayH] = useState(SCREEN_W);
  const imageContainerRef = useRef<View>(null);

  const activeMap = maps.find((m) => m.id === activeMapId) ?? null;

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadMaps = useCallback(async () => {
    const rows = await db.getAllAsync<FloorMap>(
      'SELECT * FROM floor_maps ORDER BY created_at DESC',
    );
    setMaps(rows);
    if (rows.length > 0 && !activeMapId) {
      const targetMap = route.params?.mapId
        ? rows.find((m) => m.id === route.params!.mapId)
        : rows[0];
      setActiveMapId((targetMap ?? rows[0]).id);
    }
    setLoading(false);
  }, [db, activeMapId, route.params?.mapId]);

  const loadPins = useCallback(async () => {
    if (!activeMapId) { setPins([]); return; }
    const rows = await db.getAllAsync<PinWithObject>(
      `SELECT mp.*, o.title as obj_title, m.file_path as obj_file_path,
              o.location_room as obj_room, o.location_shelf as obj_shelf
       FROM map_pins mp
       LEFT JOIN objects o ON o.id = mp.object_id
       LEFT JOIN media m ON m.object_id = mp.object_id AND m.is_primary = 1
       WHERE mp.floor_map_id = ?
       ORDER BY mp.created_at`,
      [activeMapId],
    );
    setPins(rows);
  }, [db, activeMapId]);

  const loadUnpinnedObjects = useCallback(async () => {
    const rows = await db.getAllAsync<PickerObject>(
      `SELECT o.id, o.title, m.file_path
       FROM objects o
       LEFT JOIN media m ON m.object_id = o.id AND m.is_primary = 1
       WHERE o.id NOT IN (SELECT object_id FROM map_pins WHERE object_id IS NOT NULL)
       ORDER BY o.created_at DESC`,
    );
    setUnpinnedObjects(rows);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadMaps();
    }, [loadMaps]),
  );

  useFocusEffect(
    useCallback(() => {
      if (activeMapId) {
        loadPins();
        loadUnpinnedObjects();
      }
    }, [activeMapId, loadPins, loadUnpinnedObjects]),
  );

  // Compute display dimensions when map loads
  const onMapLayout = useCallback(() => {
    if (!activeMap) return;
    const imgW = activeMap.image_width ?? SCREEN_W;
    const imgH = activeMap.image_height ?? SCREEN_W;
    const ratio = imgH / imgW;
    const dw = SCREEN_W - spacing.lg * 2;
    setDisplayW(dw);
    setDisplayH(dw * ratio);
  }, [activeMap]);

  // ── Add map flow ──────────────────────────────────────────────────────────

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    // Copy to persistent storage
    const id = generateId();
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const destDir = `${Paths.document.uri}floor_maps/`;
    const destUri = `${destDir}${id}.${ext}`;

    const srcFile = new File(asset.uri);
    const destFile = new File(destUri);
    const parentDir = destFile.parentDirectory;
    if (!parentDir.exists) parentDir.create({ intermediates: true, idempotent: true });
    srcFile.copy(destFile);

    setPendingImageUri(destUri);
    setPendingImageW(asset.width);
    setPendingImageH(asset.height);
    setShowNameInput(true);
  }, []);

  const saveNewMap = useCallback(async () => {
    if (!pendingImageUri || !newName.trim()) return;
    const id = generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO floor_maps (id, name, building, floor, image_uri, image_width, image_height, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, newName.trim(), newBuilding.trim() || null, newFloor.trim() || null,
       pendingImageUri, pendingImageW, pendingImageH, now, now],
    );
    setShowNameInput(false);
    setNewName('');
    setNewBuilding('');
    setNewFloor('');
    setPendingImageUri(null);
    setActiveMapId(id);
    await loadMaps();
  }, [db, pendingImageUri, newName, newBuilding, newFloor, pendingImageW, pendingImageH, loadMaps]);

  // ── Pin management ────────────────────────────────────────────────────────

  const handleMapLongPress = useCallback(
    (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
      if (!activeMapId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const xPct = (evt.nativeEvent.locationX / displayW) * 100;
      const yPct = (evt.nativeEvent.locationY / displayH) * 100;
      setPendingPinPos({ x: xPct, y: yPct });
      loadUnpinnedObjects().then(() => setShowObjectPicker(true));
    },
    [activeMapId, displayW, displayH, loadUnpinnedObjects],
  );

  const handleObjectSelected = useCallback(
    async (objectId: string) => {
      if (!activeMapId || !pendingPinPos) return;
      const id = generateId();
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO map_pins (id, floor_map_id, object_id, x_percent, y_percent, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, activeMapId, objectId, pendingPinPos.x, pendingPinPos.y, now],
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowObjectPicker(false);
      setPendingPinPos(null);
      await loadPins();
      await loadUnpinnedObjects();
    },
    [db, activeMapId, pendingPinPos, loadPins, loadUnpinnedObjects],
  );

  const handleRemovePin = useCallback(
    async (pinId: string) => {
      await db.runAsync('DELETE FROM map_pins WHERE id = ?', [pinId]);
      setSelectedPin(null);
      await loadPins();
      await loadUnpinnedObjects();
    },
    [db, loadPins, loadUnpinnedObjects],
  );

  // If target objectId and it's already pinned, auto-select that pin
  useFocusEffect(
    useCallback(() => {
      if (targetObjectId && pins.length > 0) {
        const match = pins.find((p) => p.object_id === targetObjectId);
        if (match) setSelectedPin(match);
      }
    }, [targetObjectId, pins]),
  );

  const pinnedCount = pins.filter((p) => p.object_id).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={touch.hitSlop}>
          <BackIcon size={24} color={colors.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {activeMap?.name ?? 'Floor Map'}
          </Text>
          {activeMap && (activeMap.building || activeMap.floor) && (
            <Text style={s.headerSub} numberOfLines={1}>
              {[activeMap.building, activeMap.floor].filter(Boolean).join(' / ')}
            </Text>
          )}
        </View>
        <Pressable onPress={pickImage} style={s.addBtn} hitSlop={touch.hitSlop} accessibilityLabel="Add map">
          <Plus size={20} color={colors.heroGreen} />
        </Pressable>
      </View>

      {/* Map tabs */}
      {maps.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
          {maps.map((m) => (
            <Pressable
              key={m.id}
              style={[s.tab, m.id === activeMapId && s.tabActive]}
              onPress={() => setActiveMapId(m.id)}
            >
              <Text style={[s.tabText, m.id === activeMapId && s.tabTextActive]} numberOfLines={1}>
                {m.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {loading ? null : maps.length === 0 ? (
        /* ── Empty state ─────────────────────────────────────────── */
        <View style={s.emptyCenter}>
          <Map size={64} color={colors.textTertiary} />
          <Text style={s.emptyTitle}>Add Floor Plan</Text>
          <Text style={s.emptySub}>
            Upload a floor plan, building map, or room layout to pin object locations.
          </Text>
          <Pressable style={s.emptyBtn} onPress={pickImage} accessibilityRole="button">
            <Plus size={18} color={colors.white} />
            <Text style={s.emptyBtnText}>Add Floor Plan</Text>
          </Pressable>
        </View>
      ) : activeMap ? (
        /* ── Map viewer ──────────────────────────────────────────── */
        <View style={s.mapContainer}>
          <ScrollView contentContainerStyle={s.mapScroll}>
            <Pressable
              onLongPress={handleMapLongPress}
              delayLongPress={400}
              style={s.mapImageWrap}
              onLayout={onMapLayout}
              ref={imageContainerRef}
            >
              <Image
                source={{ uri: activeMap.image_uri }}
                style={{ width: displayW, height: displayH }}
                resizeMode="contain"
              />
              {/* Pins */}
              {pins.map((pin) => (
                <PinDot
                  key={pin.id}
                  pin={pin}
                  imageW={displayW}
                  imageH={displayH}
                  onPress={setSelectedPin}
                />
              ))}
              {/* Pending pin preview */}
              {pendingPinPos && (
                <View
                  style={[
                    s.pin,
                    s.pinPending,
                    {
                      left: (pendingPinPos.x / 100) * displayW - PIN_SIZE / 2,
                      top: (pendingPinPos.y / 100) * displayH - PIN_SIZE / 2,
                    },
                  ]}
                  pointerEvents="none"
                />
              )}
            </Pressable>
          </ScrollView>

          {/* Bottom stats */}
          <View style={s.bottomBar}>
            <View style={s.bottomStats}>
              <MapPin size={14} color={colors.heroGreen} />
              <Text style={s.bottomText}>
                {pinnedCount} placed
              </Text>
            </View>
            {unpinnedObjects.length > 0 && (
              <Pressable
                onPress={() => {
                  setPendingPinPos(null);
                  setShowObjectPicker(true);
                }}
                hitSlop={touch.hitSlop}
              >
                <Text style={s.bottomLink}>
                  {unpinnedObjects.length} unplaced
                </Text>
              </Pressable>
            )}
          </View>

          {/* Instructions */}
          {pins.length === 0 && (
            <View style={s.hint} pointerEvents="none">
              <Text style={s.hintText}>Long-press the map to place a pin</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Name input modal for new map */}
      <Modal visible={showNameInput} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.nameCard}>
            <Text style={s.nameCardTitle}>Name your map</Text>
            <TextInput
              style={s.nameInput}
              placeholder="e.g. Main Building"
              placeholderTextColor={colors.textTertiary}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={s.nameRow}>
              <TextInput
                style={[s.nameInput, { flex: 1 }]}
                placeholder="Building"
                placeholderTextColor={colors.textTertiary}
                value={newBuilding}
                onChangeText={setNewBuilding}
              />
              <TextInput
                style={[s.nameInput, { flex: 1 }]}
                placeholder="Floor"
                placeholderTextColor={colors.textTertiary}
                value={newFloor}
                onChangeText={setNewFloor}
              />
            </View>
            <View style={s.nameActions}>
              <Pressable
                style={s.nameCancelBtn}
                onPress={() => { setShowNameInput(false); setPendingImageUri(null); }}
              >
                <Text style={s.nameCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.nameSaveBtn, !newName.trim() && { opacity: 0.4 }]}
                onPress={saveNewMap}
                disabled={!newName.trim()}
              >
                <Text style={s.nameSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Object picker */}
      <ObjectPickerModal
        visible={showObjectPicker}
        objects={unpinnedObjects}
        onSelect={handleObjectSelected}
        onClose={() => { setShowObjectPicker(false); setPendingPinPos(null); }}
      />

      {/* Pin detail popup */}
      {selectedPin && (
        <PinDetailPopup
          pin={selectedPin}
          onView={() => {
            setSelectedPin(null);
            if (selectedPin.object_id) {
              navigation.navigate('ObjectDetail', { objectId: selectedPin.object_id });
            }
          }}
          onRemove={() => handleRemovePin(selectedPin.id)}
          onClose={() => setSelectedPin(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: { width: touch.minTarget, height: touch.minTarget, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: typography.weight.semibold, color: colors.text },
  headerSub: { fontSize: 12, color: colors.textSecondary },
  addBtn: { width: touch.minTarget, height: touch.minTarget, alignItems: 'center', justifyContent: 'center' },

  // Tab bar
  tabBar: { maxHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tabBarContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 32,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.heroGreen, borderColor: colors.heroGreen },
  tabText: { fontSize: 12, fontWeight: typography.weight.medium, color: colors.textSecondary },
  tabTextActive: { color: colors.white },

  // Empty state
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 20, fontWeight: typography.weight.bold, color: colors.text, marginTop: spacing.lg },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.heroGreen,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    minHeight: touch.minTarget,
  },
  emptyBtnText: { fontSize: 14, fontWeight: typography.weight.semibold, color: colors.white },

  // Map viewer
  mapContainer: { flex: 1 },
  mapScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  mapImageWrap: { position: 'relative' },

  // Pins
  pin: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    zIndex: 10,
  },
  pinInner: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: colors.heroGreen,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    // shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pinPending: {
    opacity: 0.5,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  bottomStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bottomText: { fontSize: 12, color: colors.textSecondary, fontWeight: typography.weight.medium },
  bottomLink: { fontSize: 12, color: colors.heroGreen, fontWeight: typography.weight.semibold },

  // Hint overlay
  hint: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    color: colors.white,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    overflow: 'hidden',
  },

  // Modal shared
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: spacing['2xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  modalTitle: { fontSize: 16, fontWeight: typography.weight.semibold, color: colors.text },
  modalClose: { width: touch.minTarget, height: touch.minTarget, alignItems: 'center', justifyContent: 'center' },
  modalSearch: {
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 40,
  },
  modalList: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  modalEmpty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, paddingVertical: spacing.xl },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: touch.minTarget,
  },
  modalThumb: { width: 36, height: 36, borderRadius: 6, backgroundColor: colors.surface },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  modalObjTitle: { fontSize: 14, color: colors.text, flex: 1, fontWeight: typography.weight.medium },

  // Pin detail popup
  popupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  popupCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    width: 280,
    overflow: 'hidden',
  },
  popupTop: { flexDirection: 'row', padding: spacing.lg, gap: spacing.md },
  popupThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surface },
  popupInfo: { flex: 1, justifyContent: 'center' },
  popupTitle: { fontSize: 14, fontWeight: typography.weight.semibold, color: colors.text },
  popupSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  popupActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  popupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    minHeight: touch.minTarget,
  },
  popupBtnText: { fontSize: 13, fontWeight: typography.weight.semibold, color: colors.heroGreen },
  popupDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  // Name input card
  nameCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    marginHorizontal: spacing.xl,
    marginBottom: '30%',
    padding: spacing.lg,
  },
  nameCardTitle: { fontSize: 16, fontWeight: typography.weight.semibold, color: colors.text, marginBottom: spacing.md },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    minHeight: 40,
  },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  nameActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  nameCancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: touch.minTarget, justifyContent: 'center' },
  nameCancelText: { fontSize: 14, color: colors.textSecondary, fontWeight: typography.weight.medium },
  nameSaveBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.heroGreen,
    borderRadius: radii.md,
    minHeight: touch.minTarget,
    justifyContent: 'center',
  },
  nameSaveText: { fontSize: 14, color: colors.white, fontWeight: typography.weight.semibold },
});
