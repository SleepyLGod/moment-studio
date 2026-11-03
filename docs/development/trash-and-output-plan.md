# Trash and explicit image output

User acceptance: retain the reviewed paper-cut appearance; add photo deletion; original dimensions or explicitly chosen dimensions, with no forced square/resize. Free-only remains. OpenAI uses existing subscription only, with a separate native Codex capability spike; do not conflate external OAuth preview limitations with native Codex image generation.

## Design
- Soft trash timestamp on photos, owner-scoped batch trash/restore. Keep files and manual album membership for restoration. Exclude trash from active lists, months, groups, selection and new jobs. Cancel outstanding tasks when trashing; stale completions cannot recreate trashed sources. No permanent deletion or auto-expiry.
- Explicit output mode Original or Custom. Resolve original upright dimensions, including EXIF orientation; cloud model validates supported dimensions before enqueue. Unsupported requests error visibly, no silent resizing. Recipe/job identity includes output size; preserve legacy demo sample eligibility.
- Comparison uses contain and intrinsic image ratio; custom ratio may add letterboxing rather than crop/stretch. No new result thumbnails in this change.
- Subscription trial uses installed Codex native noninteractive image generation with ChatGPT sign-in, no API key, no background daemon installation. Website integration and always-on hosting remain separate from a successful capability trial.

## Checks
1. RED→GREEN tests for reversible owner-scoped trash, reads/collections, stale writes/jobs and source preservation.
2. RED→GREEN tests for upright original/custom dimensions, unsupported bounds, identity and executor parameter forwarding.
3. Full test/typecheck/demo/Sites builds. Local browser and hosted example-only checks; no deletion of real photos. One fresh whole-branch review as required by executing-plans.

## Rulings
- Reuse existing checkout on a feature branch and existing architecture; user has approved the feature behavior. Additional design approval menus would repeat authorization.
- Trash retains bytes indefinitely. It will not reclaim storage until a separately authorized retention policy exists.
