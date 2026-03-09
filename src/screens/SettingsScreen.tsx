import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { getSession, signOut } from '../services/auth';
import { SyncEngine } from '../sync/engine';
import type { ObjectType, PrivacyTier } from '../db/types';
import { colors, typography, spacing, radii, layout } from '../theme';

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

  // Auth state
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabledState] = useState(false);

  // Expand/collapse pickers
  const [showInstitutionType, setShowInstitutionType] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showObjectType, setShowObjectType] = useState(false);

  const appVersion = '0.1.0';

  const load = useCallback(async () => {
    const [name, instType, privacy, objType, lang, storageStats, syncEn] =
      await Promise.all([
        getSetting(db, SETTING_KEYS.INSTITUTION_NAME),
        getSetting(db, SETTING_KEYS.INSTITUTION_TYPE),
        getSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER),
        getSetting(db, SETTING_KEYS.DEFAULT_OBJECT_TYPE),
        getSetting(db, SETTING_KEYS.LANGUAGE),
        getStorageStats(db),
        getSetting(db, SETTING_KEYS.SYNC_ENABLED),
      ]);
    setInstitutionName(name ?? '');
    setInstitutionType((instType as InstitutionType) ?? '');
    setDefaultPrivacy((privacy as PrivacyTier) ?? 'public');
    setDefaultObjectType((objType as ObjectType) ?? 'museum_object');
    if (lang) setLanguage(lang);
    setStats(storageStats);
    setSyncEnabledState(syncEn === 'true');

    // Check auth
    const session = await getSession();
    setUserEmail(session?.user?.email ?? null);
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

  const handleSignOut = useCallback(() => {
    Alert.alert(t('auth.sign_out'), t('auth.sign_out_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.sign_out'),
        style: 'destructive',
        onPress: async () => {
          await signOut(db);
          setSyncEnabledState(false);
          setUserEmail(null);
        },
      },
    ]);
  }, [db, t]);

  const handleSyncNow = useCallback(() => {
    const engine = new SyncEngine(db);
    engine.triggerSync();
  }, [db]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Account ──────────────────────────────────────── */}
        {userEmail && (
          <>
            <Text style={styles.sectionHeader}>{t('settings.account')}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>{t('settings.signed_in_as')}</Text>
              <Text style={styles.valueText} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('settings.sync_status')}</Text>
              <Text style={styles.valueText}>
                {syncEnabled ? t('sync.enabled') : t('sync.disabled')}
              </Text>
            </View>
            {syncEnabled && (
              <Pressable style={styles.syncNowBtn} onPress={handleSyncNow}>
                <Text style={styles.syncNowText}>{t('sync.sync_now')}</Text>
              </Pressable>
            )}
            <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>{t('auth.sign_out')}</Text>
            </Pressable>
          </>
        )}

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
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Institution Type */}
        <Pressable
          style={styles.row}
          onPress={() => setShowInstitutionType(!showInstitutionType)}
        >
          <Text style={styles.label}>{t('settings.institution_type_label')}</Text>
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
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 60,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
  valueText: {
    color: colors.accent,
    fontSize: typography.size.base,
    flexShrink: 1,
    marginLeft: spacing.sm,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.size.base,
    textAlign: 'right',
    marginLeft: spacing.md,
    padding: 0,
  },
  descriptionText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: -4,
    marginBottom: spacing.xs,
  },
  pickerContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  pickerOptionActive: {
    backgroundColor: colors.borderLight,
  },
  pickerOptionText: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
  },
  pickerOptionTextActive: {
    color: colors.accent,
    fontWeight: typography.weight.semibold,
  },
  pickerDescText: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  checkmark: {
    color: colors.accent,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  statsGrid: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  statLabel: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
  },
  statValue: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  aboutBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  appName: {
    color: colors.textPrimary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm,
  },
  aboutDetail: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },
  syncNowBtn: {
    backgroundColor: colors.borderLight,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncNowText: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  signOutBtn: {
    backgroundColor: colors.dangerLight,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.dangerLight,
  },
  signOutText: {
    color: colors.danger,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
