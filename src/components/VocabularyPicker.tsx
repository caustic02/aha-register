// ── Phase 2: Live Getty SPARQL queries ──────────────────────────────────────
// When online, the picker can query Getty SPARQL for terms not in the bundle:
//   Endpoint: https://vocab.getty.edu/sparql
//   Pattern: Same SPARQL as scripts/extract-getty-vocabularies.ts but with
//            FILTER(CONTAINS(LCASE(?prefLabel), LCASE("user_input")))
//   Cache live results in AsyncStorage for future offline use.
// Implementation deferred to Phase 2; bundled data covers Phase 1.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
} from 'react-native';

import { colors, typography, spacing, radii, touch } from '../theme';
import { SearchIcon, CloseIcon } from '../theme/icons';
import type { GettyTerm, VocabularySelection } from '../data/getty/types';
import { cleanAatLabel } from '../utils/vocabulary';

// ── Props ────────────────────────────────────────────────────────────────────

interface VocabularyPickerProps {
  vocabulary: GettyTerm[];
  value: VocabularySelection | VocabularySelection[];
  onChange: (value: VocabularySelection | VocabularySelection[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  language: 'en' | 'de';
  label?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_DROPDOWN_ITEMS = 8;
const QUICK_SUGGESTIONS_COUNT = 8;
const DEBOUNCE_MS = 200;
const SEARCH_ICON_SIZE = 18;
const CHIP_CLOSE_ICON_SIZE = 14;

// ── Component ────────────────────────────────────────────────────────────────

export function VocabularyPicker({
  vocabulary,
  value,
  onChange,
  multiSelect = false,
  placeholder,
  language,
  label,
}: VocabularyPickerProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Normalise value to array for internal use ──────────────────────────────

  const selections: VocabularySelection[] = useMemo(
    () => (Array.isArray(value) ? value : value.uri !== null || value.label ? [value] : []),
    [value],
  );

  // ── Debounced search ───────────────────────────────────────────────────────

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  // ── Filter vocabulary ──────────────────────────────────────────────────────

  const filteredTerms = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    return vocabulary.filter((term) => {
      const matchEn = term.label_en.toLowerCase().includes(q);
      const matchDe = term.label_de ? term.label_de.toLowerCase().includes(q) : false;
      return matchEn || matchDe;
    });
  }, [debouncedQuery, vocabulary]);

  const visibleTerms = filteredTerms.slice(0, MAX_DROPDOWN_ITEMS);

  const hasExactMatch = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return true; // don't show custom option when empty
    return vocabulary.some(
      (t) =>
        t.label_en.toLowerCase() === q ||
        (t.label_de && t.label_de.toLowerCase() === q),
    );
  }, [debouncedQuery, vocabulary]);

  // ── Quick suggestions (first N from vocabulary) ────────────────────────────

  const quickSuggestions = useMemo(
    () => vocabulary.slice(0, QUICK_SUGGESTIONS_COUNT),
    [vocabulary],
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getDisplayLabel = useCallback(
    (term: GettyTerm): string =>
      cleanAatLabel(language === 'de' && term.label_de ? term.label_de : term.label_en),
    [language],
  );

  const isSelected = useCallback(
    (uri: string) => selections.some((s) => s.uri === uri),
    [selections],
  );

  // ── Selection handlers ─────────────────────────────────────────────────────

  const handleSelectTerm = useCallback(
    (term: GettyTerm) => {
      const selection: VocabularySelection = {
        label: getDisplayLabel(term),
        uri: term.uri,
      };

      if (multiSelect) {
        if (isSelected(term.uri)) {
          // Remove if already selected
          const next = selections.filter((s) => s.uri !== term.uri);
          onChange(next);
        } else {
          onChange([...selections, selection]);
        }
      } else {
        onChange(selection);
      }

      setQuery('');
      setDebouncedQuery('');
      setIsDropdownOpen(false);
    },
    [multiSelect, selections, onChange, getDisplayLabel, isSelected],
  );

  const handleSelectCustom = useCallback(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) return;

    const selection: VocabularySelection = {
      label: trimmed,
      uri: null,
    };

    if (multiSelect) {
      onChange([...selections, selection]);
    } else {
      onChange(selection);
    }

    setQuery('');
    setDebouncedQuery('');
    setIsDropdownOpen(false);
  }, [debouncedQuery, multiSelect, selections, onChange]);

  const handleRemoveSelection = useCallback(
    (index: number) => {
      if (multiSelect) {
        const next = selections.filter((_, i) => i !== index);
        onChange(next);
      } else {
        onChange({ label: '', uri: null });
      }
    },
    [multiSelect, selections, onChange],
  );

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    setIsDropdownOpen(true);
  }, []);

  // ── Extract short AAT id from URI ──────────────────────────────────────────

  const shortUri = (uri: string): string => {
    const parts = uri.split('/');
    return parts[parts.length - 1] ?? uri;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Field label */}
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}

      {/* Selected chips */}
      {selections.length > 0 && (
        <View style={styles.chipsContainer}>
          {selections.map((sel, idx) => (
            <View key={`${sel.uri ?? 'custom'}-${idx}`} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {sel.label}
              </Text>
              <TouchableOpacity
                onPress={() => handleRemoveSelection(idx)}
                hitSlop={touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${sel.label}`}
              >
                <CloseIcon
                  size={CHIP_CLOSE_ICON_SIZE}
                  color={colors.primary}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Search input */}
      <View style={styles.inputRow}>
        <SearchIcon
          size={SEARCH_ICON_SIZE}
          color={colors.textTertiary}
          strokeWidth={1.5}
        />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleQueryChange}
          placeholder={placeholder ?? (language === 'de' ? 'Suchen…' : 'Search…')}
          placeholderTextColor={colors.textTertiary}
          autoCorrect={false}
          autoCapitalize="none"
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => {
            // Delay close so tap on dropdown item registers first
            setTimeout(() => setIsDropdownOpen(false), 200);
          }}
          accessibilityLabel={label ?? 'Vocabulary search'}
        />
      </View>

      {/* Dropdown results */}
      {isDropdownOpen && debouncedQuery.trim().length > 0 && (
        <View style={styles.dropdown}>
          {/* Custom term option */}
          {!hasExactMatch && (
            <TouchableOpacity
              style={styles.dropdownItemCustom}
              onPress={handleSelectCustom}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.customTermLabel}>
                {language === 'de'
                  ? `„${debouncedQuery.trim()}" als eigenen Begriff verwenden`
                  : `Use "${debouncedQuery.trim()}" as custom term`}
              </Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={visibleTerms}
            keyExtractor={(item) => item.uri}
            keyboardShouldPersistTaps="handled"
            style={styles.dropdownList}
            renderItem={({ item }) => {
              const selected = isSelected(item.uri);
              return (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    selected && styles.dropdownItemSelected,
                  ]}
                  onPress={() => handleSelectTerm(item)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <View style={styles.dropdownItemContent}>
                    <Text style={styles.dropdownItemLabel} numberOfLines={1}>
                      {getDisplayLabel(item)}
                    </Text>
                    {item.parent_en ? (
                      <Text style={styles.dropdownItemParent} numberOfLines={1}>
                        {cleanAatLabel(item.parent_en)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.uriBadge}>
                    <Text style={styles.uriBadgeText}>{shortUri(item.uri)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              hasExactMatch ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {language === 'de' ? 'Keine Treffer' : 'No matches'}
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      )}

      {/* Quick suggestion chips */}
      {quickSuggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionsRow}
          contentContainerStyle={styles.suggestionsContent}
          keyboardShouldPersistTaps="handled"
        >
          {quickSuggestions.map((term) => {
            const selected = isSelected(term.uri);
            return (
              <TouchableOpacity
                key={term.uri}
                style={[
                  styles.suggestionChip,
                  selected && styles.suggestionChipSelected,
                ]}
                onPress={() => handleSelectTerm(term)}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.suggestionChipText,
                    selected && styles.suggestionChipTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {getDisplayLabel(term)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },

  // Label
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },

  // Selected chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    minHeight: touch.minTargetSmall,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.primary,
    flexShrink: 1,
  },

  // Search input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: touch.minTargetSmall,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },

  // Dropdown
  dropdown: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  dropdownList: {
    maxHeight: MAX_DROPDOWN_ITEMS * 56, // approx row height
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touch.minTargetSmall,
    gap: spacing.sm,
  },
  dropdownItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  dropdownItemContent: {
    flex: 1,
    gap: 2,
  },
  dropdownItemLabel: {
    ...typography.body,
    color: colors.text,
  },
  dropdownItemParent: {
    ...typography.caption,
    color: colors.textTertiary,
  },

  // URI badge
  uriBadge: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  uriBadgeText: {
    ...typography.mono,
    fontSize: 10,
    color: colors.textTertiary,
  },

  // Custom term option
  dropdownItemCustom: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touch.minTargetSmall,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'center',
  },
  customTermLabel: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },

  // Empty state
  emptyState: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },

  // Quick suggestions
  suggestionsRow: {
    flexGrow: 0,
  },
  suggestionsContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  suggestionChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: touch.minTargetSmall,
    justifyContent: 'center',
  },
  suggestionChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  suggestionChipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  suggestionChipTextSelected: {
    color: colors.primary,
  },
});

export default VocabularyPicker;
