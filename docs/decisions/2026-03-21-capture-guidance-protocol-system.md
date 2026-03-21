# ADR: Capture Guidance Protocol System

> Date: 2026-03-21
> Status: Accepted
> Context: Berlin demo readiness, institutional documentation standards

## Decision

Built a protocol-driven capture guidance system that walks users through required documentation shots. Institutions define capture protocols as JSON configs specifying required and optional shots with instructions and tips.

## Architecture

- JSON protocol configs in src/config/protocols/ (same pattern as domain export configs)
- useCaptureProtocol React hook as state machine (idle → selecting → capturing → reviewing → complete)
- Four UI components: ProtocolPicker, CaptureGuidanceOverlay, ShotListSidebar, CompletionSummary
- Protocol metadata stored on objects table (protocol_id, protocol_complete, shots_completed, shots_remaining)
- Shot metadata stored on media table (shot_type, protocol_id, shot_order)
- PDF export includes protocol compliance section with shot checklist

## Built-in Protocols

- museum_painting: 6 shots (4 required) for paintings, drawings, prints, photographs
- museum_sculpture: 8 shots (5 required) for sculpture, relief, installation, ceramic
- museum_general: 4 shots (2 required) fallback for any object type

## Key Decisions

- Text overlay for v1 (works on all devices), AR angle guidance deferred to v2
- Allow incomplete save with warning (field conditions may prevent full documentation)
- JSON configs not database-first (mirrors export pipeline pattern, admin UI adds DB layer later)
- Protocol events logged to audit_trail for compliance
- i18n from day one (EN + DE)

## What This Does NOT Include (post-Berlin)

- Web admin UI for creating/editing protocols
- Protocol sync from cloud to device
- AR guidance (gyroscope-assisted framing)
- Auto-detection of shot type via ML classifier
- Protocol analytics
