# Domain-Aware Export Pipeline

> Date: 2026-03-20
> Status: APPROVED
> Context: Export formats and field selection must vary by domain

## Decision

The export stepper (Format → Template → Images → Content → Preview) is domain-contextual. The domain selected during onboarding determines:

1. Which FORMAT options appear on step 1
2. Which CONTENT fields are available and default-on
3. Which TEMPLATE layouts are offered
4. Which branding appears in the footer

## Domain: aha! Marketplace
- Provenance Certificate (ties into marketplace I/P/C/R lifecycle)
- Materials Passport (materials, dimensions, handling, framing)
- Collector Report (purchase history, condition, shipping)
- Curator Submission Package (photos, description, provenance, price range)

Default fields: Title, Artist, Date, Materials, Dimensions, Condition, Provenance, Price/Valuation, Images, SHA-256 hash

## Domain: Museum / Institutional Collection
- PDF Data Sheet (current)
- PDF Condition Report (current)
- JSON export
- CSV export
- Loan Agreement Attachment (future)

Default fields: All 60 fields (full registrar toolkit)

## Domain: Human Rights / Forensic
- Berkeley Protocol Evidence Package
- Chain of Custody Report
- Redacted Public Report (privacy-tier enforced)

Default fields: Capture verification (hash, GPS, timestamp, device), Evidence classification, Condition, Images, Legal hold status

## Domain: Conservation
- Treatment Report
- Before/After Comparison
- Environmental Monitoring Summary

## Domain: Archaeological
- Excavation Record
- Stratigraphy Context Sheet
- Find Registration Form

## Implementation
- Export format registry in src/config/export-formats.ts
- Each domain has a typed array of available formats
- Content step reads domain to determine default field states
- PDF templates keyed by format ID
- Marketplace integration requires API bridge to arthausauction.com Supabase (separate project, future work)

## Build Order
1. Museum domain: COMPLETE (Berlin demo ready)
2. Marketplace domain: Post-Berlin, requires provenance certificate bridge
3. All others: Phase 2
