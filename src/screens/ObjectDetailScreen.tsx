import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { logAuditEntry } from '../db/audit';
import { SyncEngine } from '../sync/engine';
import { generateId } from '../utils/uuid';
import { FieldInput } from '../components/FieldInput';
import { TypePicker } from '../components/TypePicker';
import {
  getCollectionsForObject,
  getAllCollections,
  addObjectToCollection,
  type CollectionForObject,
  type CollectionWithCount,
} from '../services/collectionService';
import type { ObjectStackParamList } from '../navigation/ObjectStack';
import type { MainTabParamList } from '../navigation/MainTabs';
import type {
  ObjectType,
  PrivacyTier,
  EvidenceClass,
  Media,
  Annotation,
} from '../db/types';

type Props = NativeStackScreenProps<ObjectStackParamList, 'ObjectDetail'>;

const PRIVACY_TIERS: PrivacyTier[] = ['public', 'confidential', 'anonymous'];
const EVIDENCE_CLASSES: EvidenceClass[] = ['primary', 'corroborative', 'contextual'];
const TYPES_HIDE_CREATOR: ObjectType[] = ['incident', 'specimen', 'site'];
const TYPES_HIDE_MATERIALS: ObjectType[] = ['incident', 'site'];

interface ObjectData {
  id: string;
  object_type: ObjectType;
  status: string;
  title: string;
  description: string | null;
  inventory_number: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  coordinate_accuracy: number | null;
  coordinate_source: string | null;
  evidence_class: EvidenceClass | null;
  legal_hold: number;
  privacy_tier: PrivacyTier;
  event_start: string | null;
  event_end: string | null;
  type_specific_data: string | null;
  created_at: string;
  updated_at: string;
}

