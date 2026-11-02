# Cloud library validation

Started 2026-11-02; hosted checks continued on 2026-11-03 (Asia/Hong_Kong). Test media is the bundled `public/photos/1060.jpg`, never a personal gallery.

## Local evidence

- API contract tests exercise anonymous access, cross-owner access, pending uploads, MIME/size errors, idempotency, immutable original references, pagination, album/style records and stale revisions using real SQLite plus an isolated R2 test double.
- Client regressions exercise generated-image tones, stale snapshot writes, collections larger than 50 photos, response-loss Style retries, partial sample-batch retries and actual collage source ordering against the real API implementation.
- `tests/worker-smoke.mjs` passed against the running local Workers D1/R2 simulation: authenticated upload, conditional original writes, record edits, albums, Style reference, re-authentication and matching downloaded bytes.
- Static-demo and Worker builds and TypeScript checks passed. The framework reports non-fatal lucide barrel-optimization warnings; the icons render in the tested browser with no relevant runtime errors.

## Hosted evidence

- First full-stack deployment: source `a723fe283ca033b48cb94779e34430b253a53eae`, saved version `appgprj_6ae83417d6b88191a4873a4bffafe1d4~appgver_af8cba381a40819197b5b62da04d4f6a`, deployment `appgdep_6ae8b2b3bf6481919a78f587a66587c0` succeeded.
- Native database overview returned the `DB` binding and five tables: `albums`, `files`, `library_owner`, `photos`, `styles`.
- Authenticated browser loaded the owner-private cloud library. A cookie-free command-line request to the live API returned HTTP 401.
- Browser uploaded `moment-cloud-example.jpg` to real R2 and displayed the persisted photo. Downloaded original SHA-256: `82586f13e519cddd91b3b9a3790d088127e3b22cb882feef8c56ca639d7be6d2`, identical to the upload source.
- Hosted album/category/Style/collage, re-authentication, independent-client and redeployment readback are being completed after review fixes; they are not established by the local tests above.

## Limits

No live AI, personal-library import, physical iPhone test, capacity/load benchmark, second real user account or backup/restore drill has been run. The Site remains owner-private. Sharing and real-library onboarding stay deferred.
