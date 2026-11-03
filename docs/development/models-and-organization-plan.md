# Models, months and recent groups

Spec: user's 2026-11-03 continuation plus [architecture](architecture.md). Preserve private access, English controls/fonts, immutable originals, manual albums and category decisions. No confirmation inbox, new cloud resources, paid fallback, realtime generation or personal-photo acceptance.

## Task 1: Model refresh and last success

Implement owner-only GET/POST `/api/ai/models[/refresh]`, a bounded NVIDIA directory reader and persisted owner AI state. Intersect IDs with verified request profiles; prefer last validated success if still eligible. Coalesce simultaneous refresh in one isolate. Failure is explicit and never pretends cached data is fresh. Freeze selection per task; only fenced persisted success updates preference. Existing tasks remain readable/retryable without reselection. Tests first: refresh/auth/malformed/empty/overlap/selection/persistence/frozen task.

## Task 2: Month queries and derived recent groups

Add indexed timeline day/date source to photos, backfill without changing manual data. HK calendar; valid photo date, otherwise import date, with honest source labels. Month summary and filtered photo pages are owner-scoped and bounded. Recent groups read at most 300 originals within 30 calendar days: shared AI tags first, same-day leftovers second, minimum two, maximum twenty per group, no duplicate memberships. Computed views never mutate albums or create image files. Tests first: date boundaries/month paging/ownership/large metadata/manual-album equality/deterministic grouping.

## Task 3: UI, review and publication

Keep Photos/Months/Recent/Albums as local Library views. Month cards filter the existing paginated photo view; recent cards open readonly groups with normal photo actions, without confirmation. Demo uses the same pure grouping rules, cloud uses API queries. Add compact model status/refresh, explicit errors and empty states. Verify local browser, all existing samples, TypeScript, both builds; one independent whole-change review. Publish exact reviewed source to same private Site and GitHub main; use bundled examples only for cloud API/browser checks. Record local versus actual provider/cloud evidence separately.

## Decisions and progress

- Base `a32b656`; reuse existing Sites checkout on a feature branch, keeping local credentials and runtime setup intact. No separate worktree or dependency reinstall is needed for this continuation.
- Model refresh feeds selection for new jobs; running/completed jobs keep their model. Month queries and recent groups both consume indexed timeline dates; AI group inputs consume saved validated tags. No task depends on unimplemented live image editing.
- Recent groups are computed from persisted photo metadata rather than a second group job/table. This avoids stale copies and additional model calls; groups can change when dates/tags change, while manual albums stay fixed.
- Keep initial supported profile limited to the live-verified Nemotron model. A directory listing is not permission/health evidence; new profiles need an explicit example probe before registration.
- Existing cloud interruption fault injection remains pending; user explicitly authorized progressing to model selection/organization. Preserve local lease regressions and do not describe them as cloud fault-injection evidence.
