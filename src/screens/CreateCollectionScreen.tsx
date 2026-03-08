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
          placeholderTextColor="#4A4A5A"
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
          placeholderTextColor="#4A4A5A"
          multiline
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080F',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  cancelText: {
    color: '#636E72',
    fontSize: 16,
  },
  saveText: {
    color: '#74B9FF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveTextDisabled: {
    opacity: 0.4,
  },
  body: {
    paddingHorizontal: 20,
  },
  label: {
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.1)',
    borderRadius: 10,
    color: '#DFE6E9',
    fontSize: 15,
    padding: 14,
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 6,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.15)',
    backgroundColor: 'transparent',
  },
  typeBadgeActive: {
    backgroundColor: '#0984E3',
    borderColor: '#0984E3',
  },
  typeBadgeText: {
    color: '#636E72',
    fontSize: 13,
    fontWeight: '500',
  },
  typeBadgeTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
