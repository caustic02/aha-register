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
import { useDatabase } from '../contexts/DatabaseContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { signIn, signUp } from '../services/auth';

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
      setError(result.error ?? t('common.error'));
    }
  }, [mode, email, password, db, validate, onAuthenticated, t]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
  }, []);

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appName}>aha! Register</Text>
            <Text style={styles.subtitle}>
              {mode === 'signin' ? t('auth.sign_in') : t('auth.sign_up')}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor="#636E72"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              placeholder={'\u2022'.repeat(8)}
              placeholderTextColor="#636E72"
              secureTextEntry
              returnKeyType={mode === 'signup' ? 'next' : 'done'}
            />

            {mode === 'signup' && (
              <>
                <Text style={styles.fieldLabel}>{t('auth.confirm_password')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={'\u2022'.repeat(8)}
                  placeholderTextColor="#636E72"
                  secureTextEntry
                  returnKeyType="done"
                />
              </>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'signin'
                    ? t('auth.sign_in')
                    : t('auth.create_account')}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Toggle */}
          <Pressable style={styles.toggleBtn} onPress={toggleMode} hitSlop={12}>
            <Text style={styles.toggleText}>
              {mode === 'signin'
                ? t('auth.no_account')
                : t('auth.already_have_account')}
            </Text>
          </Pressable>

          {/* Skip */}
          <Pressable style={styles.skipBtn} onPress={onSkip} hitSlop={12}>
            <Text style={styles.skipText}>{t('auth.continue_without')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080F',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 48,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#74B9FF',
    fontSize: 18,
    fontWeight: '600',
  },
  form: {
    marginBottom: 24,
  },
  fieldLabel: {
    color: '#636E72',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
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
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#0984E3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  toggleText: {
    color: '#74B9FF',
    fontSize: 14,
    fontWeight: '500',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    color: '#636E72',
    fontSize: 13,
  },
});
