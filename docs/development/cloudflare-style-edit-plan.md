# Cloudflare image editing

User spec (2026-11-03): verify the owner's Cloudflare Free account with public images, measure actual usage, then integrate working image editing into Style Lab. Do not activate a paid plan. Keep originals/private access/manual albums and the static demo's nine qualified examples.

## Verified prerequisites

- Dashboard Workers plans shows Free / Current plan, Workers AI 10,000 neurons/day.
- One real public-coffee trial returned HTTP 200, a 512×512 JPEG and a paper-cut transformation. Provider execution 2537 ms. Dashboard subsequently showed 107.87 neurons for this model; the response has no per-call usage field. Do not substitute a price-formula estimate for this observation.
- NVIDIA's documented FLUX.2 preview still accepts only preset images 0–3. This concerns the hosted preview API, not the model's inherent editing ability.

## Implementation

1. Extend persistent jobs with kind `edit` (existing schema is sufficient). Owner-scoped idempotent submissions snapshot recipe/source. Running edits are fenced; expired/unknown provider executions are not blindly regenerated. A result exists only after validated image bytes and metadata are saved.
2. Own-account Cron executor uses an AI binding for the fixed, tested FLUX.2 Klein 4B profile. It pulls input from the existing authenticated Sites runner and posts completion to that same origin. No new public service route or model secret in browsers. Preserve NVIDIA analysis behavior and its model preference.
3. Cloud Style Lab generates for the active photo, shows queue/progress/result, saves immutable derivatives automatically and reuses saved recipes. Static demo remains explicitly sample-only. Resume recent task status after reload.
4. Tests, local/browser and real cloud acceptance, then one fresh whole-branch review and existing private Site publication. Record local mocks separately from actual model execution and metering. Never upgrade billing.

## Rulings / review focus

- Reuse the existing Sites checkout on a feature branch; no unrelated refactor or storage migration. No deletion of user files.
- Reuse the existing service authorization and Cloudflare AI binding, without expanding OAuth scope or issuing a browser-visible model key.
- Only confirmed pre-inference rejection/rate limit may retry automatically. Lost result/expired lease becomes unknown; preserve job identity and avoid another charged generation.
- Check owner isolation, lease races, upload/finalization retry, result file signature/size, source immutability, recipe idempotence, non-overwrite of manual albums, frontend duplicate clicks/reload, and demo provenance. Do not claim perfect composition fidelity.

## Progress

- Actual second call with the existing 768px preview passed; dashboard cumulative 217.43 neurons after two calls.
- Backend, executor and UI implemented; 59 tests pass, typecheck and both builds pass.
- Lease-expiry-during-R2 test observed RED (200 instead of 409), fixed using a fresh commit-time fence, then GREEN.
- Ruling: use an explicit ASSETS binding for bundled examples, preserving the same owner check; production metadata includes the binding. Local dev asset fetching still under verification.
- All image-job state remains in existing D1; no migration or new persistent intermediate.

## Final review

Fresh reviewer examined bd81aea..c500a0e. No Critical findings; two Important findings fixed in one pass.
- Fixed overlapping single/batch generation — regression expected409 but observed202 (RED), now returns409 without partial batch (GREEN).
- Fixed latest20 hiding unresolved edits — 24-task regression lost old queued/running/unknown tasks (RED), now all remain visible (GREEN).
- Full suite61/61, TypeScript and demo/Sites builds pass. No deferred minors.
- Final: Ruling: high-resolution quality and long-term throughput stay out of this bounded512px release — both were explicit exclusions, no such guarantees are made — larger workloads still need later measurement.
- Final: Ruling: account entitlement was checked live and real model calls succeeded, but hosted UI acceptance is independently pending browser reconnection — no substitution of mocked or trial-worker evidence — user-facing workflow could still need a follow-up fix if unavailable to exercise now.
