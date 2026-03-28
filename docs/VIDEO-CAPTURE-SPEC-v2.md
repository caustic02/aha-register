# Feature Spec: Narrated Video Capture

## Product: aha! Register
## Status: Roadmap (post-Berlin demo)
## Priority: High — unique differentiator, no competitor offers this

---

## Concept

A conservator, curator, or field documentarian films an object while narrating observations. The video is cryptographically timestamped, geolocated, and tied to a specific object record. Audio narration is auto-transcribed and indexed as searchable metadata.

This is the "video walkaround" model proven in automotive inspection (myKaarma), real estate (Matterport), and insurance claims (Tractable) — applied to cultural heritage and object documentation for the first time.

## Why This Matters

- **No competitor does this.** Articheck: photos + annotations only. TMS MediaCapture: camera-to-CMS link, no narration. CatalogIt: photo catalog only. Axiell/Vernon: enterprise CMS, no mobile capture.
- **Evidence-grade documentation.** Video + audio + SHA-256 hash + GPS + timestamp = tamper-evident record that holds up in provenance disputes, insurance claims, and condition disagreements.
- **Natural workflow.** Conservators already narrate while examining objects. They just do it into a voice recorder or notebook. Register captures both observation and evidence in one action.
- **AI extraction from narration.** Gemini can process video frames + audio transcript together. The AI sees the object AND hears the expert describe it. This produces dramatically better metadata than photo-only analysis.

## User Flow

1. User opens object record (existing or new)
2. Taps "Video Capture" (alongside existing photo capture)
3. Camera opens in video mode with audio recording active
4. User films the object, narrating observations ("Front view, approximately 40 by 60 centimeters, oil on canvas, minor cracking in upper left quadrant...")
5. User taps stop
6. Register immediately:
   - Computes SHA-256 hash of the video file
   - Attaches GPS coordinates and timestamp
   - Stores video in local app storage (Tier 1)
   - Queues for sync to command center when connected
7. When phone connects to command center (laptop on same network):
   - Video transfers automatically
   - Command center verifies SHA-256 hash matches
   - Phone cache clears after verified transfer
8. Command center pushes to cloud archive on its own schedule
9. Transcription runs when connectivity allows (cloud Edge Function)
10. Optional: user triggers AI analysis (Gemini processes video frames + transcript together)

---

## Three-Tier Storage Architecture

The phone is a capture device, not a storage device. Video files are large (100MB+ per 5-minute clip). The architecture mirrors how forensic evidence chains and news agencies handle field footage.

### Tier 1: Phone (field capture device)

- Captures video, computes SHA-256 hash on-device immediately
- Stores in local app storage (expo-file-system)
- Minimal metadata UI: title, notes, object link
- Storage constraint: phone storage is limited. Videos queue for offload.
- The phone is a sensor with a hash function. It captures and certifies.

### Tier 2: Laptop / Command Center (local hub)

- Phone syncs to laptop over local Wi-Fi (mDNS/Bonjour discovery, or manual IP)
- Laptop runs a lightweight companion app or web dashboard
- Receives full-resolution video, verifies SHA-256 hash matches phone's record
- Phone clears local cache after verified handoff
- Curator reviews, annotates, organizes from the laptop
- This is the working copy. The curator's desk.
- Transcription can run locally here (Whisper.cpp) for offline environments

### Tier 3: Cloud (archival backup)

- Laptop pushes to long-term cloud storage on its own schedule
- NOT Supabase Storage (too expensive for video at scale)
- Target providers: Backblaze B2 (~$0.005/GB/month), AWS S3 with lifecycle policies, or institution's own storage
- Lifecycle policy: hot storage for 30 days, then auto-transition to cold/archive tier
- SHA-256 hash verified again on cloud receipt (three-point verification: phone → laptop → cloud)
- Supabase database still holds the metadata record (hash, GPS, timestamp, transcript, object link) — just not the video file itself

### Why Three Tiers

| Concern | Solution |
|---------|----------|
| Phone runs out of space | Offload to laptop, clear cache |
| No internet in the field | Phone → laptop works over local network, no cloud needed |
| Cloud storage costs | Cold storage tiers reduce costs 80%+ for archival video |
| Tamper evidence | SHA-256 verified at every handoff point |
| Institutional data sovereignty | Tier 3 can be the institution's own server, not a third-party cloud |
| Speed of access | Recent videos on laptop (fast), old videos in cloud (slower but cheap) |

### Hash Chain Integrity

```
Phone captures video → SHA-256: a7f3...9c2e (computed on-device)
    ↓ (Wi-Fi transfer)
Laptop receives video → SHA-256: a7f3...9c2e (verified match ✓)
    ↓ (cloud upload)
Cloud stores video → SHA-256: a7f3...9c2e (verified match ✓)
    ↓
Supabase metadata record: { hash: "a7f3...9c2e", verified_at: [phone, laptop, cloud] }
```

If the hash doesn't match at any point, the transfer is flagged and the original on the source device is preserved. Tamper-evidence isn't just about the content — it's about the chain of custody.

---

## Technical Architecture

### Capture (Tier 1 — Phone)
- expo-camera video mode (already have camera permissions)
- expo-av for audio recording alongside video
- Maximum duration: configurable (default 5 minutes, max 15)
- Resolution: 1080p default, configurable for storage constraints
- File format: MP4 (H.264 video + AAC audio)
- SHA-256 computed immediately after recording stops
- Estimated size: ~100MB per 5-minute 1080p video

