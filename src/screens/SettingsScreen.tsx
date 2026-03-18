import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import i18n from 'i18next';
import Constants from 'expo-constants';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { useSettings } from '../hooks/useSettings';
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
import {
  Card,
  Divider,
  ListItem,
  MetadataRow,
  SectionHeader,
  TextInput,
} from '../components/ui';
import {
  CheckIcon,
  DeleteIcon,
  ExportIcon,
  IncidentIcon,
  MuseumObjectIcon,
  ObjectsTabIcon,
  SignOutIcon,
  SiteIcon,
  SpecimenIcon,
  ConservationRecordIcon,
} from '../theme/icons';
import { colors, spacing, touch, typography } from '../theme';
import type { PrivacyTier, ObjectType } from '../db/types';
import type { CollectionDomain } from '../hooks/useSettings';

// ── Constants ─────────────────────────────────────────────────────────────────

const APP_VERSION = Constants.expoConfig?.version ?? '0.1.0';
const APP_BUILD =
  Constants.expoConfig?.android?.versionCode?.toString() ??
  Constants.expoConfig?.ios?.buildNumber ??
  Constants.expoConfig?.runtimeVersion?.toString() ??
  APP_VERSION;

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

interface DomainOption {
  value: CollectionDomain;
  icon: React.ReactNode;
}

const DOMAIN_OPTIONS: DomainOption[] = [
  {
    value: 'museum_collection',
    icon: <MuseumObjectIcon size={22} color={colors.primary} />,
  },
  {
    value: 'archaeological_site',
    icon: <SiteIcon size={22} color={colors.primary} />,
  },
  {
    value: 'conservation_lab',
    icon: <ConservationRecordIcon size={22} color={colors.primary} />,
  },
  {
    value: 'natural_history',
    icon: <SpecimenIcon size={22} color={colors.primary} />,
  },
  {
    value: 'human_rights',
    icon: <IncidentIcon size={22} color={colors.primary} />,
  },
  {
    value: 'general',
    icon: <ObjectsTabIcon size={22} color={colors.primary} />,
  },
];

