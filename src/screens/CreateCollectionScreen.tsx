import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { createCollection } from '../services/collectionService';
import type { CollectionStackParamList } from '../navigation/CollectionStack';
import { typography, spacing, radii, layout } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme } from '../theme/ThemeContext';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
    try {
      await createCollection(db, {
        name: trimmed,
        collection_type: collectionType,
        description: description.trim() || undefined,
      });
      navigation.goBack();
    } catch (err: unknown) {
      console.error('createCollection failed:', err);
      Alert.alert(
        t('common.error'),
        String(err instanceof Error ? err.message : err),
      );
    } finally {
      setSaving(false);
    }
  }, [name, collectionType, description, db, navigation, t]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {t('collections.create_screen.title')}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t('common.save')}
          accessibilityState={{ disabled: saving }}
        >
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
                accessibilityRole="radio"
                accessibilityLabel={t(`collections.type.${type}`)}
                accessibilityState={{ checked: active }}
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
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerTitle: {
    ...typography.h4,
    color: c.text,
  },
  cancelText: {
    ...typography.bodyMedium,
    color: c.textSecondary,
  },
  saveText: {
    ...typography.bodyMedium,
    color: c.accent,
  },
  saveTextDisabled: {
    opacity: 0.4,
  },
  body: {
    paddingHorizontal: layout.screenPadding,
  },
  label: {
    color: c.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    marginTop: layout.screenPadding,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: c.borderLight,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    color: c.textPrimary,
    fontSize: typography.size.md,
    padding: 14,
  },
  inputError: {
    borderColor: c.danger,
  },
  errorText: {
    color: c.danger,
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
    borderColor: c.border,
    backgroundColor: 'transparent',
  },
  typeBadgeActive: {
    backgroundColor: c.heroGreen,
    borderColor: c.heroGreen,
  },
  typeBadgeText: {
    color: c.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  typeBadgeTextActive: {
    color: c.white,
    fontWeight: typography.weight.semibold,
  },
}); }
