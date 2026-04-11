import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import i18n from 'i18next';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  ForwardIcon,
  IncidentIcon,
  MuseumObjectIcon,
  ObjectsTabIcon,
  SignOutIcon,
  SiteIcon,
  SpecimenIcon,
  ConservationRecordIcon,
} from '../theme/icons';
import { AlertCircle } from 'lucide-react-native';
import { radii, spacing, touch, typography } from '../theme';
import type { ColorPalette } from '../theme';
import { useTheme, type ThemePreference } from '../theme/ThemeContext';
import type { PrivacyTier, ObjectType } from '../db/types';
import type { CollectionDomain } from '../hooks/useSettings';

// ── Constants ─────────────────────────────────────────────────────────────────

const APP_VERSION = Constants.expoConfig?.version ?? '0.1.0';
const APP_BUILD =
  Constants.expoConfig?.android?.versionCode?.toString() ??
  Constants.expoConfig?.ios?.buildNumber ??
  Constants.expoConfig?.runtimeVersion?.toString() ??
  APP_VERSION;

// OTA update metadata — captured at boot; both can be null in dev/Expo Go
// or before any OTA has been applied to an embedded build.
const UPDATE_ID_SHORT =
  typeof Updates.updateId === 'string' && Updates.updateId.length > 0
    ? Updates.updateId.slice(0, 8)
    : null;
const UPDATE_CREATED_AT: Date | null =
  Updates.createdAt instanceof Date ? Updates.createdAt : null;

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

const DOMAIN_VALUES: CollectionDomain[] = [
  'museum_collection',
  'archaeological_site',
  'conservation_lab',
  'natural_history',
  'human_rights',
  'general',
];

