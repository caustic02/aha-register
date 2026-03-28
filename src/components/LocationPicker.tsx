import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useDatabase } from '../contexts/DatabaseContext';
import { colors, radii, spacing, touch, typography } from '../theme';

interface Props {
  objectId: string;
  initialBuilding?: string | null;
  initialFloor?: string | null;
  initialRoom?: string | null;
  initialShelf?: string | null;
  initialNotes?: string | null;
}

function LocationField({
  label,
  value,
  field,
  objectId,
  db,
}: {
  label: string;
  value: string | null;
  field: string;
  objectId: string;
  db: ReturnType<typeof useDatabase>;
}) {
  const [current, setCurrent] = useState(value ?? '');

  const handleSave = useCallback(() => {
    const trimmed = current.trim();
    if (trimmed === (value ?? '')) return;
    db.runAsync(
      `UPDATE objects SET ${field} = ?, updated_at = ? WHERE id = ?`,
      [trimmed || null, new Date().toISOString(), objectId],
    ).catch(() => {});
  }, [current, value, field, objectId, db]);

  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={current}
        onChangeText={setCurrent}
        onBlur={handleSave}
        placeholder="\u2014"
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

export function LocationPicker({
  objectId,
  initialBuilding,
  initialFloor,
  initialRoom,
  initialShelf,
  initialNotes,
}: Props) {
  const db = useDatabase();
  const [expanded, setExpanded] = useState(false);

  const hasAny = [initialBuilding, initialFloor, initialRoom, initialShelf, initialNotes]
    .some((v) => v != null && v !== '');

  return (
    <View style={s.container}>
      <Pressable
        style={s.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Location"
      >
        <View style={s.headerLeft}>
          <MapPin size={16} color={colors.heroGreen} />
          <Text style={s.headerTitle}>Location</Text>
          {hasAny && !expanded && (
            <Text style={s.headerHint} numberOfLines={1}>
              {[initialBuilding, initialFloor, initialRoom].filter(Boolean).join(' / ')}
            </Text>
          )}
        </View>
        {expanded ? (
          <ChevronUp size={16} color={colors.textTertiary} />
        ) : (
          <ChevronDown size={16} color={colors.textTertiary} />
        )}
      </Pressable>

      {expanded && (
        <View style={s.fields}>
          <LocationField label="Building" value={initialBuilding ?? null} field="location_building" objectId={objectId} db={db} />
          <LocationField label="Floor" value={initialFloor ?? null} field="location_floor" objectId={objectId} db={db} />
          <LocationField label="Room" value={initialRoom ?? null} field="location_room" objectId={objectId} db={db} />
          <LocationField label="Shelf / Position" value={initialShelf ?? null} field="location_shelf" objectId={objectId} db={db} />
          <LocationField label="Notes" value={initialNotes ?? null} field="location_notes" objectId={objectId} db={db} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touch.minTarget,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: typography.weight.semibold,
    color: colors.text,
  },
  headerHint: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    marginLeft: spacing.sm,
  },
  fields: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    width: 100,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  fieldInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    minHeight: 36,
  },
});
