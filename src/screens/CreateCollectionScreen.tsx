import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { createCollection } from '../services/collectionService';
import type { CollectionStackParamList } from '../navigation/CollectionStack';
import { colors, typography, spacing, radii, layout } from '../theme';

type Props = NativeStackScreenProps<CollectionStackParamList, 'CreateCollection'>;

const COLLECTION_TYPES = [
  'general',
  'department',
  'exhibition',
  'project',
  'research',
  'conservation',
] as const;

type CollectionType = (typeof COLLECTION_TYPES)[number];

export function CreateCollectionScreen({ navigation }: Props) {
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [name, setName] = useState('');
  const [collectionType, setCollectionType] = useState<CollectionType>('general');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(true);
      return;
    }
    setSaving(true);
    await createCollection(db, {
      name: trimmed,
      collection_type: collectionType,
      description: description.trim() || undefined,
    });
    navigation.goBack();
  }, [name, collectionType, description, db, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('collections.create_screen.title')}
        </Text>
        <Pressable onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
            {t('common.save')}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <Text style={styles.label}>{t('collections.create_screen.name')}</Text>
        <TextInput
          style={[styles.input, nameError && styles.inputError]}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (nameError) setNameError(false);
          }}
          placeholder={t('collections.create_screen.name')}
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
        {nameError && (
          <Text style={styles.errorText}>
            {t('collections.create_screen.name_required')}
          </Text>
        )}

        {/* Type */}
        <Text style={styles.label}>{t('collections.create_screen.type')}</Text>
        <View style={styles.typeRow}>
          {COLLECTION_TYPES.map((type) => {
            const active = type === collectionType;
            return (
              <Pressable
                key={type}
                style={[styles.typeBadge, active && styles.typeBadgeActive]}
                onPress={() => setCollectionType(type)}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    active && styles.typeBadgeTextActive,
                  ]}
                >
                  {t(`collections.type.${type}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Description */}
        <Text style={styles.label}>
          {t('collections.create_screen.description')}
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('collections.create_screen.description')}
          placeholderTextColor={colors.textMuted}
          multiline
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
  },
  saveText: {
    color: colors.accent,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  saveTextDisabled: {
    opacity: 0.4,
  },
  body: {
    paddingHorizontal: layout.screenPadding,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    marginTop: layout.screenPadding,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.textPrimary,
    fontSize: typography.size.md,
    padding: 14,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.sm,
    marginTop: 6,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // eslint-disable-next-line react-native/no-color-literals
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  typeBadgeActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  typeBadgeText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  typeBadgeTextActive: {
    color: colors.white,
    fontWeight: typography.weight.semibold,
  },
});
