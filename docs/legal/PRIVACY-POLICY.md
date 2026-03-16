---
title: Privacy Policy
product: aha! Register
last_updated: 2026-03-15
version: 1.0
contact: register@arthausauction.com
entity: TEDE Holdings LLC
---

# aha! Register Privacy Policy

**Effective date:** March 15, 2026
**Operated by:** TEDE Holdings LLC d/b/a aha! ("we," "us," "our")
**Contact:** register@arthausauction.com

This Privacy Policy describes how aha! Register ("the App") collects, uses, stores, and protects your information. Register is a mobile application for institutional collection management and field documentation.

## 1. Information We Collect

### 1.1 Information You Provide

- **Account information:** Name, email address, institution name, and role when you create an account.
- **Object records:** Titles, descriptions, dimensions, materials, condition notes, provenance history, and other metadata you enter about documented objects.
- **Media:** Photographs and images you capture or import through the App.
- **Collections:** Names and organizational structures you create to group objects.
- **Settings and preferences:** Language preference, institution configuration, and display options.

### 1.2 Information Collected Automatically

- **Location data:** GPS coordinates at the time of capture, derived from device sensors or photo EXIF metadata. The coordinate source (GPS live, EXIF, manual entry, or none) is always recorded alongside the coordinates. You can disable location access in your device settings.
- **Device information:** Device model, operating system version, and app version. Used for crash reporting and compatibility.
- **Capture metadata:** Timestamp, device identifier, and capture method for each documented object.
- **Cryptographic hashes:** A SHA-256 hash is computed on-device at the moment of capture. This hash provides tamper evidence and is stored alongside each record. The hash is computed locally and never transmitted separately from the record it belongs to.
- **Audit trail:** A local log of all create, update, and delete actions within the App, including timestamps and user identifiers. This supports chain-of-custody documentation.
- **Crash and error reports:** Anonymous crash data, stack traces, and performance metrics sent to Sentry (sentry.io) when errors occur. These reports do not contain object records, photographs, or personal content.

### 1.3 Information We Do Not Collect

- We do not collect payment or financial information through the App.
- We do not serve advertisements or share data with advertising networks.
- We do not access your contacts, microphone, or files outside the App's designated storage.
- We do not use your data for AI model training.

## 2. How We Use Your Information

We use the information we collect to:

- **Operate the App:** Store, display, organize, and export your object records and collections.
- **Provide tamper evidence:** Compute and verify SHA-256 hashes to maintain the integrity of captured records.
- **Enable synchronization:** When cloud sync is active, transfer your records between your device and our cloud infrastructure so you can access them across devices and share with team members.
- **Generate exports:** Produce PDF reports, data exports, and provenance certificates from your records.
- **Improve reliability:** Use crash reports and performance data to identify and fix bugs.
- **Communicate with you:** Send service-related notifications about your account, sync status, or important updates. We do not send marketing emails without your consent.

## 3. Data Storage and Security

### 3.1 Local Storage

All object records, media, and metadata are stored locally on your device in an encrypted SQLite database. The App uses hardware-backed secure storage (iOS Keychain / Android Keystore) for authentication credentials.

The App is designed to function fully offline. Your local database is the primary copy of your data. No internet connection is required for capture, editing, or local export.

### 3.2 Cloud Storage

When cloud synchronization is enabled, your data is transmitted over encrypted connections (TLS 1.2+) to our cloud infrastructure hosted by Supabase in Frankfurt, Germany (EU). Data at rest is encrypted. Cloud storage is subject to the same privacy tiers you configure in the App.

### 3.3 Privacy Tiers

Each record in Register can be assigned a privacy tier:

- **Public:** May be synced and shared without restriction.
- **Confidential:** Synced to cloud but access-restricted to authorized team members.
- **Anonymous:** Identifying metadata is stripped before any sync or export operation.

These tiers are enforced at the application level. Records under legal hold cannot be deleted or modified regardless of privacy tier.

### 3.4 Security Measures

- SHA-256 hashing at capture for tamper evidence
- Hardware-backed credential encryption (expo-secure-store)
- TLS 1.2+ for all network communication
- Row Level Security on cloud database
- Audit trail logging for all data operations

## 4. Data Sharing

We do not sell, rent, or trade your personal information.

We may share information only in these circumstances:

- **With your institution:** If you use Register as part of an institutional account, your institution's administrators may access records and settings within the institutional scope.
- **Service providers:** We use Supabase (database hosting, Frankfurt EU), Sentry (crash reporting), and Expo/EAS (app distribution). These providers process data only as necessary to provide their services and are bound by their own privacy policies.
- **Legal requirements:** We may disclose information if required by law, court order, or governmental request.
- **With your consent:** We may share information in other ways if you give us explicit permission.

## 5. Data Retention

- **Local data:** Remains on your device until you delete it or uninstall the App.
- **Cloud data:** Retained as long as your account is active. Upon account deletion, your data is removed from cloud storage within 30 days. Anonymized data that has been aggregated for system reliability purposes cannot be extracted.
- **Crash reports:** Retained by Sentry for 90 days.
- **Audit trail:** Retained for the lifetime of the associated record. Audit trails for deleted records are retained for 1 year after deletion to support chain-of-custody verification.

## 6. Your Rights

### 6.1 All Users

You have the right to:

- **Access** your data at any time through the App's export features.
- **Correct** any information by editing your records.
- **Delete** your records and account. Local deletion is immediate. Cloud deletion completes within 30 days.
- **Export** your data in standard formats (PDF, structured data).
- **Restrict processing** by disabling cloud sync and using the App in offline-only mode.

### 6.2 European Economic Area (GDPR)

If you are in the EEA, you have additional rights under the General Data Protection Regulation:

- **Legal basis for processing:** We process your data based on (a) your consent when you create an account and enable features, (b) performance of a contract to provide the App's services, and (c) our legitimate interest in improving the App's reliability and security.
- **Data portability:** You may request a machine-readable export of your data.
- **Right to object:** You may object to processing based on legitimate interests.
- **Right to lodge a complaint:** You may file a complaint with your local data protection authority.
- **Data location:** Cloud data is stored in Frankfurt, Germany (EU). No data is transferred outside the EEA unless you explicitly configure an external storage provider.

**Data Protection Officer contact:** register@arthausauction.com

### 6.3 California (CCPA/CPRA)

If you are a California resident, you have the right to know what personal information we collect, request deletion, and opt out of the sale of personal information. We do not sell personal information.

## 7. Children's Privacy

Register is not directed at children under 16. We do not knowingly collect personal information from children. If we become aware that a child under 16 has provided personal information, we will delete it.

## 8. Third-Party Services

The App integrates with the following third-party services:

| Service | Purpose | Data Processed | Location |
|---------|---------|---------------|----------|
| Supabase | Cloud database and authentication | Account data, object records, media | Frankfurt, DE (EU) |
| Sentry | Crash reporting and error monitoring | Anonymous crash data, device info | United States |
| Expo/EAS | App distribution and over-the-air updates | Device type, app version | United States |

Each service operates under its own privacy policy. We select providers that maintain appropriate security standards.

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. The "last updated" date at the top reflects the most recent revision. If we make material changes, we will notify you through the App or by email.

## 10. Contact

For questions about this Privacy Policy or to exercise your data rights:

- **Email:** register@arthausauction.com
- **Entity:** TEDE Holdings LLC d/b/a aha!
- **Address:** 418 Broadway, 2nd Floor, Albany, NY 12207

---

*This Privacy Policy applies to aha! Register. For the aha! marketplace (arthausauction.com), see the separate Privacy Policy at arthausauction.com/privacy.*
