import 'react-native-gesture-handler';
import './src/i18n';
import React, { useCallback } from 'react';
import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import AppShell from './src/app/AppShell';
import { captureError } from './src/utils/sentry';
import { colors, typography, spacing, radii } from './src/theme';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  tracesSampleRate: 0.2,
  enableAutoSessionTracking: true,
  debug: __DEV__,
});

function CrashFallback() {
  const { t } = useTranslation();

  const handleRestart = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      // Not available in Expo Go dev — ignore
    }
  }, []);

  return (
    <View style={styles.crash}>
      <Text style={styles.crashTitle}>{t('errors.crash_title')}</Text>
      <Text style={styles.crashMessage}>{t('errors.crash_message')}</Text>
      <Pressable onPress={handleRestart} style={styles.crashButton}>
        <Text style={styles.crashButtonText}>{t('errors.crash_restart')}</Text>
      </Pressable>
    </View>
  );
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, { componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (this.state.hasError) {
      return <CrashFallback />;
    }
    return this.props.children as React.ReactElement;
  }
}

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <StatusBar style="light" />
          <AppShell />
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  crash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  crashTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  crashMessage: {
    color: colors.textMuted,
    fontSize: typography.size.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  crashButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  crashButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
