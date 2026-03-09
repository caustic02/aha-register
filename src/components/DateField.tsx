import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, typography, radii } from '../theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const ITEM_H = 44;
const VISIBLE = 5; // must be odd
const PAD = Math.floor(VISIBLE / 2); // 2 — padding items above/below center

const YEAR_MIN = 1500;
const YEAR_MAX = new Date().getFullYear() + 10;
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) =>
  String(YEAR_MIN + i),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDisplay(iso: string, language: string): string {
  const parts = iso.split('-');
  if (parts.length === 3 && parts[0].length >= 4) {
    const [y, m, d] = parts;
    return language.startsWith('de') ? `${d}.${m}.${y}` : `${m}/${d}/${y}`;
  }
  return iso; // Freeform legacy value — show as-is
}

// ── Scroll event type ─────────────────────────────────────────────────────────

type ScrollEndEvent = NativeSyntheticEvent<{
  contentOffset: { y: number };
  velocity?: { y: number };
}>;

// ── SpinnerColumn ─────────────────────────────────────────────────────────────

interface SpinnerProps {
  data: string[];
  initialIndex: number;
  onChange: (index: number) => void;
}

function SpinnerColumn({ data, initialIndex, onChange }: SpinnerProps) {
  const ref = useRef<ScrollView>(null);
  const [localIdx, setLocalIdx] = useState(initialIndex);

  // Scroll to initial position after mount
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: initialIndex * ITEM_H, animated: false });
    }, 0);
    return () => clearTimeout(t);
    // Only run on mount; parent uses key to remount when initialIndex must change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(
    (offsetY: number) => {
      const idx = Math.round(offsetY / ITEM_H);
      const clamped = Math.max(0, Math.min(idx, data.length - 1));
      setLocalIdx(clamped);
      onChange(clamped);
    },
    [data.length, onChange],
  );

  const handleMomentumEnd = useCallback(
    (e: ScrollEndEvent) => commit(e.nativeEvent.contentOffset.y),
    [commit],
  );

  // Handle slow drags that produce no momentum
  const handleDragEnd = useCallback(
    (e: ScrollEndEvent) => {
      const vel = e.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(vel) < 0.1) {
        commit(e.nativeEvent.contentOffset.y);
      }
    },
    [commit],
  );

  return (
    <View style={spinStyles.col}>
      {/* Center-item highlight strip */}
      <View style={spinStyles.highlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={spinStyles.content}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleDragEnd}
      >
        {data.map((item, i) => (
          <View key={i} style={spinStyles.item}>
            <Text
              style={[
                spinStyles.itemText,
                i === localIdx && spinStyles.itemTextSelected,
              ]}
            >
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const spinStyles = StyleSheet.create({
  col: {
    flex: 1,
    height: VISIBLE * ITEM_H,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: PAD * ITEM_H,
    left: 4,
    right: 4,
    height: ITEM_H,
    backgroundColor: colors.border,
    borderRadius: radii.sm,
    zIndex: 1,
  },
  content: {
    paddingVertical: PAD * ITEM_H,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: colors.textSecondary,
    fontSize: typography.size.lg,
  },
  itemTextSelected: {
    color: colors.white,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
});

// ── DateField ─────────────────────────────────────────────────────────────────

interface DateFieldProps {
  label: string;
  value: string | undefined;
  onChange: (iso: string | undefined) => void;
  t: (key: string) => string;
}

export function DateField({ label, value, onChange, t }: DateFieldProps) {
  const { i18n } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  // Incrementing this key remounts all spinners when the modal opens with new values
  const [pickerKey, setPickerKey] = useState(0);

  const today = useMemo(() => new Date(), []);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth());
  const [pickerDay, setPickerDay] = useState(today.getDate());

  const openPicker = useCallback(() => {
    if (value) {
      const parts = value.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0])) {
        setPickerYear(parts[0]);
        setPickerMonth(parts[1] - 1);
        setPickerDay(parts[2]);
      } else {
        setPickerYear(today.getFullYear());
        setPickerMonth(today.getMonth());
        setPickerDay(today.getDate());
      }
    } else {
      setPickerYear(today.getFullYear());
      setPickerMonth(today.getMonth());
      setPickerDay(today.getDate());
    }
    setPickerKey((k) => k + 1);
    setShowModal(true);
  }, [value, today]);

  const handleConfirm = useCallback(() => {
    const maxD = daysInMonth(pickerYear, pickerMonth);
    onChange(toIso(pickerYear, pickerMonth, Math.min(pickerDay, maxD)));
    setShowModal(false);
  }, [onChange, pickerYear, pickerMonth, pickerDay]);

  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  // Locale-aware short month names
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(i18n.language, { month: 'short' }).format(
          new Date(2000, i, 1),
        ),
      ),
    [i18n.language],
  );

  const maxDays = daysInMonth(pickerYear, pickerMonth);
  const days = useMemo(
    () =>
      Array.from({ length: maxDays }, (_, i) =>
        String(i + 1).padStart(2, '0'),
      ),
    [maxDays],
  );

  const yearIndex = Math.max(0, Math.min(pickerYear - YEAR_MIN, YEARS.length - 1));
  const monthIndex = pickerMonth;
  const dayIndex = Math.min(pickerDay - 1, maxDays - 1);

  const displayText = value
    ? formatDisplay(value, i18n.language)
    : t('date_field.placeholder');

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={styles.valueBtn} onPress={openPicker}>
          <Text style={[styles.valueText, !value && styles.placeholderText]}>
            {displayText}
          </Text>
          <Text style={styles.calIcon}>{'\uD83D\uDCC5'}</Text>
        </Pressable>
        {value ? (
          <Pressable style={styles.clearBtn} onPress={handleClear} hitSlop={8}>
            <Text style={styles.clearText}>{'\u2715'}</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Header bar */}
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable onPress={handleConfirm}>
                <Text style={styles.doneText}>{t('common.done')}</Text>
              </Pressable>
            </View>

            {/* Column labels */}
            <View style={styles.colLabels}>
              <Text style={styles.colLabel}>{t('date_field.year')}</Text>
              <Text style={styles.colLabel}>{t('date_field.month')}</Text>
              <Text style={styles.colLabel}>{t('date_field.day')}</Text>
            </View>

            {/* Spinner wheels — keyed so they remount when modal opens */}
            <View key={pickerKey} style={styles.pickersRow}>
              <SpinnerColumn
                key="year"
                data={YEARS}
                initialIndex={yearIndex}
                onChange={(i) => setPickerYear(YEAR_MIN + i)}
              />
              <SpinnerColumn
                key="month"
                data={months}
                initialIndex={monthIndex}
                onChange={setPickerMonth}
              />
              {/* key changes when maxDays changes (month change) to reset day column */}
              <SpinnerColumn
                key={`day-${maxDays}`}
                data={days}
                initialIndex={dayIndex}
                onChange={(i) => setPickerDay(i + 1)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  valueText: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
  placeholderText: {
    color: colors.textMuted,
  },
  calIcon: {
    fontSize: typography.size.md,
  },
  clearBtn: {
    padding: 8,
  },
  clearText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  doneText: {
    color: colors.accent,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  colLabels: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  colLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
  },
  pickersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