const DOMAIN_ICON_MAP: Record<CollectionDomain, React.ComponentType<{ size: number; color: string }>> = {
  museum_collection: MuseumObjectIcon,
  archaeological_site: SiteIcon,
  conservation_lab: ConservationRecordIcon,
  natural_history: SpecimenIcon,
  human_rights: IncidentIcon,
  general: ObjectsTabIcon,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

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

const THEME_OPTIONS: { key: ThemePreference; labelKey: string }[] = [
  { key: 'system', labelKey: 'settings.theme_system' },
  { key: 'light', labelKey: 'settings.theme_light' },
  { key: 'dark', labelKey: 'settings.theme_dark' },
];

export function SettingsScreen() {
  const db = useDatabase();
  const { t } = useAppTranslation();
  const { colors, preference: themePref, setPreference: setThemePref } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

  // Sync diagnostics
  const [syncLastAttempt, setSyncLastAttempt] = useState<string | null>(null);
  const [syncLastResult, setSyncLastResult] = useState<string | null>(null);
  const [syncLastError, setSyncLastError] = useState<string | null>(null);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [syncRunning, setSyncRunning] = useState(false);

  // Domain picker collapse state
  const [domainExpanded, setDomainExpanded] = useState(!collectionDomain);

  // Camera settings
  const [cameraGrid, setCameraGrid] = useState(false);
  const [cameraFlashMode, setCameraFlashMode] = useState<'off' | 'on' | 'auto'>('off');

  // Pickers open state
  const [showInstitutionType, setShowInstitutionType] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showObjectType, setShowObjectType] = useState(false);
  const [showFlashMode, setShowFlashMode] = useState(false);

  // OTA update check state
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const [name, instType, privacy, objType, lang, storageStats, syncEn, flashMode, gridVal] =
      await Promise.all([
        getSetting(db, SETTING_KEYS.INSTITUTION_NAME),
        getSetting(db, SETTING_KEYS.INSTITUTION_TYPE),
        getSetting(db, SETTING_KEYS.DEFAULT_PRIVACY_TIER),
        getSetting(db, SETTING_KEYS.DEFAULT_OBJECT_TYPE),
        getSetting(db, SETTING_KEYS.LANGUAGE),
        getStorageStats(db),
        getSetting(db, SETTING_KEYS.SYNC_ENABLED),
        getSetting(db, SETTING_KEYS.CAMERA_FLASH_MODE),
        AsyncStorage.getItem('camera.gridEnabled'),
      ]);
    setInstitutionName(name ?? '');
    setInstitutionType((instType as InstitutionType) ?? '');
    setDefaultPrivacy((privacy as PrivacyTier) ?? 'public');
    setDefaultObjectType((objType as ObjectType) ?? 'museum_object');
    if (lang) setLanguage(lang);
    setStats(storageStats);
    setSyncEnabled(syncEn === 'true');
    if (flashMode === 'on' || flashMode === 'auto') setCameraFlashMode(flashMode);
    else setCameraFlashMode('off');
    setCameraGrid(gridVal === 'true');

    const session = await getSession();
    setUserEmail(session?.user?.email ?? null);

    // Sync diagnostics
    const [syncAttempt, syncResult, syncError, queueRows] = await Promise.all([
      getSetting(db, SETTING_KEYS.LAST_SYNC_ATTEMPT),
      getSetting(db, SETTING_KEYS.LAST_SYNC_RESULT),
      getSetting(db, SETTING_KEYS.LAST_SYNC_ERROR),
      db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM sync_queue WHERE status IN (\'pending\', \'failed\')'),
    ]);
    setSyncLastAttempt(syncAttempt);
    setSyncLastResult(syncResult);
    setSyncLastError(syncError && syncError.length > 0 ? syncError : null);
    setSyncQueueCount(queueRows?.cnt ?? 0);

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

  // ── Camera handlers ─────────────────────────────────────────────────────────

  const handleGridToggle = useCallback(
    async (value: boolean) => {
      setCameraGrid(value);
      await AsyncStorage.setItem('camera.gridEnabled', String(value));
    },
    [],
  );

  const handleFlashModeSelect = useCallback(
    async (mode: 'off' | 'on' | 'auto') => {
      setCameraFlashMode(mode);
      setShowFlashMode(false);
      await setSetting(db, SETTING_KEYS.CAMERA_FLASH_MODE, mode);
    },
    [db],
  );

  // ── Sync Now handler ────────────────────────────────────────────────────────

  const handleSyncNow = useCallback(async () => {
    if (syncRunning) return;
    setSyncRunning(true);
    try {
      const { SyncEngine } = await import('../sync/engine');
      const engine = new SyncEngine(db);
      await engine.sync();
    } catch {
      // error is persisted in SQLite by the engine
    } finally {
      setSyncRunning(false);
      // Reload sync diagnostics
      const [syncAttempt, syncResult, syncError, queueRows] = await Promise.all([
        getSetting(db, SETTING_KEYS.LAST_SYNC_ATTEMPT),
        getSetting(db, SETTING_KEYS.LAST_SYNC_RESULT),
        getSetting(db, SETTING_KEYS.LAST_SYNC_ERROR),
        db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM sync_queue WHERE status IN (\'pending\', \'failed\')'),
      ]);
      setSyncLastAttempt(syncAttempt);
      setSyncLastResult(syncResult);
      setSyncLastError(syncError && syncError.length > 0 ? syncError : null);
      setSyncQueueCount(queueRows?.cnt ?? 0);
    }
  }, [db, syncRunning]);

  // ── Coming soon stub ────────────────────────────────────────────────────────

  const handleComingSoon = useCallback(() => {
    Alert.alert(t('settings.comingSoon'), t('settings.comingSoonMessage'));
  }, [t]);

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

  // ── OTA update handler ──────────────────────────────────────────────────────

  const handleCheckUpdate = useCallback(async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        // Brief message before the reload takes effect.
        Alert.alert(t('settings.checkUpdate'), t('settings.updating'));
        await Updates.reloadAsync();
      } else {
        Alert.alert(t('settings.checkUpdate'), t('settings.noUpdate'));
      }
    } catch (err) {
      console.warn('[settings] check-for-update failed:', err);
      Alert.alert(t('settings.checkUpdate'), String(err));
    } finally {
      setCheckingUpdate(false);
    }
  }, [checkingUpdate, t]);

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
    <SafeAreaView style={styles.safe} edges={['top']}>
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

        {/* ── Sync Status (hidden in guest mode) ────────────────────────── */}
        {userEmail != null && (
          <>
            <SectionHeader title="Sync Status" />
            <Card>
              <MetadataRow label="Queue" value={`${syncQueueCount} pending`} />
              <MetadataRow
                label="Last attempt"
                value={syncLastAttempt ? formatDate(syncLastAttempt) : 'never'}
              />
              <MetadataRow
                label="Last result"
                value={syncLastResult ?? 'none'}
              />
              {syncLastError != null && (
                <View style={styles.syncErrorBox}>
                  <View style={styles.syncErrorHeader}>
                    <AlertCircle size={14} color={colors.error} />
                    <Text style={styles.syncErrorLabel}>Error</Text>
                  </View>
                  <Text style={styles.syncErrorText} selectable>{syncLastError}</Text>
                </View>
              )}
              <Divider />
              <Pressable
                onPress={handleSyncNow}
                hitSlop={touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Sync Now"
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.pressed,
                ]}
              >
                <ExportIcon size={20} color={syncRunning ? colors.textMuted : colors.accent} />
                <Text style={[styles.syncNowText, syncRunning && { color: colors.textMuted }]}>
                  {syncRunning ? 'Syncing...' : 'Sync Now'}
                </Text>
              </Pressable>
            </Card>
          </>
        )}

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
                    <CheckIcon size={16} color={colors.accent} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          <Divider />

          {/* Collection domain */}
          <Text style={styles.sectionDescription}>
            {t('settings.collectionTypeDescription')}
          </Text>

          {/* Collapsed: show selected domain + Change button */}
          {!domainExpanded && collectionDomain ? (() => {
            const SelectedIcon = DOMAIN_ICON_MAP[collectionDomain];
            return (
              <Pressable
                style={styles.domainCollapsed}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setDomainExpanded(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('settings.change_domain')}
              >
                {SelectedIcon && (
                  <View style={styles.domainIcon}>
                    <SelectedIcon size={22} color={colors.accent} />
                  </View>
                )}
                <View style={styles.domainContent}>
                  <Text style={styles.domainLabelSelected}>
                    {t(`settings.domain.${collectionDomain}`)}
                  </Text>
                  <Text style={styles.domainDescription}>
                    {t(`settings.domain.${collectionDomain}_desc`)}
                  </Text>
                </View>
                <Text style={styles.changeText}>
                  {t('settings.change_domain')}
                </Text>
                <ForwardIcon size={16} color={colors.textTertiary} />
              </Pressable>
            );
          })() : (
            <View style={styles.domainList}>
              {DOMAIN_VALUES.map((domainValue) => {
                const isSelected = collectionDomain === domainValue;
                const DomainIcon = DOMAIN_ICON_MAP[domainValue];
                return (
                  <Pressable
                    key={domainValue}
                    onPress={() => {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut,
                      );
                      setCollectionDomain(domainValue);
                      setDomainExpanded(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={t(`settings.domain.${domainValue}`)}
                    accessibilityState={{ checked: isSelected }}
                    style={({ pressed }) => [
                      styles.domainRow,
                      isSelected && styles.domainRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.domainIcon}>
                      <DomainIcon size={22} color={colors.accent} />
                    </View>
                    <View style={styles.domainContent}>
                      <Text
                        style={[
                          styles.domainLabel,
                          isSelected && styles.domainLabelSelected,
                        ]}
                      >
                        {t(`settings.domain.${domainValue}`)}
                      </Text>
                      <Text style={styles.domainDescription}>
                        {t(`settings.domain.${domainValue}_desc`)}
                      </Text>
                    </View>
                    {isSelected && (
                      <CheckIcon size={18} color={colors.accent} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Divider />

          {/* Language */}
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

          <Divider />

          {/* Theme */}
          <SectionHeader title={t('settings.theme')} />
          {THEME_OPTIONS.map((opt, idx) => (
            <View key={opt.key}>
              <MetadataRow
                label={t(opt.labelKey)}
                value={themePref === opt.key ? '\u2713' : undefined}
                onPress={() => setThemePref(opt.key)}
              />
              {idx < THEME_OPTIONS.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        {/* ── Capture ──────────────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.capture')} />
        <Card>
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
                    <CheckIcon size={16} color={colors.accent} />
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
                    <CheckIcon size={16} color={colors.accent} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          <Divider />

          {/* AI Analysis toggle */}
          <View style={styles.toggleRow} accessibilityRole="none">
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>{t('settings.aiAnalysis')}</Text>
              <Text style={styles.toggleSubtitle}>
                {t('settings.aiAnalysisDescription')}
              </Text>
            </View>
            <Switch
              value={aiAnalysisEnabled}
              onValueChange={setAIAnalysisEnabled}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={aiAnalysisEnabled ? colors.accent : colors.textTertiary}
              accessibilityLabel={t('settings.aiAnalysis')}
              accessibilityRole="switch"
              accessibilityState={{ checked: aiAnalysisEnabled }}
            />
          </View>

          <Divider />

          {/* Confidence Scores toggle */}
          <View style={styles.toggleRow} accessibilityRole="none">
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
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={showConfidenceScores ? colors.accent : colors.textTertiary}
              accessibilityLabel={t('settings.confidenceScores')}
              accessibilityRole="switch"
              accessibilityState={{ checked: showConfidenceScores }}
            />
          </View>

          <Divider />

          {/* Camera Grid toggle */}
          <View style={styles.toggleRow} accessibilityRole="none">
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>{t('settings.cameraGrid')}</Text>
              <Text style={styles.toggleSubtitle}>
                {t('settings.cameraGridDescription')}
              </Text>
            </View>
            <Switch
              value={cameraGrid}
              onValueChange={handleGridToggle}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={cameraGrid ? colors.accent : colors.textTertiary}
              accessibilityLabel={t('settings.cameraGrid')}
              accessibilityRole="switch"
              accessibilityState={{ checked: cameraGrid }}
            />
          </View>

          {/* Default Flash picker */}
          <MetadataRow
            label={t('settings.flashDefault')}
            value={t(`capture.flash_${cameraFlashMode}`)}
            onPress={() => setShowFlashMode(!showFlashMode)}
          />
          {showFlashMode && (
            <View style={styles.pickerList}>
              {(['off', 'on', 'auto'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => handleFlashModeSelect(mode)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t(`capture.flash_${mode}`)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    cameraFlashMode === mode && styles.pickerRowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      cameraFlashMode === mode && styles.pickerTextActive,
                    ]}
                  >
                    {t(`capture.flash_${mode}`)}
                  </Text>
                  {cameraFlashMode === mode && (
                    <CheckIcon size={16} color={colors.accent} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
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
            onPress={handleComingSoon}
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
          <MetadataRow
            label={t('settings.updateId')}
            value={UPDATE_ID_SHORT ?? undefined}
          />
          <MetadataRow
            label={t('settings.updatedAt')}
            value={UPDATE_CREATED_AT ? UPDATE_CREATED_AT.toLocaleDateString() : undefined}
          />
          <Pressable
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
            hitSlop={touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('settings.checkUpdate')}
            accessibilityState={{ disabled: checkingUpdate, busy: checkingUpdate }}
            style={({ pressed }) => [
              styles.checkUpdateBtn,
              pressed && !checkingUpdate && styles.pressed,
              checkingUpdate && styles.checkUpdateBtnDisabled,
            ]}
          >
            {checkingUpdate ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.checkUpdateBtnText}>{t('settings.checkUpdate')}</Text>
            )}
          </Pressable>
          <Divider />
          <ListItem
            title={t('settings.licenses')}
            onPress={handleComingSoon}
          />
        </Card>

        <View style={{ height: spacing['2xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
    },
    headerTitle: {
      ...typography.h1,
      color: c.text,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: 100,
    },
    // Card gap for TextInput spacing
    cardGap: {
      height: spacing.sm,
    },
    // Picker
    pickerList: {
      marginTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: touch.minTarget,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    pickerRowActive: {
      backgroundColor: c.accentLight,
    },
    pickerText: {
      ...typography.bodySmall,
      color: c.text,
      flex: 1,
    },
    pickerTextActive: {
      color: c.accent,
      fontWeight: '600',
    },
    pickerContent: {
      flex: 1,
    },
    pickerSubtext: {
      ...typography.caption,
      color: c.textSecondary,
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
      color: c.text,
    },
    toggleSubtitle: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: spacing.xs,
    },
    // Domain selector
    sectionDescription: {
      ...typography.bodySmall,
      color: c.textSecondary,
      marginBottom: spacing.md,
    },
    domainCollapsed: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: touch.minTarget,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: spacing.sm,
      backgroundColor: c.accentLight,
      gap: spacing.md,
    },
    changeText: {
      ...typography.caption,
      color: c.accent,
      fontWeight: '600',
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
      backgroundColor: c.accentLight,
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
      color: c.text,
    },
    domainLabelSelected: {
      color: c.accent,
    },
    domainDescription: {
      ...typography.caption,
      color: c.textSecondary,
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
      color: c.error,
    },
    pressed: {
      opacity: 0.7,
    },
    // Sync status
    syncErrorBox: {
      padding: spacing.sm,
      marginTop: spacing.xs,
      backgroundColor: c.errorLight,
      borderRadius: spacing.xs,
      borderLeftWidth: 3,
      borderLeftColor: c.error,
    },
    syncErrorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    syncErrorLabel: {
      ...typography.caption,
      color: c.error,
      fontWeight: '700',
    },
    syncErrorText: {
      ...typography.bodySmall,
      color: c.error,
    },
    syncNowText: {
      ...typography.bodyMedium,
      color: c.accent,
    },
    // OTA check-for-update button
    checkUpdateBtn: {
      backgroundColor: c.accent,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: touch.minTarget,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    checkUpdateBtnDisabled: {
      opacity: 0.6,
    },
    checkUpdateBtnText: {
      ...typography.body,
      color: c.white,
      fontWeight: typography.weight.bold,
    },
  });
}
