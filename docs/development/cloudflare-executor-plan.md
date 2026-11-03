# Cloudflare executor implementation plan

> Execution: implement inline with failing behavior tests before production changes; one independent whole-change review before final publication. User accepted the same-repository, own-account Cloudflare executor on 2026-11-03.

**Goal:** Keep Sites as the private UI / D1 / R2 application and use one own-account Cloudflare Worker with a Cron trigger to reliably advance bounded photo-analysis jobs while every browser is closed.

**Spec:** [Accepted target](architecture.md), [verification evidence](execution-verification.md), and the user's explicit choice of a Cloudflare executor. No real gallery, paid fallback provider, live image generation, Go service or second repository.

## Scope and boundaries

- One executor Worker; a periodic trigger wakes due jobs. D1 remains the only task state source. No queue, Redis or agent scheduler alongside it.
- The executor calls a narrow authenticated Sites task endpoint; it does not bind across accounts to Sites-managed DB/R2. Sites retains the Library and model business code; the external Worker supplies reliable scheduled invocation.
- Runtime secrets stay out of source and output. A dedicated random executor key authenticates only task advancement; the platform Site service-access token is additionally required at dispatch. Neither token grants browser identity or generic file access.
- One bounded analysis step per tick initially; overlap is fenced by an atomic lease and execution token. Initial background start can take roughly one minute; instant wakeup is not added speculatively.
- Sites/NVIDIA arbitrary request IDs are never assumed queryable. Only validated model response JSON is a result; unknown delivery is not success.
- Keep JPG/PNG/WebP, 12 MiB/file, 20 photos/batch and all nine pre-generated example eligibility checks. Static demo remains independent.
- Never permanently delete files. No automatic cleanup of personal originals or saved creations.

## Task 1: Real unattended vertical slice

Files: `executor/worker.mjs`, `executor/wrangler.jsonc`; dedicated runner authorization and API handling; append-only jobs migration; `tests/executor.test.mjs`, `tests/jobs.test.mjs`.

- [x] RED: reject wrong/missing runner secret, no service bootstrap of owner, concurrent claims, expired fencing tokens, stored job/read status and invalid responses.
- [x] GREEN: bounded job lifecycle, narrow task advancement endpoint, scheduled Worker with no public unauthenticated execution route.
- [x] Local SQLite regressions and builds; actual Workers runtime verified after Cloudflare user login/account selection.
- [ ] Cloud: create one bundled-example analysis task, close browser, observe actual Cron progress and persisted output. Repeat/overlap trigger and expired-lease recovery checks.
- [ ] Gate: only after this slice passes do the broader UI and organization work below proceed.

## Task 2: NVIDIA adapter and model selection

Files: focused `server/ai/` modules, jobs handler and model routes; regression tests.

- [ ] RED/GREEN: directory is not health; last successful compatible model preferred, frozen per batch; empty/malformed response fails; 429 is deferred; authentication error is explicit; no random fallback scanning.
- [ ] Use the live-verified Nemotron non-thinking profile as the initial supported analyzer. Refresh candidates on page refresh; update last success only after validated inference.
- [ ] Verify hosted Sites-to-NVIDIA separately from the already-completed local live probes.

Task 1 may use this concrete adapter for its real analysis slice; Task 2 expands/reviews selection behavior rather than duplicating it.

## Task 3: Gallery organization and limited storage

Files: existing React cloud client/dialogs/views; focused Library rules, migrations as necessary, meaningful regressions.

- [ ] Monthly query/view with explicit date source; keep user albums manual and ordered.
- [ ] AI tags automatically applied but separated from manual labels/exclusions; no confirmation inbox.
- [ ] Recent automatic grouping uses bounded time windows and analyzed metadata; does not mutate manual albums or reprocess the whole library.
- [ ] Reuse one thumbnail; tone slider changes store parameters, not every intermediate image. Do not enable temporary-file deletion before its reference/race rules are implemented and tested.

## Task 4: Review and release

- [x] Full existing checks + new regressions; 30 tests, static demo and Worker builds.
- [x] Independent review of the vertical slice, focused on service authorization, identity/ownership, job completion fencing, provider transport and photo-file retention. Broader unimplemented model selection/grouping remain outside this review.
- [ ] Fix material findings with regression tests; preserve private audience; publish exact source; verify cloud readback without personal photos.
- [ ] Update target diagrams, actual interface docs, deployment / secrets instructions and local-vs-hosted evidence; synchronize GitHub main.

