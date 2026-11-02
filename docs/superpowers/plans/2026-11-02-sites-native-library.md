# Sites Native Library Implementation Plan

> Agentic execution: native implementation in this session, with a fresh whole-change review before final publication.

**Goal:** Preserve the moment UI while storing authenticated gallery records in Sites D1 and files in Sites R2.

**Architecture:** Official Vinext/Workers integration; one owner-private Site, authenticated per-resource API, shared React UI with cloud and static-demo clients. No Go, PostgreSQL or external storage account.

**Spec:** User-approved “第一阶段：直接使用 Sites 的云端能力” in this conversation.

## Constraints

- Existing Site project_id and owner-private audience remain unchanged; one GitHub repo.
- JPG/PNG/WebP; 12 MiB/file, 20 files/batch. No real gallery migration or live generation.
- Schema-only Drizzle migrations; original bytes immutable; D1 stores metadata only.
- No permanent deletion of existing files; generated scratch and legacy sources are retained.

## Review focus

- Anonymous and cross-owner record/file access must fail.
- Interrupted or repeated uploads must not create visible incomplete/duplicate photos.
- Album edits, references and derivatives must survive reload without embedded image data in D1.
- Client errors must not produce optimistic fake success or silently revert to browser persistence.
- Static demo and nine exact pre-generated sample eligibility checks must remain functional.

## Tasks

- [ ] 1. Adopt the official starter without replacing assets; retain a static demo entry. Build both targets.
- [ ] 2. Write API contract tests (RED), implement D1 schema, owner authentication, resumable upload sessions, private file reads and photo pagination (GREEN). Run local Worker tests and publish a minimal cloud slice for live verification.
- [ ] 3. Add tested album/category/Style/derivative persistence and connect all existing UI mutations via cloud/demo services. Preserve sample provenance and original retention.
- [ ] 4. Browser-check local and live paths; verify reload/re-auth/redeployment persistence, bytes and authorization separately. Record limits honestly.
- [ ] 5. Add TODO.md; update README, deployment and superseded Go design. Fresh review, fixes, checks, GitHub sync and owner-private publication.

## Execution ledger

- Start: base b39d48f; clean working tree; feature branch feat/sites-cloud-library. Existing Site opened through source helper.
- Ruling: implement directly as explicitly requested; no additional plan-approval pause. Work remains in the existing checkout so the user's local preview path stays valid.

- Task 1: complete — official starter and both builds pass; static index moved intact into demo/ to avoid shadowing SSR.
- Task 2 local: complete — seven API tests and real local Workers D1/R2 smoke pass, including byte hash and create-only retry. Hosted validation pending.
- Task 3: implemented — cloud resource client and async UI actions; browser upload reached 13 photos, no console errors. Further hosted interaction QA pending.

- Hosted vertical slice: v3 source a723fe2 deployed; native DB binding/tables verified; actual browser upload and downloaded original SHA-256 matched. No personal photos used.
- Final review: fresh reviewer found six Important issues; all received regression coverage and a fix pass: generated Tone file IDs; collection-aware category/cover/example reads; snapshot-paired revisions; complete pending Style payload; stable sample-batch retry; actual ordered collage provenance.
- Final: fixed all six — new regression tests observed RED then GREEN; npm test passes 13/13 plus all nine provenance checks; Worker/demo builds and typecheck pass.
- Ruling: repaired generated, unapplied 0002 SQL because Drizzle quoted a JSON expression as column names. Snapshot/schema retained; the corrected migration passed real SQLite and local Workers execution. Future generated migrations still require inspection.
- Minor PNG filename mismatch was corrected together with the MIME/content-scoped image materialization fix; no separate deferred code defect.
