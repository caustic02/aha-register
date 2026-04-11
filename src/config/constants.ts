/**
 * App-wide runtime constants.
 *
 * Keep this file small and dependency-free — it is imported by screens,
 * services, and PDF template code alike.
 */

export const APP_CONFIG = {
  /**
   * Canonical HTTPS origin of the companion web app.
   * Use for QR code payloads, share links, and any URL that the user
   * (or a scanner) is expected to navigate to.
   */
  WEB_APP_BASE_URL: 'https://www.aharegister.com',
  /**
   * Display-only domain (no protocol, no www). Use inside PDF footers
   * and UI labels where showing the bare hostname reads better than
   * a full URL.
   */
  WEB_APP_DOMAIN: 'aharegister.com',
} as const;
