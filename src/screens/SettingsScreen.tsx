import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import i18n from 'i18next';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import {
  getSetting,
  setSetting,
  getStorageStats,
  SETTING_KEYS,
  INSTITUTION_TYPES,
  type StorageStats,
  type InstitutionType,
} from '../services/settingsService';
import type { ObjectType, PrivacyTier } from '../db/types';

const OBJECT_TYPES: ObjectType[] = [
  'museum_object',
  'site',
  'incident',
  'specimen',
  'architectural_element',
  'environmental_sample',
  'conservation_record',
];

const PRIVACY_TIERS: PrivacyTier[] = ['public', 'confidential', 'anonymous'];

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
  { code: 'de', label: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
] as const;

export function SettingsScreen() {
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType | ''>('');
  const [defaultPrivacy, setDefaultPrivacy] = useState<PrivacyTier>('public');
  const [defaultObjectType, setDefaultObjectType] = useState<ObjectType>('museum_object');
  const [language, setLanguage] = useState(i18n.language);
  const [stats, setStats] = useState<StorageStats | null>(null);

  // Expand/collapse pickers
  const [showInstitutionType, setShowInstitutionType] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showObjectType, setShowObjectType] = useState(false);

  const appVersion = '0.1.0';

  const load = useCallback(async () => {
    const [name, instType, privacy, objType, lang, storageStats] =
      await Promise.all([
        getSetting(db, SETTING_KEYS.INSTITUTION_NAME),
        getSetting(db, SETTING_KEYS.INSTITUTION_TYPE),
        getSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER),
        getSetting(db, SETTING_KEYS.DEFAULT_OBJECT_TYPE),
        getSetting(db, SETTING_KEYS.LANGUAGE),
        getStorageStats(db),
      ]);
    setInstitutionName(name ?? '');
    setInstitutionType((instType as InstitutionType) ?? '');
    setDefaultPrivacy((privacy as PrivacyTier) ?? 'public');
    setDefaultObjectType((objType as ObjectType) ?? 'museum_object');
    if (lang) setLanguage(lang);
    setStats(storageStats);
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNameBlur = useCallback(async () => {
    await setSetting(db, SETTING_KEYS.INSTITUTION_NAME, institutionName.trim());
  }, [db, institutionName]);

  const handleInstitutionTypeSelect = useCallback(
    async (type: InstitutionType) => {
      setInstitutionType(type);
      setShowInstitutionType(false);
      await setSetting(db, SETTING_KEYS.INSTITUTION_TYPE, type);
    },
    [db],
  );

  const handlePrivacySelect = useCallback(
    async (tier: PrivacyTier) => {
      setDefaultPrivacy(tier);
      setShowPrivacy(false);
      await setSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER, tier);
    },
    [db],
  );

  const handleObjectTypeSelect = useCallback(
    async (type: ObjectType) => {
      setDefaultObjectType(type);
      setShowObjectType(false);
      await setSetting(db, SETTING_KEYS.DEFAULT_OBJECT_TYPE, type);
    },
    [db],
  );

  const handleLanguageSelect = useCallback(
    async (code: string) => {
      setLanguage(code);
      i18n.changeLanguage(code);
      await setSetting(db, SETTING_KEYS.LANGUAGE, code);
    },
    [db],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Institution ────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>{t('settings.institution')}</Text>

        {/* Institution Name */}
        <View style={styles.row}>
          <Text style={styles.label}>{t('settings.institution_name')}</Text>
          <TextInput
            style={styles.textInput}
            value={institutionName}
            onChangeText={setInstitutionName}
            onBlur={handleNameBlur}
            placeholder={t('settings.institution_name_placeholder')}
            placeholderTextColor="#636E72"
          />
        </View>

        {/* Institution Type */}
        <Pressable
          style={styles.row}
          onPress={() => setShowInstitutionType(!showInstitutionType)}
        >
          <Text style={styles.label}>{t('settings.institution_type')}</Text>
          <Text style={styles.valueText}>
            {institutionType
              ? t(`settings.institution_type.${institutionType}`)
              : '\u2014'}
          </Text>
        </Pressable>
        {showInstitutionType && (
          <View style={styles.pickerContainer}>
            {INSTITUTION_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.pickerOption,
                  institutionType === type && styles.pickerOptionActive,
                ]}
                onPress={() => handleInstitutionTypeSelect(type)}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    institutionType === type && styles.pickerOptionTextActive,
                  ]}
                >
                  {t(`settings.institution_type.${type}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Default Privacy Tier */}
        <Pressable
          style={styles.row}
          onPress={() => setShowPrivacy(!showPrivacy)}
        >
          <Text style={styles.label}>{t('settings.default_privacy')}</Text>
          <Text style={styles.valueText}>
            {t(`settings.privacy.${defaultPrivacy}`)}
          </Text>
        </Pressable>
        <Text style={styles.descriptionText}>
          {t('settings.default_privacy_description')}
        </Text>
        {showPrivacy && (
          <View style={styles.pickerContainer}>
            {PRIVACY_TIERS.map((tier) => (
              <Pressable
                key={tier}
                style={[
                  styles.pickerOption,
                  defaultPrivacy === tier && styles.pickerOptionActive,
                ]}
                onPress={() => handlePrivacySelect(tier)}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    defaultPrivacy === tier && styles.pickerOptionTextActive,
                  ]}
                >
                  {t(`settings.privacy.${tier}`)}
                </Text>
                <Text style={styles.pickerDescText}>
                  {t(`settings.privacy.${tier}_desc`)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Default Object Type */}
        <Pressable
          style={styles.row}
          onPress={() => setShowObjectType(!showObjectType)}
        >
          <Text style={styles.label}>{t('settings.default_object_type')}</Text>
          <Text style={styles.valueText}>
            {t(`object_types.${defaultObjectType}`)}
          </Text>
        </Pressable>
        {showObjectType && (
          <View style={styles.pickerContainer}>
            {OBJECT_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.pickerOption,
                  defaultObjectType === type && styles.pickerOptionActive,
                ]}
                onPress={() => handleObjectTypeSelect(type)}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    defaultObjectType === type && styles.pickerOptionTextActive,
                  ]}
                >
                  {t(`object_types.${type}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Language ───────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>{t('settings.language')}</Text>
        {LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            style={styles.row}
            onPress={() => handleLanguageSelect(lang.code)}
          >
            <Text style={styles.label}>
              {lang.flag} {lang.label}
            </Text>
            {language === lang.code && (
              <Text style={styles.checkmark}>{'\u2713'}</Text>
            )}
          </Pressable>
        ))}

        {/* ── Storage ────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>{t('settings.storage')}</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('settings.object_count')}</Text>
            <Text style={styles.statValue}>{stats?.objectCount ?? 0}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('settings.media_count')}</Text>
            <Text style={styles.statValue}>{stats?.mediaCount ?? 0}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>
              {t('settings.collection_count')}
            </Text>
            <Text style={styles.statValue}>
              {stats?.collectionCount ?? 0}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('settings.pending_sync')}</Text>
            <Text style={styles.statValue}>
              {stats?.pendingSyncCount ?? 0}
            </Text>
          </View>
        </View>

        {/* ── About ──────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>{t('settings.about')}</Text>
        <View style={styles.aboutBlock}>
          <Text style={styles.appName}>aha! Register</Text>
          <Text style={styles.aboutDetail}>
            {t('settings.version')} {appVersion}
          </Text>
          <Text style={styles.aboutDetail}>{t('settings.powered_by')}</Text>
        </View>
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
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  sectionHeader: {
    color: '#636E72',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  label: {
    color: '#DFE6E9',
    fontSize: 15,
  },
  valueText: {
    color: '#74B9FF',
    fontSize: 14,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'right',
    marginLeft: 12,
    padding: 0,
  },
  descriptionText: {
    color: '#636E72',
    fontSize: 12,
    marginTop: -4,
    marginBottom: 4,
  },
  pickerContainer: {
    backgroundColor: '#0A0A14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.12)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  pickerOptionActive: {
    backgroundColor: 'rgba(116,185,255,0.08)',
  },
  pickerOptionText: {
    color: '#DFE6E9',
    fontSize: 14,
  },
  pickerOptionTextActive: {
    color: '#74B9FF',
    fontWeight: '600',
  },
  pickerDescText: {
    color: '#636E72',
    fontSize: 11,
    marginTop: 2,
  },
  checkmark: {
    color: '#74B9FF',
    fontSize: 18,
    fontWeight: '700',
  },
  statsGrid: {
    backgroundColor: '#0A0A14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.08)',
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  statLabel: {
    color: '#DFE6E9',
    fontSize: 14,
  },
  statValue: {
    color: '#74B9FF',
    fontSize: 14,
    fontWeight: '600',
  },
  aboutBlock: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  aboutDetail: {
    color: '#636E72',
    fontSize: 13,
    marginTop: 4,
  },
});
