# Later work

The active implementation uses Sites TypeScript/Workers + D1 + R2. These items do not block the Sites-native milestone.

## Alternative hosting

- [ ] Independent Go backend with PostgreSQL, preserving the gallery API and export contracts.
- [ ] Docker self-hosting, persistent volumes, standalone login and restore instructions.
- [ ] Independent cloud deployment and its operating costs.
- [ ] Own-account Cloudflare Containers; verify ephemeral disks, wake-up, task leases and external PostgreSQL.
- [ ] Explicit database/file/owner export-import for migration; local and cloud libraries do not automatically synchronize.
- [ ] GitHub Pages publication from this same repository after checking private-repository entitlement; use the demo build without production credentials or endpoints.

## Gallery expansion

- [x] Close the unattended execution gap using one same-repository own-account Cron Worker. Closed-browser example completion is verified; see [cloud evidence](docs/development/cloud-executor-validation.md).
- [ ] Safely validate expired-lease recovery under a cloud execution interruption; local tests pass, no production SQL/debug endpoint is added for testing.
- [x] Website model-directory refresh and last-successful compatible model preference; freeze model per job. Initial profile is the verified Nemotron analyzer.
- [x] Month view and recent derived groups without a confirmation inbox or manual-album writes.
- [ ] Manual labels/exclusions and EXIF capture-date extraction; uploads currently identify file-modified dates honestly.
- [ ] Historical Hong Kong DST boundary: migration 0005 uses fixed UTC+8, while later saves use IANA Asia/Hong_Kong. A legacy `capturedAt=1979-05-31T15:30:00Z` can move from May to June on edit. Current 2026 records are unaffected; reconcile historical backfill before EXIF/legacy-library onboarding.

- [ ] Real-library onboarding after backup/restore and larger-volume validation.
- [x] Still HEIC previews, immutable original retention, capture-time metadata and upright display; see `docs/development/heic-import.md` for coverage.
- [ ] Live Photo pairs, HDR-preserving creative input and full-resolution HEIC editing.
- [ ] iCloud/PikPak import or synchronization after confirming supported interfaces.
- [ ] Large-file multipart resume, abandoned-upload retention policy and storage usage controls.
- [x] Cloudflare Free FLUX.2 Klein 4B image edit integration with immutable derivatives and conservative unknown-state handling. See `docs/development/cloudflare-style-edit.md`.
- [ ] Higher-resolution profiles, richer task history and long-running provider reconciliation after first live acceptance.
- [ ] Multi-user sharing and explicit membership roles; the first release remains owner-private.

No real photo library or second source repository is required. Hosted analysis uses a server-side NVIDIA key and the owner's Cloudflare executor account; credentials remain outside source.
