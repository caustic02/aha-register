import * as Sentry from '@sentry/react-native';

export function captureError(
  error: Error,
  context?: Record<string, unknown>,
): void {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export function setUserContext(userId: string, institutionId?: string): void {
  Sentry.setUser({
    id: userId,
    ...(institutionId ? { institutionId } : {}),
  });
}

export function clearUserContext(): void {
  Sentry.setUser(null);
}