// ── Storage size calculation ──────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function computeStorageSize(
  db: import('expo-sqlite').SQLiteDatabase,
): Promise<string> {
  // Race the DB query against a 5-second timeout
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 5000),
  );
  const query = (async () => {
    // Sum file_size from media table (best available proxy for storage)
    const row = await db.getFirstAsync<{ total: number | null }>(
      'SELECT SUM(file_size) as total FROM media',
    );
    // Also estimate DB size via page_count * page_size
    const dbSize = await db.getFirstAsync<{ size: number | null }>(
      'SELECT (page_count * page_size) as size FROM pragma_page_count(), pragma_page_size()',
    );
    const mediaBytes = row?.total ?? 0;
    const dbBytes = dbSize?.size ?? 0;
    return formatBytes(mediaBytes + dbBytes);
  })();

  return Promise.race([query, timeout]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const db = useDatabase();
  const { t } = useAppTranslation();

  // AsyncStorage settings (AI, domain)
  const {
    aiAnalysisEnabled,
    showConfidenceScores,
    collectionDomain,
    setAIAnalysisEnabled,
    setShowConfidenceScores,
    setCollectionDomain,
  } = useSettings();

  // SQLite-backed settings (institution, language, privacy, objectType)
  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType | ''>(
    '',
  );
  const [defaultPrivacy, setDefaultPrivacy] = useState<PrivacyTier>('public');
  const [defaultObjectType, setDefaultObjectType] =
    useState<ObjectType>('museum_object');
  const [language, setLanguage] = useState(i18n.language);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [storageDisplay, setStorageDisplay] = useState<string | null>(null);

  // Auth
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(false);

  // Pickers open state
  const [showInstitutionType, setShowInstitutionType] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showObjectType, setShowObjectType] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

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
    setSyncEnabled(syncEn === 'true');

    const session = await getSession();
    setUserEmail(session?.user?.email ?? null);

    // Calculate storage size with 5s timeout
    computeStorageSize(db).then(setStorageDisplay).catch(() => {
      setStorageDisplay(null);
    });
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Institution handlers ────────────────────────────────────────────────────

  const handleNameChange = useCallback(
    async (text: string) => {
      setInstitutionName(text);
      await setSetting(db, SETTING_KEYS.INSTITUTION_NAME, text.trim());
    },
    [db],
  );

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

  // ── Auth handlers ───────────────────────────────────────────────────────────

  const handleSignOut = useCallback(() => {
    Alert.alert(t('auth.sign_out'), t('auth.sign_out_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.sign_out'),
        style: 'destructive',
        onPress: async () => {
          await signOut(db);
          setSyncEnabled(false);
          setUserEmail(null);
        },
      },
    ]);
  }, [db, t]);

  // ── Data handlers ───────────────────────────────────────────────────────────

  const handleClearData = useCallback(() => {
    Alert.alert(
      t('settings.clearDataTitle'),
      t('settings.clearDataConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.clearData'),
          style: 'destructive',
          onPress: async () => {
            try {
              await db.execAsync('DELETE FROM objects');
              await db.execAsync('DELETE FROM sync_queue');
              await db.execAsync('DELETE FROM audit_trail');
              await load();
            } catch {
              Alert.alert(t('common.error'));
            }
          },
        },
      ],
    );
  }, [db, load, t]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">{t('settings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Account ────────────────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.account')} />
        <Card>
          <MetadataRow
            label={t('settings.signed_in_as')}
            value={userEmail ?? t('auth.continue_without')}
          />
          <MetadataRow
            label={t('settings.organisation')}
            value={institutionName || t('settings.personal')}
          />
          {syncEnabled && (
            <MetadataRow
              label={t('settings.sync_status')}
              value={t('sync.enabled')}
            />
          )}
          <Divider />
          <Pressable
            onPress={handleSignOut}
            hitSlop={touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('auth.sign_out')}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.pressed,
            ]}
          >
            <SignOutIcon size={20} color={colors.error} />
            <Text style={styles.dangerText}>{t('auth.sign_out')}</Text>
          </Pressable>
        </Card>

        {/* ── Institution ──────────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.institution')} />
        <Card>
          <TextInput
            label={t('settings.institution_name')}
            value={institutionName}
            onChangeText={handleNameChange}
            placeholder={t('settings.institution_name_placeholder')}
            autoCapitalize="words"
          />
          <View style={styles.cardGap} />

          {/* Institution Type picker */}
          <MetadataRow
            label={t('settings.institution_type_label')}
            value={
              institutionType
                ? t(`settings.institution_type.${institutionType}`)
                : undefined
            }
            onPress={() => setShowInstitutionType(!showInstitutionType)}
          />
          {showInstitutionType && (
            <View style={styles.pickerList}>
              {INSTITUTION_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => handleInstitutionTypeSelect(type)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t(`settings.institution_type.${type}`)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    institutionType === type && styles.pickerRowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      institutionType === type && styles.pickerTextActive,
                    ]}
                  >
                    {t(`settings.institution_type.${type}`)}
                  </Text>
                  {institutionType === type && (
                    <CheckIcon size={16} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Default Privacy picker */}
          <MetadataRow
            label={t('settings.default_privacy')}
            value={t(`settings.privacy.${defaultPrivacy}`)}
            onPress={() => setShowPrivacy(!showPrivacy)}
          />
          {showPrivacy && (
            <View style={styles.pickerList}>
              {PRIVACY_TIERS.map((tier) => (
                <Pressable
                  key={tier}
                  onPress={() => handlePrivacySelect(tier)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t(`settings.privacy.${tier}`)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    defaultPrivacy === tier && styles.pickerRowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.pickerContent}>
                    <Text
                      style={[
                        styles.pickerText,
                        defaultPrivacy === tier && styles.pickerTextActive,
                      ]}
                    >
                      {t(`settings.privacy.${tier}`)}
                    </Text>
                    <Text style={styles.pickerSubtext}>
                      {t(`settings.privacy.${tier}_desc`)}
                    </Text>
                  </View>
                  {defaultPrivacy === tier && (
                    <CheckIcon size={16} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Default Object Type picker */}
          <MetadataRow
            label={t('settings.default_object_type')}
            value={t(`object_types.${defaultObjectType}`)}
            onPress={() => setShowObjectType(!showObjectType)}
          />
          {showObjectType && (
            <View style={styles.pickerList}>
              {OBJECT_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => handleObjectTypeSelect(type)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t(`object_types.${type}`)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    defaultObjectType === type && styles.pickerRowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      defaultObjectType === type && styles.pickerTextActive,
                    ]}
                  >
                    {t(`object_types.${type}`)}
                  </Text>
                  {defaultObjectType === type && (
                    <CheckIcon size={16} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        {/* ── AI Features ──────────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.aiFeatures')} />
        <Card>
          {/* AI Analysis toggle */}
          <View
            style={styles.toggleRow}
            accessibilityRole="none"
          >
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>{t('settings.aiAnalysis')}</Text>
              <Text style={styles.toggleSubtitle}>
                {t('settings.aiAnalysisDescription')}
              </Text>
            </View>
            <Switch
              value={aiAnalysisEnabled}
              onValueChange={setAIAnalysisEnabled}
              trackColor={{
                false: colors.border,
                true: colors.primaryLight,
              }}
              thumbColor={
                aiAnalysisEnabled ? colors.primary : colors.textTertiary
              }
              accessibilityLabel={t('settings.aiAnalysis')}
              accessibilityRole="switch"
              accessibilityState={{ checked: aiAnalysisEnabled }}
            />
          </View>

          <Divider />

          {/* Confidence Scores toggle */}
          <View
            style={styles.toggleRow}
            accessibilityRole="none"
          >
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>
                {t('settings.confidenceScores')}
              </Text>
              <Text style={styles.toggleSubtitle}>
                {t('settings.confidenceScoresDescription')}
              </Text>
            </View>
            <Switch
              value={showConfidenceScores}
              onValueChange={setShowConfidenceScores}
              trackColor={{
                false: colors.border,
                true: colors.primaryLight,
              }}
              thumbColor={
                showConfidenceScores ? colors.primary : colors.textTertiary
              }
              accessibilityLabel={t('settings.confidenceScores')}
              accessibilityRole="switch"
              accessibilityState={{ checked: showConfidenceScores }}
            />
          </View>
        </Card>

        {/* ── Collection Type ───────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.collectionType')} />
        <Card>
          <Text style={styles.sectionDescription}>
            {t('settings.collectionTypeDescription')}
          </Text>
          <View style={styles.domainList}>
            {DOMAIN_OPTIONS.map((option) => {
              const isSelected = collectionDomain === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setCollectionDomain(option.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={t(
                    `settings.domain.${option.value}`,
                  )}
                  accessibilityState={{ checked: isSelected }}
                  style={({ pressed }) => [
                    styles.domainRow,
                    isSelected && styles.domainRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.domainIcon}>{option.icon}</View>
                  <View style={styles.domainContent}>
                    <Text
                      style={[
                        styles.domainLabel,
                        isSelected && styles.domainLabelSelected,
                      ]}
                    >
                      {t(`settings.domain.${option.value}`)}
                    </Text>
                    <Text style={styles.domainDescription}>
                      {t(`settings.domain.${option.value}_desc`)}
                    </Text>
                  </View>
                  {isSelected && (
                    <CheckIcon size={18} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* ── Language ─────────────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.language')} />
        <Card>
          {LANGUAGES.map((lang, idx) => (
            <View key={lang.code}>
              <MetadataRow
                label={`${lang.flag}\u2002${lang.label}`}
                value={language === lang.code ? '\u2713' : undefined}
                onPress={() => handleLanguageSelect(lang.code)}
              />
              {idx < LANGUAGES.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        {/* ── Data & Storage ────────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.dataStorage')} />
        <Card>
          <MetadataRow
            label={t('settings.localObjects')}
            value={String(stats?.objectCount ?? 0)}
          />
          <MetadataRow
            label={t('settings.pending_sync')}
            value={String(stats?.pendingSyncCount ?? 0)}
          />
          <MetadataRow
            label={t('settings.storageUsed')}
            value={
              storageDisplay ??
              (stats ? t('settings.storageUnavailable') : t('settings.storageCalculating'))
            }
          />
          <Divider />
          <ListItem
            title={t('settings.exportAllData')}
            rightElement={<ExportIcon size={18} color={colors.textTertiary} />}
            onPress={() => {}}
          />
          <Pressable
            onPress={handleClearData}
            hitSlop={touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('settings.clearData')}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.pressed,
            ]}
          >
            <DeleteIcon size={20} color={colors.error} />
            <Text style={styles.dangerText}>{t('settings.clearData')}</Text>
          </Pressable>
        </Card>

        {/* ── About ────────────────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.about')} />
        <Card>
          <MetadataRow
            label={t('settings.version')}
            value={APP_VERSION}
          />
          <MetadataRow
            label={t('settings.build')}
            value={APP_BUILD}
          />
          <Divider />
          <ListItem
            title={t('settings.licenses')}
            onPress={() => {}}
          />
        </Card>

        <View style={{ height: spacing['2xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  // Card gap for TextInput spacing
  cardGap: {
    height: spacing.sm,
  },
  // Picker
  pickerList: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerRowActive: {
    backgroundColor: colors.primarySurface,
  },
  pickerText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  pickerTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  pickerContent: {
    flex: 1,
  },
  pickerSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.minTarget,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  toggleSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Domain selector
  sectionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  domainList: {
    gap: spacing.xs,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.minTarget,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.sm,
    gap: spacing.md,
  },
  domainRowSelected: {
    backgroundColor: colors.primarySurface,
  },
  domainIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  domainContent: {
    flex: 1,
  },
  domainLabel: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  domainLabelSelected: {
    color: colors.primary,
  },
  domainDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Danger action rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touch.minTarget,
    paddingVertical: spacing.sm,
  },
  dangerText: {
    ...typography.bodyMedium,
    color: colors.error,
  },
  pressed: {
    opacity: 0.7,
  },
});
