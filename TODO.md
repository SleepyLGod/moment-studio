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
- [ ] Implement website model-directory refresh and last-successful compatible model preference; freeze model per batch. Initial hosted analyzer uses the verified Nemotron profile.
- [ ] Month view, manual labels/exclusions, and recent automatic grouping without a confirmation inbox or mutation of manual albums.

- [ ] Real-library onboarding after backup/restore and larger-volume validation.
- [ ] HEIC previews, original retention, Live Photo pairs and capture metadata.
- [ ] iCloud/PikPak import or synchronization after confirming supported interfaces.
- [ ] Large-file multipart resume, abandoned-upload retention policy and storage usage controls.
- [ ] Live image editing integration, explicit generation provenance, cost limits and provider retry reconciliation. Text-output photo analysis is already connected; Style Lab still uses pre-generated examples.
- [ ] Multi-user sharing and explicit membership roles; the first release remains owner-private.

No real photo library or second source repository is required. Hosted analysis uses a server-side NVIDIA key and the owner's Cloudflare executor account; credentials remain outside source.
