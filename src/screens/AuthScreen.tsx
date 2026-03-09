import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { signIn, signUp } from '../services/auth';
import { AhaLogo } from '../components/AhaLogo';
import { colors, typography, spacing, radii } from '../theme';

interface AuthScreenProps {
  onAuthenticated: () => void;
  onSkip: () => void;
}

export function AuthScreen({ onAuthenticated, onSkip }: AuthScreenProps) {
  const db = useDatabase();
  const { t } = useAppTranslation();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = useCallback((): string | null => {
    if (!email.trim() || !email.includes('@')) {
      return t('auth.error_invalid_email');
    }
    if (password.length < 8) {
      return t('auth.error_weak_password');
    }
    if (mode === 'signup' && password !== confirmPassword) {
      return t('auth.error_passwords_mismatch');
    }
    return null;
  }, [email, password, confirmPassword, mode, t]);

  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    const result =
      mode === 'signup'
        ? await signUp(db, email.trim(), password, email.trim().split('@')[0])
        : await signIn(db, email.trim(), password);

    setLoading(false);

    if (result.success) {
      onAuthenticated();
    } else {
      const raw = (result.error ?? '').toLowerCase();
      let friendly: string;
      if (raw.includes('row-level security') || raw.includes('policy')) {
        friendly = t('auth.error_rls');
      } else if (raw.includes('already registered') || raw.includes('already been registered')) {
        friendly = t('auth.error_email_taken');
      } else {
        friendly = t('auth.error_generic');
      }
      setError(friendly);
    }
  }, [mode, email, password, db, validate, onAuthenticated, t]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError(null);
  }, []);

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <AhaLogo width={180} height={56} />
            <Text style={styles.appNameSub}>Register</Text>
          </View>

          {/* Primary action: Start Documenting */}
          <Pressable style={styles.startBtn} onPress={onSkip}>
            <Text style={styles.startBtnText}>
              {t('auth.start_documenting')}
            </Text>
          </Pressable>

          {/* Divider with account prompt */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.have_account')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form */}
          <View key={mode} style={styles.form}>
            <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder={'\u2022'.repeat(8)}
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType={mode === 'signup' ? 'next' : 'done'}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
                hitSlop={8}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>

            {mode === 'signup' && (
              <>
                <Text style={styles.fieldLabel}>{t('auth.confirm_password')}</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={'\u2022'.repeat(8)}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showConfirmPassword}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword((v) => !v)}
                    style={styles.eyeBtn}
                    hitSlop={8}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color={colors.textSecondary} />
                    ) : (
                      <Eye size={20} color={colors.textSecondary} />
                    )}
                  </Pressable>
                </View>
              </>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'signin'
                    ? t('auth.sign_in')
                    : t('auth.create_account')}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Toggle sign-in / sign-up */}
          <Pressable style={styles.toggleBtn} onPress={toggleMode} hitSlop={12}>
            <Text style={styles.toggleText}>
              {mode === 'signin'
                ? t('auth.no_account')
                : t('auth.already_have_account')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 200,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  appNameSub: {
    color: colors.textSecondary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xs,
  },

  /* Primary skip/start button */
  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  startBtnText: {
    color: colors.white,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },

  /* Divider */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginHorizontal: spacing.md,
  },

  /* Form */
  form: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  textInput: {
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.sm,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  toggleBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  toggleText: {
    color: colors.accent,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
  },
});
