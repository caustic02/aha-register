# Research Brief: Object Isolation via SAM 3

> Date: 2026-03-21
> Status: RESEARCH COMPLETE, PENDING PROTOTYPE
> Priority: Post-Berlin
> Repo: caustic02/aha-register

---

## Current State

- remove.bg Edge Function deployed (supabase/functions/remove-background/index.ts)
- JWT auth working, function deploys clean
- Results unreliable for museum/field contexts (objects on tables, vitrines, complex backgrounds)
- remove.bg is trained on e-commerce product photos, not cultural heritage documentation

## Recommendation: Replace remove.bg with Roboflow SAM 3

### Why SAM 3

Meta's Segment Anything Model 3 (released Nov 2025) is the first SAM version that accepts **text prompts**. Previous versions required point/box prompts (user taps on object). SAM 3 accepts a noun phrase ("bronze sculpture", "oil painting on canvas") and segments all matching objects.

This maps directly to Register's pipeline: Gemini already classifies the object. Feed that classification as the SAM 3 text prompt.

### Architecture

```
Capture photo
  → Gemini analyze-object Edge Function → returns classification
  → User taps "Isolate Object" on ObjectDetailScreen
  → New Edge Function: isolate-object
    → Sends image + Gemini classification text to Roboflow SAM 3 API
    → Receives segmentation mask
    → Applies mask to original image → transparent background PNG
    → Returns isolated image to device
  → Device stores isolated image as additional media record
    → shot_type: 'isolated'
    → Links to original photo via parent_media_id
```

### Hosting Options

| Option | Pros | Cons |
|--------|------|------|
| Roboflow Serverless API | Free tier, per-call billing, no infra | Cold start latency (~2s), credit-based |
| Roboflow Dedicated Deployment | Low latency, GPU VM | Hourly billing even when idle, overkill for our volume |
| Self-hosted (Docker + GPU) | Full control, no per-call cost | Need GPU server, maintenance burden |
| Replicate.com | Simple API, pay-per-second | Another vendor dependency |

**Recommendation: Roboflow Serverless API.** Per-call pricing matches our usage pattern (sporadic, not streaming). Free tier for prototyping. SAM 3 is fully integrated. Upgrade to dedicated deployment only if latency becomes a problem.

### Cost Estimate

- Roboflow free tier: 1,000 credits/month
- SAM 3 inference: ~1-3 credits per image (depending on resolution)
- Berlin demo volume: ~50-100 images = well within free tier
- Production volume: 500-2,000 images/month = Starter plan ($249/mo, 50K credits) is more than enough

### Build Effort

- 1 new Edge Function (isolate-object): ~2 hours
- 1 new button on ObjectDetailScreen: ~1 hour
- Media record linking (isolated → original): ~1 hour
- Testing with museum object photos: ~2 hours
- Total: ~6 hours, single session

### Risks

1. **SAM 3 accuracy on museum objects** — needs prototype testing. Museum objects in vitrines, on pedestals, with reflective surfaces, or partially occluded may challenge the model. Mitigated by using Roboflow's free playground to test before building.
2. **Latency** — serverless cold start may add 2-5 seconds. Acceptable for a non-blocking background task.
3. **Roboflow vendor lock-in** — SAM 3 is open source (Apache 2.0). Self-hosting is always a fallback.
4. **Image size limits** — large photos may need downscaling before API call. Edge Function handles this.

### Next Steps

1. Test SAM 3 accuracy on 10-20 museum object photos via Roboflow Playground (free, no code)
2. If results are good: create Roboflow account, get API key, build Edge Function
3. If results are poor: investigate fine-tuning or prompt engineering approaches
4. Wire into ObjectDetailScreen as "Isolate Object" action

### Alternative: Keep remove.bg for Simple Cases

Could keep both: remove.bg for quick-and-dirty background removal on clean tabletop shots, SAM 3 for intelligent object isolation in complex scenes. But maintaining two services adds complexity for marginal benefit. SAM 3 should handle simple cases fine.

---

## References

- SAM 3 paper: https://openreview.net/forum?id=r35clVtGzw
- Roboflow SAM 3 integration: https://blog.roboflow.com/sam3/
- Roboflow SAM 3 API docs: https://inference.roboflow.com/foundation/sam3/
- EdgeTAM (on-device, video): https://github.com/facebookresearch/EdgeTAM
- Meta SAM Playground: https://segment-anything.com/
