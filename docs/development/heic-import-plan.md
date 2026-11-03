# HEIC import implementation

Spec: user request on 2026-11-03: support HEIC, capture time and orientation using public samples; research free-first custom-image edit services; generate one project-local Zine example. Preserve originals, owner-only access, manual albums, current UI and upload limits.

## Tasks

1. Import boundary: detect still-image HEIC by container brands, parse only capture-time/orientation EXIF, distinguish timezone-known instants from timezone-unknown local time. Retain file-modified fallback. Backend accepts HEIC originals only; previews and references stay web-compatible. Add failing tests first, then implementation. Expected: import/API/date tests pass.
2. Browser preparation: native decode first, lazy CSP-compatible HEIC decoder when necessary; one upright JPEG preview at maximum 768 pixels; retain original bytes. HEIC preview is the display/edit source, original remains downloadable. Sequential batches, release temporary image resources. Wire existing upload dialog without new confirmation steps. Expected: browser HEIC/JPG upload, preview, month, original hash checks pass.
3. Documentation, source notices, local/cloud checks and one independent whole-branch review. Build both variants, preserve private Site, publish current repo source, verify hosted import with public samples. Expected: unit suite/typecheck/builds and hosted acceptance recorded separately.

## Review focus

Check MIME/container spoofing, HEIC sequence rejection, decoder resource lifetime, error and retry behavior, timezone-unknown dates, double orientation, HEIC display in collage/tone/reference flows, private original access, and preserving manual albums. Metadata parsing failure must be visible and must not be represented as capture-time success. No extra persisted full-size JPEG or original overwrite.

## Progress

- Branch starts at f5dc304df8c116812476f9a998bafeac61d6c967.
- Pre-flight: preparation produces original MIME, capture metadata and one preview; cloud client uploads these separately; server timeline must retain capture-local provenance and immutable originals.
- Ruling: reuse the Sites-managed checkout on a feature branch, rather than duplicate its ignored runtime state; publish/merge already authorized by this website-change request. Preserve research/example folders outside the product repository.
- Ruling: keep an unzoned EXIF wall-clock value as capture-local, without inventing an offset; known-offset capture timestamps retain the existing Hong Kong library-calendar behavior. No existing photo rows are rewritten.
- Final whole-branch review: one Important finding, exifr's default silentErrors hid corrupt-EXIF errors. Fixed by disabling silent errors; the corrupt-IFD regression was observed failing before the fix. No other findings or deferred minors from this review. Native Safari/device coverage remains untested; production acceptance is recorded separately.