### Phone-to-Laptop Sync (Tier 1 → Tier 2)
- Discovery: mDNS/Bonjour (phone finds laptop on local network automatically)
- Transfer: HTTP or WebSocket over local Wi-Fi
- Protocol: chunked transfer with resume support (large files, unreliable Wi-Fi)
- Verification: laptop computes SHA-256 of received file, compares to phone's hash
- Cleanup: phone deletes local video only after laptop confirms hash match
- Companion app: lightweight Electron or web app running on laptop (or CLI tool)

### Laptop-to-Cloud Sync (Tier 2 → Tier 3)
- Runs on laptop's schedule (background process, or manual trigger)
- Supports multiple cloud backends via adapter pattern:
  - Backblaze B2 (cheapest for archival)
  - AWS S3 (most flexible lifecycle policies)
  - Institution's own S3-compatible storage (MinIO, etc.)
- Lifecycle policies configured per institution:
  - Hot: 30 days (standard access)
  - Warm: 30-180 days (infrequent access, ~50% cheaper)
  - Cold: 180+ days (archive/glacier, ~80% cheaper)
- Metadata (hash, GPS, timestamp, object link) always stored in Supabase regardless of where the video file lives

### Transcription
- **Primary: Cloud** — Supabase Edge Function calling Whisper API or Gemini audio processing. Best quality.
- **Fallback: Local on laptop** — Whisper.cpp via command-line tool. Works fully offline.
- **Not on phone** — too resource-intensive, drains battery during field work.
- Transcript stored in Supabase metadata record, searchable across all objects.

### Database Schema Additions
```sql
-- media table additions
ALTER TABLE media ADD COLUMN media_type TEXT DEFAULT 'image'; -- 'image' | 'video'
ALTER TABLE media ADD COLUMN duration_seconds INTEGER;
ALTER TABLE media ADD COLUMN transcript TEXT;
ALTER TABLE media ADD COLUMN transcript_status TEXT DEFAULT 'pending'; -- 'pending' | 'processing' | 'complete' | 'failed'
ALTER TABLE media ADD COLUMN transcript_language TEXT DEFAULT 'en';
ALTER TABLE media ADD COLUMN storage_tier TEXT DEFAULT 'device'; -- 'device' | 'local' | 'cloud'
ALTER TABLE media ADD COLUMN cloud_storage_uri TEXT; -- e.g., 's3://bucket/path' or 'b2://bucket/path'
ALTER TABLE media ADD COLUMN hash_verified_at JSONB; -- e.g., {"device": "2026-03-19T...", "local": "2026-03-19T...", "cloud": "2026-03-19T..."}
```

### AI Integration
- Gemini 2.5 Pro accepts video input (up to 1 hour)
- Send video frames + transcript as combined context
- Extract: condition observations, dimensions mentioned, materials identified, damage noted
- Confidence scoring same as photo analysis

### Export Integration
- PDF export: key frames extracted as images + transcript as text block
- Video thumbnail in object detail view
- Full video playable from object record
- Transcript searchable across all objects

---

## Competitive Positioning

| Feature | Register | Articheck | TMS MediaCapture | CatalogIt |
|---------|----------|-----------|-------------------|-----------|
| Photo capture | Yes | Yes | Yes | Yes |
| Video capture | **Yes** | No | No | No |
| Audio narration | **Yes** | No | No | No |
| Auto-transcription | **Yes** | No | No | No |
| SHA-256 tamper evidence | **Yes** | No | No | No |
| AI metadata from video | **Yes** | No | No | No |
| Three-tier storage | **Yes** | No | No | No |
| Offline capture | Yes | Yes | No | Yes |
| Offline sync (phone→laptop) | **Yes** | No | No | No |
| GPS/timestamp | Yes | Partial | Yes | Partial |

## Inspiration
- myKaarma (automotive): Video walkaround with metadata, timestamped, tied to repair order
- URL: https://api.mykaarma.com/video-walkaround/details
- Key insight: the person filming IS the expert. Their narration is the most valuable metadata source.
- Second insight: the phone is a capture device, not a storage device. Offload early, verify always.

## Open Questions
- Companion laptop app: Electron, web app, or CLI tool?
- Should transcript editing be supported? (correct AI transcription errors)
- Multi-language transcription (German/English at minimum for Berlin use case)
- Video annotation overlay (draw on video frames, like Articheck does for photos)
- Maximum video resolution (4K doubles storage requirements but future-proofs)
- Should institutions be able to bring their own cloud storage backend?

## Build Order (estimated)
1. Video capture mode in camera (expo-camera + expo-av)
2. SHA-256 hashing of video files
3. Local storage management on phone (queue, cache limits)
4. Database schema for video metadata
5. Phone-to-laptop sync protocol (mDNS discovery + HTTP transfer + hash verification)
6. Laptop companion app (minimal: receive, verify, organize)
7. Transcription via Edge Function (Whisper or Gemini)
8. Object Detail UI for video playback
9. AI analysis integration (Gemini video input)
10. Export integration (key frames + transcript in PDF)
11. Cloud storage adapter (B2/S3/MinIO backends)
12. Lifecycle policy configuration per institution
