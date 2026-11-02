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

- [ ] Real-library onboarding after backup/restore and larger-volume validation.
- [ ] HEIC previews, original retention, Live Photo pairs and capture metadata.
- [ ] iCloud/PikPak import or synchronization after confirming supported interfaces.
- [ ] Large-file multipart resume, abandoned-upload retention policy and storage usage controls.
- [ ] Live AI provider integration, explicit generation provenance, cost limits and provider retry reconciliation.
- [ ] Multi-user sharing and explicit membership roles; the first release remains owner-private.

No real photo library, external model key, new cloud account or second source repository is required for the current milestone.