export function ObjectDetailScreen({ route, navigation }: Props) {
  const { objectId } = route.params;
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [obj, setObj] = useState<ObjectData | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable form state
  const [title, setTitle] = useState('');
  const [objectType, setObjectType] = useState<ObjectType>('museum_object');
  const [description, setDescription] = useState('');
  const [creator, setCreator] = useState('');
  const [date, setDate] = useState('');
  const [materials, setMaterials] = useState('');
  const [privacyTier, setPrivacyTier] = useState<PrivacyTier>('public');
  const [evidenceClass, setEvidenceClass] = useState<EvidenceClass | null>(null);
  const [legalHold, setLegalHold] = useState(false);
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');

  // Annotations
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Copy feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Collections
  const [objectCollections, setObjectCollections] = useState<CollectionForObject[]>([]);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [pickerCollections, setPickerCollections] = useState<CollectionWithCount[]>([]);

  const loadData = useCallback(async () => {
    const row = await db.getFirstAsync<ObjectData>(
      'SELECT * FROM objects WHERE id = ?',
      [objectId],
    );
    if (!row) return;

    setObj(row);
    setTitle(row.title);
    setObjectType(row.object_type);
    setDescription(row.description ?? '');
    setPrivacyTier(row.privacy_tier);
    setEvidenceClass(row.evidence_class);
    setLegalHold(row.legal_hold === 1);
    setEventStart(row.event_start ?? '');
    setEventEnd(row.event_end ?? '');

    // Parse type-specific data
    if (row.type_specific_data) {
      try {
        const tsd = JSON.parse(row.type_specific_data);
        setCreator(tsd.creator ?? '');
        setDate(tsd.date ?? '');
        setMaterials(tsd.materials ?? '');
      } catch {
        // invalid JSON, ignore
      }
    }

    const mediaRows = await db.getAllAsync<Media>(
      'SELECT * FROM media WHERE object_id = ? ORDER BY is_primary DESC, sort_order ASC',
      [objectId],
    );
    setMedia(mediaRows);

    const annotationRows = await db.getAllAsync<Annotation>(
      'SELECT * FROM annotations WHERE object_id = ? ORDER BY created_at DESC',
      [objectId],
    );
    setAnnotations(annotationRows);

    const objCols = await getCollectionsForObject(db, objectId);
    setObjectCollections(objCols);

    setLoading(false);
  }, [db, objectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -- Auto-save helpers --

  const saveField = useCallback(
    async (column: string, value: unknown, oldValue?: unknown) => {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE objects SET ${column} = ?, updated_at = ? WHERE id = ?`,
        [value as any, now, objectId],
      );
      await logAuditEntry(db, {
        tableName: 'objects',
        recordId: objectId,
        action: 'update',
        userId: 'local',
        oldValues: { [column]: oldValue },
        newValues: { [column]: value },
      });
      const sync = new SyncEngine(db);
      await sync.queueChange('objects', objectId, 'update', {
        [column]: value,
      });
    },
    [db, objectId],
  );

  const saveTypeSpecificData = useCallback(async () => {
    const tsd = JSON.stringify({ creator, date, materials });
    await saveField('type_specific_data', tsd);
  }, [creator, date, materials, saveField]);

  const handleTitleBlur = useCallback(() => {
    if (obj && title !== obj.title) {
      saveField('title', title, obj.title);
    }
  }, [title, obj, saveField]);

  const handleDescriptionBlur = useCallback(() => {
    if (obj && description !== (obj.description ?? '')) {
      saveField('description', description || null, obj.description);
    }
  }, [description, obj, saveField]);

  const handleTypeChange = useCallback(
    (type: ObjectType) => {
      const old = objectType;
      setObjectType(type);
      saveField('object_type', type, old);
    },
    [objectType, saveField],
  );

  const handlePrivacyChange = useCallback(
    (tier: PrivacyTier) => {
      const old = privacyTier;
      setPrivacyTier(tier);
      saveField('privacy_tier', tier, old);
    },
    [privacyTier, saveField],
  );

  const handleEvidenceChange = useCallback(
    (ec: EvidenceClass) => {
      const old = evidenceClass;
      const newVal = ec === evidenceClass ? null : ec;
      setEvidenceClass(newVal);
      saveField('evidence_class', newVal, old);
    },
    [evidenceClass, saveField],
  );

  const handleLegalHoldChange = useCallback(
    (val: boolean) => {
      setLegalHold(val);
      saveField('legal_hold', val ? 1 : 0, legalHold ? 1 : 0);
    },
    [legalHold, saveField],
  );

  const handleEventStartBlur = useCallback(() => {
    if (obj && eventStart !== (obj.event_start ?? '')) {
      saveField('event_start', eventStart || null, obj.event_start);
    }
  }, [eventStart, obj, saveField]);

  const handleEventEndBlur = useCallback(() => {
    if (obj && eventEnd !== (obj.event_end ?? '')) {
      saveField('event_end', eventEnd || null, obj.event_end);
    }
  }, [eventEnd, obj, saveField]);

  const handleAddNote = useCallback(async () => {
    if (!noteText.trim()) return;
    const id = generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO annotations (id, object_id, user_id, annotation_type, content, created_at, updated_at)
       VALUES (?, ?, 'local', 'note', ?, ?, ?)`,
      [id, objectId, noteText.trim(), now, now],
    );
    await logAuditEntry(db, {
      tableName: 'annotations',
      recordId: id,
      action: 'insert',
      userId: 'local',
      newValues: { content: noteText.trim() },
    });
    setNoteText('');
    setAddingNote(false);
    // Reload annotations
    const rows = await db.getAllAsync<Annotation>(
      'SELECT * FROM annotations WHERE object_id = ? ORDER BY created_at DESC',
      [objectId],
    );
    setAnnotations(rows);
  }, [noteText, db, objectId]);

  const handleCopy = useCallback((field: string, _value: string) => {
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }, []);

  const handleShowCollectionPicker = useCallback(async () => {
    const all = await getAllCollections(db);
    setPickerCollections(all);
    setShowCollectionPicker(true);
  }, [db]);

  const handleAddToCollection = useCallback(
    async (collectionId: string) => {
      await addObjectToCollection(db, objectId, collectionId);
      const objCols = await getCollectionsForObject(db, objectId);
      setObjectCollections(objCols);
      setShowCollectionPicker(false);
    },
    [db, objectId],
  );

  const navigateToCollection = useCallback(
    (collectionId: string) => {
      const tabNav =
        navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
      tabNav?.navigate('Collections', {
        screen: 'CollectionDetail',
        params: { collectionId },
      });
    },
    [navigation],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#74B9FF" />
      </View>
    );
  }

  if (!obj) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Object not found</Text>
      </View>
    );
  }

  const primaryMedia = media.find((m) => m.is_primary === 1) ?? media[0];
  const primaryHash = primaryMedia?.sha256_hash;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Back button */}
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>{'\u2190'} {t('common.back')}</Text>
      </Pressable>

      {/* SECTION 1 — Hero Image */}
      <View style={styles.heroContainer}>
        {primaryMedia ? (
          <Image source={{ uri: primaryMedia.file_path }} style={styles.heroImage} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroPlaceholderText}>{'\u25A3'}</Text>
          </View>
        )}
        {media.length > 1 && (
          <View style={styles.mediaBadge}>
            <Text style={styles.mediaBadgeText}>1/{media.length}</Text>
          </View>
        )}
      </View>

      {/* SECTION 2 — Core Fields */}
      <View style={styles.section}>
        <FieldInput
          label={t('objects.title')}
          value={title}
          onChangeText={setTitle}
          onBlur={handleTitleBlur}
          placeholder="Untitled"
        />

        <Text style={styles.sectionLabel}>{t('objects.object_type')}</Text>
        <TypePicker selected={objectType} onChange={handleTypeChange} />
        <View style={styles.spacer} />

        {!TYPES_HIDE_CREATOR.includes(objectType) && (
          <FieldInput
            label={t('objects.creator')}
            value={creator}
            onChangeText={setCreator}
            onBlur={saveTypeSpecificData}
            placeholder="Unknown"
          />
        )}

        <FieldInput
          label={t('objects.date')}
          value={date}
          onChangeText={setDate}
          onBlur={saveTypeSpecificData}
          placeholder="ca. 1920"
        />

        <FieldInput
          label={t('objects.description')}
          value={description}
          onChangeText={setDescription}
          onBlur={handleDescriptionBlur}
          multiline
          placeholder="Describe this object..."
        />

        {!TYPES_HIDE_MATERIALS.includes(objectType) && (
          <FieldInput
            label={t('objects.materials')}
            value={materials}
            onChangeText={setMaterials}
            onBlur={saveTypeSpecificData}
            placeholder="Bronze, wood, pigment..."
          />
        )}
      </View>

      {/* SECTION 3 — Location */}
      {obj.latitude != null && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>Lat</Text>
              <Text style={styles.locationValue}>{obj.latitude.toFixed(6)}</Text>
            </View>
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>Lng</Text>
              <Text style={styles.locationValue}>{obj.longitude?.toFixed(6)}</Text>
            </View>
            {obj.altitude != null && (
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Alt</Text>
                <Text style={styles.locationValue}>{obj.altitude.toFixed(1)}m</Text>
              </View>
            )}
            {obj.coordinate_source && (
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Source</Text>
                <Text style={styles.locationValue}>{obj.coordinate_source}</Text>
              </View>
            )}
            {obj.coordinate_accuracy != null && (
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Accuracy</Text>
                <Text style={styles.locationValue}>{'\u00B1'}{obj.coordinate_accuracy.toFixed(1)}m</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* SECTION 4 — Evidence & Privacy (collapsible) */}
      <View style={styles.section}>
        <Pressable
          style={styles.collapseHeader}
          onPress={() => setEvidenceExpanded(!evidenceExpanded)}
        >
          <Text style={styles.sectionTitle}>Evidence & Privacy</Text>
          <Text style={styles.collapseArrow}>
            {evidenceExpanded ? '\u25B2' : '\u25BC'}
          </Text>
        </Pressable>

        {evidenceExpanded && (
          <View style={styles.collapseBody}>
            {/* Privacy tier */}
            <Text style={styles.fieldLabel}>{t('objects.object_type') === 'Object Type' ? 'Privacy' : 'Privacy'}</Text>
            <View style={styles.chipRow}>
              {PRIVACY_TIERS.map((tier) => (
                <Pressable
                  key={tier}
                  style={[styles.chip, privacyTier === tier && styles.chipActive]}
                  onPress={() => handlePrivacyChange(tier)}
                >
                  <Text style={[styles.chipText, privacyTier === tier && styles.chipTextActive]}>
                    {t(`privacy.${tier}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Evidence class */}
            <Text style={styles.fieldLabel}>Evidence Class</Text>
            <View style={styles.chipRow}>
              {EVIDENCE_CLASSES.map((ec) => (
                <Pressable
                  key={ec}
                  style={[styles.chip, evidenceClass === ec && styles.chipActive]}
                  onPress={() => handleEvidenceChange(ec)}
                >
                  <Text style={[styles.chipText, evidenceClass === ec && styles.chipTextActive]}>
                    {t(`evidence.${ec}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Legal hold */}
            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>{t('evidence.legal_hold_active')}</Text>
              <Switch
                value={legalHold}
                onValueChange={handleLegalHoldChange}
                trackColor={{ false: '#2D2D3A', true: '#0984E3' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Event dates */}
            <FieldInput
              label="Event Start"
              value={eventStart}
              onChangeText={setEventStart}
              onBlur={handleEventStartBlur}
              placeholder="YYYY-MM-DD or freeform"
            />
            <FieldInput
              label="Event End"
              value={eventEnd}
              onChangeText={setEventEnd}
              onBlur={handleEventEndBlur}
              placeholder="YYYY-MM-DD or freeform"
            />
          </View>
        )}
      </View>

      {/* SECTION 5 — Annotations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Annotations</Text>

        {annotations.map((a) => (
          <View key={a.id} style={styles.annotationCard}>
            <Text style={styles.annotationContent}>{a.content}</Text>
            <Text style={styles.annotationMeta}>
              {a.user_id ?? 'local'} {'\u00B7'} {a.created_at.slice(0, 16).replace('T', ' ')}
            </Text>
          </View>
        ))}

        {addingNote ? (
          <View style={styles.noteInputContainer}>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Write a note..."
              placeholderTextColor="#4A4A5A"
              multiline
              autoFocus
            />
            <View style={styles.noteActions}>
              <Pressable style={styles.noteSaveBtn} onPress={handleAddNote}>
                <Text style={styles.noteSaveText}>{t('common.save')}</Text>
              </Pressable>
              <Pressable onPress={() => { setAddingNote(false); setNoteText(''); }}>
                <Text style={styles.noteCancelText}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addNoteBtn} onPress={() => setAddingNote(true)}>
            <Text style={styles.addNoteBtnText}>+ {t('capture.add_annotation')}</Text>
          </Pressable>
        )}
      </View>

      {/* SECTION 6 — Collections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('objects.collections_section')}</Text>
        {objectCollections.length > 0 ? (
          <View style={styles.collectionChips}>
            {objectCollections.map((col) => (
              <Pressable
                key={col.id}
                style={styles.collectionChip}
                onPress={() => navigateToCollection(col.id)}
              >
                <Text style={styles.collectionChipText}>{col.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.noCollectionsText}>{t('objects.no_collections')}</Text>
        )}
        <Pressable
          style={styles.addToCollectionBtn}
          onPress={handleShowCollectionPicker}
        >
          <Text style={styles.addToCollectionBtnText}>
            + {t('objects.add_to_collection')}
          </Text>
        </Pressable>
        {showCollectionPicker && (
          <View style={styles.pickerContainer}>
            {pickerCollections
              .filter((c) => !objectCollections.some((oc) => oc.id === c.id))
              .map((col) => (
                <Pressable
                  key={col.id}
                  style={styles.pickerRow}
                  onPress={() => handleAddToCollection(col.id)}
                >
                  <Text style={styles.pickerRowText}>{col.name}</Text>
                  <Text style={styles.pickerRowType}>
                    {t(`collections.type.${col.collection_type}`)}
                  </Text>
                </Pressable>
              ))}
            {pickerCollections.filter(
              (c) => !objectCollections.some((oc) => oc.id === c.id),
            ).length === 0 && (
              <Text style={styles.pickerEmptyText}>
                {t('collections.add_objects.all_added')}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* SECTION 7 — Metadata Footer */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Metadata</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Created</Text>
          <Text style={styles.metaValue}>
            {obj.created_at.slice(0, 19).replace('T', ' ')}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Updated</Text>
          <Text style={styles.metaValue}>
            {obj.updated_at.slice(0, 19).replace('T', ' ')}
          </Text>
        </View>
        {primaryHash && (
          <Pressable style={styles.metaRow} onPress={() => handleCopy('hash', primaryHash)}>
            <Text style={styles.metaLabel}>SHA-256</Text>
            <Text style={styles.metaValue}>
              {primaryHash.slice(0, 16)}...
              {copiedField === 'hash' ? ' Copied!' : ' \u2398'}
            </Text>
          </Pressable>
        )}
        <Pressable style={styles.metaRow} onPress={() => handleCopy('id', objectId)}>
          <Text style={styles.metaLabel}>UUID</Text>
          <Text style={styles.metaValue}>
            {objectId.slice(0, 8)}...
            {copiedField === 'id' ? ' Copied!' : ' \u2398'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  scroll: { paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: '#08080F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: '#FF6B6B', fontSize: 16 },
  backBtn: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 },
  backText: { color: '#74B9FF', fontSize: 16 },

  // Hero
  heroContainer: { position: 'relative' },
  heroImage: { width: '100%', height: 250, backgroundColor: '#1A1A2E' },
  heroPlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderText: { fontSize: 48, color: '#2D2D3A' },
  mediaBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mediaBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionLabel: {
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  spacer: { height: 16 },

  // Location card
  locationCard: {
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.1)',
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  locationLabel: { color: '#636E72', fontSize: 13, fontWeight: '500' },
  locationValue: { color: '#DFE6E9', fontSize: 13 },

  // Collapsible
  collapseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapseArrow: { color: '#636E72', fontSize: 12 },
  collapseBody: { marginTop: 12 },

  // Chips (privacy/evidence)
  fieldLabel: {
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.15)',
  },
  chipActive: { backgroundColor: '#0984E3', borderColor: '#0984E3' },
  chipText: { color: '#636E72', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },

  // Annotations
  annotationCard: {
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.08)',
  },
  annotationContent: { color: '#DFE6E9', fontSize: 14, lineHeight: 20 },
  annotationMeta: { color: '#636E72', fontSize: 11, marginTop: 6 },
  addNoteBtn: {
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.2)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addNoteBtnText: { color: '#74B9FF', fontSize: 14, fontWeight: '500' },
  noteInputContainer: { marginTop: 8 },
  noteInput: {
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.1)',
    borderRadius: 10,
    color: '#DFE6E9',
    fontSize: 14,
    padding: 12,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  noteActions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  noteSaveBtn: {
    backgroundColor: '#0984E3',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  noteSaveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  noteCancelText: { color: '#636E72', fontSize: 14, paddingVertical: 8 },

  // Metadata footer
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metaLabel: { color: '#636E72', fontSize: 13 },
  metaValue: { color: '#DFE6E9', fontSize: 13 },

  // Collections
  collectionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  collectionChip: {
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  collectionChipText: {
    color: '#74B9FF',
    fontSize: 13,
    fontWeight: '500',
  },
  noCollectionsText: {
    color: '#636E72',
    fontSize: 14,
    marginBottom: 12,
  },
  addToCollectionBtn: {
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.2)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  addToCollectionBtnText: {
    color: '#74B9FF',
    fontSize: 14,
    fontWeight: '500',
  },
  pickerContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.1)',
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  pickerRowText: {
    color: '#DFE6E9',
    fontSize: 15,
  },
  pickerRowType: {
    color: '#636E72',
    fontSize: 12,
  },
  pickerEmptyText: {
    color: '#636E72',
    fontSize: 14,
    padding: 14,
    textAlign: 'center',
  },

  bottomPad: { height: 40 },
});
