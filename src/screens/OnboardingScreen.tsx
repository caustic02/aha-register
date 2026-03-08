import React, { useCallback, useState } from 'react';
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
  setSetting,
  SETTING_KEYS,
  INSTITUTION_TYPES,
  type InstitutionType,
} from '../services/settingsService';
import type { ObjectType } from '../db/types';

const OBJECT_TYPES: ObjectType[] = [
  'museum_object',
  'site',
  'incident',
  'specimen',
  'architectural_element',
  'environmental_sample',
  'conservation_record',
];

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
  { code: 'de', label: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
] as const;

const TOTAL_STEPS = 4;

interface OnboardingScreenProps {
  onFinish: () => void;
}

export function OnboardingScreen({ onFinish }: OnboardingScreenProps) {
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [step, setStep] = useState(0);
  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType | ''>('');
  const [defaultObjectType, setDefaultObjectType] = useState<ObjectType>('museum_object');
  const [language, setLanguage] = useState(i18n.language ?? 'en');
  const [showInstType, setShowInstType] = useState(false);
  const [showObjType, setShowObjType] = useState(false);

  const isLastStep = step === TOTAL_STEPS - 1;

  const handleLanguageChange = useCallback((code: string) => {
    setLanguage(code);
    i18n.changeLanguage(code);
  }, []);

  const handleFinish = useCallback(async () => {
    const saves: Promise<void>[] = [
      setSetting(db, SETTING_KEYS.DEFAULT_OBJECT_TYPE, defaultObjectType),
      setSetting(db, SETTING_KEYS.LANGUAGE, language),
      setSetting(db, SETTING_KEYS.ONBOARDING_COMPLETE, 'true'),
    ];
    if (institutionName.trim()) {
      saves.push(setSetting(db, SETTING_KEYS.INSTITUTION_NAME, institutionName.trim()));
    }
    if (institutionType) {
      saves.push(setSetting(db, SETTING_KEYS.INSTITUTION_TYPE, institutionType));
    }
    await Promise.all(saves);
    onFinish();
  }, [db, institutionName, institutionType, defaultObjectType, language, onFinish]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  }, [step, handleFinish]);

  const handleSkip = useCallback(() => {
    setStep(TOTAL_STEPS - 1);
  }, []);

  return (
    <View style={styles.container}>
      {/* Skip button — top right, only on info slides */}
      {!isLastStep && (
        <Pressable style={styles.skipBtn} onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </Pressable>
      )}

      {/* Slide content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <View style={styles.slide}>
            <View style={styles.iconWrap}>
              <Text style={styles.slideIcon}>{'\u25CE'}</Text>
            </View>
            <Text style={styles.appName}>aha! Register</Text>
            <Text style={styles.headline}>{t('onboarding.step_welcome_headline')}</Text>
            <Text style={styles.body}>{t('onboarding.step_welcome_body')}</Text>
          </View>
        )}

        {step === 1 && (
          <View style={styles.slide}>
            <View style={styles.iconWrap}>
              <Text style={styles.slideIcon}>{'\u2295'}</Text>
            </View>
            <Text style={styles.slideTitle}>{t('onboarding.step_capture_title')}</Text>
            <Text style={styles.body}>{t('onboarding.step_capture_body')}</Text>
            <View style={styles.featureRow}>
              <Text style={styles.featureDot}>{'\u2713'}</Text>
              <Text style={styles.featureText}>{t('onboarding.step_capture_f1')}</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureDot}>{'\u2713'}</Text>
              <Text style={styles.featureText}>{t('onboarding.step_capture_f2')}</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureDot}>{'\u2713'}</Text>
              <Text style={styles.featureText}>{t('onboarding.step_capture_f3')}</Text>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.slide}>
            <View style={styles.iconWrap}>
              <Text style={styles.slideIcon}>{'\u25C8'}</Text>
            </View>
            <Text style={styles.slideTitle}>{t('onboarding.step_organize_title')}</Text>
            <Text style={styles.body}>{t('onboarding.step_organize_body')}</Text>
            <View style={styles.featureRow}>
              <Text style={styles.featureDot}>{'\u2713'}</Text>
              <Text style={styles.featureText}>{t('onboarding.step_organize_f1')}</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureDot}>{'\u2713'}</Text>
              <Text style={styles.featureText}>{t('onboarding.step_organize_f2')}</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureDot}>{'\u2713'}</Text>
              <Text style={styles.featureText}>{t('onboarding.step_organize_f3')}</Text>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.setupSlide}>
            <View style={styles.setupHeader}>
              <Text style={styles.setupIcon}>{'\u2699'}</Text>
              <Text style={styles.slideTitle}>{t('onboarding.step_setup_title')}</Text>
              <Text style={styles.setupBody}>{t('onboarding.step_setup_body')}</Text>
            </View>

            {/* Institution Name */}
            <Text style={styles.fieldLabel}>{t('onboarding.institution_name')}</Text>
            <TextInput
              style={styles.textInput}
              value={institutionName}
              onChangeText={setInstitutionName}
              placeholder={t('onboarding.institution_name_placeholder')}
              placeholderTextColor="#636E72"
              returnKeyType="done"
            />

            {/* Institution Type */}
            <Text style={styles.fieldLabel}>{t('onboarding.institution_type')}</Text>
            <Pressable
              style={styles.selectRow}
              onPress={() => {
                setShowInstType((v) => !v);
                setShowObjType(false);
              }}
            >
              <Text style={styles.selectValue}>
                {institutionType
                  ? t(`settings.institution_type.${institutionType}`)
                  : t('onboarding.select_placeholder')}
              </Text>
              <Text style={styles.selectArrow}>{showInstType ? '\u25B2' : '\u25BC'}</Text>
            </Pressable>
            {showInstType && (
              <View style={styles.pickerBox}>
                {INSTITUTION_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.pickerOption,
                      institutionType === type && styles.pickerOptionActive,
                    ]}
                    onPress={() => {
                      setInstitutionType(type);
                      setShowInstType(false);
                    }}
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

            {/* Default Object Type */}
            <Text style={styles.fieldLabel}>{t('onboarding.default_object_type')}</Text>
            <Pressable
              style={styles.selectRow}
              onPress={() => {
                setShowObjType((v) => !v);
                setShowInstType(false);
              }}
            >
              <Text style={styles.selectValue}>
                {t(`object_types.${defaultObjectType}`)}
              </Text>
              <Text style={styles.selectArrow}>{showObjType ? '\u25B2' : '\u25BC'}</Text>
            </Pressable>
            {showObjType && (
              <View style={styles.pickerBox}>
                {OBJECT_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.pickerOption,
                      defaultObjectType === type && styles.pickerOptionActive,
                    ]}
                    onPress={() => {
                      setDefaultObjectType(type);
                      setShowObjType(false);
                    }}
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

            {/* Language */}
            <Text style={styles.fieldLabel}>{t('onboarding.language')}</Text>
            <View style={styles.langRow}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  style={[
                    styles.langChip,
                    language === lang.code && styles.langChipActive,
                  ]}
                  onPress={() => handleLanguageChange(lang.code)}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.langLabel,
                      language === lang.code && styles.langLabelActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer: dots + button */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>
            {isLastStep ? t('onboarding.get_started') : t('onboarding.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080F',
  },
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: '#636E72',
    fontSize: 15,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 80,
    paddingHorizontal: 28,
    paddingBottom: 24,
  },

  // Info slides (steps 0-2)
  slide: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 20,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 36,
  },
  slideIcon: {
    fontSize: 80,
    color: '#74B9FF',
    lineHeight: 90,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  headline: {
    color: '#74B9FF',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  slideTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  body: {
    color: '#B2BEC3',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  featureDot: {
    color: '#74B9FF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    color: '#DFE6E9',
    fontSize: 15,
    lineHeight: 22,
  },

  // Setup slide (step 3)
  setupSlide: {
    paddingTop: 4,
  },
  setupHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  setupIcon: {
    fontSize: 44,
    color: '#74B9FF',
    marginBottom: 12,
  },
  setupBody: {
    color: '#636E72',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  fieldLabel: {
    color: '#636E72',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
  },
  textInput: {
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(116,185,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectValue: {
    color: '#DFE6E9',
    fontSize: 15,
  },
  selectArrow: {
    color: '#636E72',
    fontSize: 10,
  },
  pickerBox: {
    backgroundColor: '#0A0A14',
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.12)',
    borderRadius: 10,
    marginTop: 4,
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
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(116,185,255,0.15)',
    backgroundColor: 'rgba(116,185,255,0.04)',
  },
  langChipActive: {
    backgroundColor: 'rgba(116,185,255,0.15)',
    borderColor: '#74B9FF',
  },
  langFlag: {
    fontSize: 20,
  },
  langLabel: {
    color: '#636E72',
    fontSize: 14,
    fontWeight: '500',
  },
  langLabelActive: {
    color: '#74B9FF',
    fontWeight: '700',
  },

  // Footer
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 16,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(116,185,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#74B9FF',
    width: 24,
    borderRadius: 4,
  },
  nextBtn: {
    backgroundColor: '#0984E3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