## Ledger

- Base: `565b368`; architecture/evidence committed to main, existing website source code unchanged.
- Verification: NVIDIA model list 85 IDs; two listed old candidates returned 404. Nemotron non-thinking profile returned valid Chinese labels on two bundled images. Current Sites service-access-only `/api/me` returned 401 as required.
- Decision: user explicitly accepted an own-account Cloudflare executor. Official Cron documentation identifies the scheduled handler; actual account/deployment and closed-browser execution remain to be verified.
- Cloudflare authentication: no process token or authenticated Wrangler profile was available. Official login started with account:read, user:read, workers:write (plus required offline access), without requesting DNS/KV/D1/Queues management scopes. The user must complete the security-sensitive authorization.
- Local CLI auth state is isolated under ignored `.wrangler/executor-cli/` via Wrangler's XDG configuration support; no credentials are put into source or global system directories.
- Pre-flight: Task 1 consumes the AI result contract expanded by Task 2; build the concrete analyzer once, then extend selection behavior. Task 3 consumes persisted tags/jobs from Tasks 1–2 and must wait for the unattended cloud gate.
- Task 1 local progress: job create/dedup and separate executor authorization observed RED (404 vs 202; owner-less runner 401 vs expected 503), then GREEN. Runner completion observed RED (processed 0 vs 1), then GREEN. Expired final lease observed RED (running vs failed), then GREEN.
- Local regression scope: original byte equality and manual metadata retention, overlapping requests, old execution token rejection, 429 deferral, invalid HTTP-200 output, expired-attempt recovery/exhaustion, fail-closed configuration and fixed-origin executor credentials. These are SQLite plus fake provider/R2 tests, not cloud execution evidence.
- Both Sites and static-demo builds passed; the own-account executor dry-run bundled successfully (2.19 KiB). No own-account resources or production secrets have been created.
- Cloudflare login attempt expired before the user completed authorization. Authentication remains pending; restart the official login flow when the user is ready. Do not reuse expired OAuth callback state or handle credentials manually.
- Ruling: the initial real cloud slice uses a bundled example already uploaded into private R2. Direct analysis of bundled static assets is enabled only if an actual ASSETS binding is available; otherwise it fails explicitly. Existing seed images do not prove that binding exists. Expand this only after platform verification.
- Ruling: the initial supported analyzer is the concretely live-verified Nemotron profile; dynamic catalog/preference handling is Task 2. It must not imply the unverified Llama/Gemma candidates work.

- Current checkpoint: 25/25 local tests, TypeScript, Sites build, static demo build and executor dry-run passed. Code is committed on feat/cloudflare-photo-jobs, not merged or published; cloud gate and independent final review are still pending.
- Independent review of the vertical slice found two Important issues and no Critical issues: provider redirects could forward credentials/image bytes, and response-body transport failure was misclassified as permanent invalid output. Both received observed RED→GREEN regression tests; 28/28 tests now pass. No material findings were deferred.
- Added the minimum owner-only UI needed for actual cloud acceptance: capability-gated AI tags action, persistent job IDs/status polling, and saved tag chips in photo preview. The controls are absent while the production background switch is false; polling reads status and never executes tasks.
- Cloudflare OAuth login succeeded on 2026-11-03, but workers:write alone did not authorize the script/deployment API. A second official consent was initiated for workers_scripts:write and workers_tail:read in addition to the existing scopes. It requires user confirmation; no permission bypass is attempted.
- Release checkpoint, 2026-11-03 08:01 UTC: OAuth completed, owner-account Worker deployed with no public URL and a saved one-minute Cron. After fixing the observed Cloudflare redirect-mode incompatibility, actual scheduled execution completed the queued R2 coffee example while all app pages were closed. Reopening displayed persisted tags; original download hash matched. Simultaneous cloud runner requests processed the city example once; repeated owner submission did not create another task.
- Task 1's closed-browser and cloud-overlap checks passed; cloud expired-lease fault injection remains explicitly pending (local recovery/fencing tests pass). Do not mark the entire multi-task plan complete. Task 2 dynamic catalog/preference and Task 3 organization/storage work remain pending. Actual current behavior and evidence: [cloud validation](cloud-executor-validation.md).
