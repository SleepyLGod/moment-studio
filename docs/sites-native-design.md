# Sites-native private library

Approved direction: the existing owner-private Site runs the UI and TypeScript API; Sites provisions D1 (`DB`) for records and R2 (`BUCKET`) for files. Go/PostgreSQL and alternative hosting are deferred in `TODO.md`.

The shared React UI uses a cloud resource client on Sites and browser storage only in the static demo. It does not migrate existing browser data. Library initialization inserts bundled example metadata once through an atomic D1 batch; sample images remain bundled public examples. User uploads, references and saved rendered results are private R2 objects.

## Interfaces and data

- `/api/me` authenticates through the official server-side ChatGPT helper. The first platform-authenticated visitor to this owner-private Site initializes the single library owner; all subsequent requests must match that owner. Sharing changes require a separate membership implementation.
- `/api/bootstrap` initializes example records atomically and idempotently, outside schema migrations.
- `/api/uploads`: create an upload session with a stable client ID, declared MIME, size, name and purpose; PUT bytes to `/:id/body`; POST `/:id/complete` verifies the object and marks it readable. Only JPG/PNG/WebP up to 12 MiB are accepted. Pending objects never appear as gallery records.
- `/api/files/:id`: authenticated original/rendered file reads and downloads. File IDs resolve to server-owned object keys. Responses are private/no-store; original objects use create-only R2 writes.
- `/api/photos`, `/api/albums`, `/api/styles`: owner-scoped list/get/PUT. Lists use stable cursors; writes use record revisions to reject stale edits. Each record is bounded metadata, never a base64 image or entire library snapshot.
- The browser renders collages, tones and previews. Saved files are uploaded before their metadata is acknowledged. Failed or partial operations show errors and preserve retry IDs. Source files and parent relationships remain intact.

## Deployment and evidence

Use the official Vinext starter, its `sites()` integration, Drizzle migrations and Sites source/publish helper. The static hosting declaration is replaced by logical D1/R2 bindings while preserving project identity and private audience.

Node tests use real SQLite plus an isolated object-storage test double; `tests/worker-smoke.mjs` exercises local Workers D1/R2 through HTTP and local mock sign-in. These are distinct from hosted acceptance. Production authentication and persistence must be exercised through the published Site using example photos, with file-byte comparison and readback after a later deployment. No live AI or real-library import is implied.
