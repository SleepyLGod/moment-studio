# Later work

## Data and import

- [ ] Export original files, derivatives and metadata. Test restoring them into a clean library before larger real-library onboarding.
- [ ] Measure large-library storage and add usage visibility. Decide on resumable uploads and cleanup of abandoned uploads separately from recoverable Trash.
- [ ] Handle Live Photos, HEIC sequences and higher-fidelity HEIC creative input if needed.
- [ ] Reconcile legacy month backfill around historical Hong Kong DST. Migration 0005 uses fixed UTC+8 while later saves use IANA Asia/Hong_Kong.
- [ ] Revisit iCloud or PikPak only when a supported import workflow is needed.

## AI and organization

- [ ] Observe a real automatic ChatGPT renewal of the Style Lab listener. Same-ID renewal and signing-key rotation pass local tests.
- [ ] Validate expired analysis-lease recovery under a real cloud interruption. Local lease-fencing tests already cover recovery.
- [ ] Evaluate provider and output options using public samples, including aspect preservation and actual output dimensions.
- [ ] Add manual tag corrections and exclusions if the current month and recent views need them.

## Optional architecture

- [ ] Compare Go/PostgreSQL, Docker self-hosting, independent cloud hosting and Cloudflare Containers after data export exists.
- [ ] Design explicit membership roles if private-library sharing becomes a product requirement.
