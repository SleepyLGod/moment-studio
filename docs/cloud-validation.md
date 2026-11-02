# Cloud library validation

Started 2026-11-02; hosted checks continued on 2026-11-03 (Asia/Hong_Kong). Test media is the bundled `public/photos/1060.jpg`, never a personal gallery.

## Local evidence

- API contract tests exercise anonymous access, cross-owner access, pending uploads, MIME/size errors, idempotency, immutable original references, pagination, album/style records and stale revisions using real SQLite plus an isolated R2 test double.
- Client regressions exercise generated-image tones, stale snapshot writes, collections larger than 50 photos, response-loss Style retries, partial sample-batch retries and actual collage source ordering against the real API implementation.
- `tests/worker-smoke.mjs` passed against the running local Workers D1/R2 simulation: authenticated upload, conditional original writes, record edits, albums, Style reference, re-authentication and matching downloaded bytes.
- All 13 API/client tests and nine pre-generated sample provenance checks passed. Static-demo and Worker builds and TypeScript checks passed. The framework reports non-fatal lucide barrel-optimization warnings; the icons render in the tested browser with no relevant runtime errors.

## Hosted evidence

- First full-stack deployment: source `a723fe283ca033b48cb94779e34430b253a53eae`, saved version `appgprj_6ae83417d6b88191a4873a4bffafe1d4~appgver_af8cba381a40819197b5b62da04d4f6a`, deployment `appgdep_6ae8b2b3bf6481919a78f587a66587c0` succeeded.
- Native database overview returned the `DB` binding and five tables: `albums`, `files`, `library_owner`, `photos`, `styles`.
- Authenticated browser loaded the owner-private cloud library. A cookie-free command-line request to the live API returned HTTP 401.
- Browser uploaded `moment-cloud-example.jpg` to real R2 and displayed the persisted photo. Downloaded original SHA-256: `82586f13e519cddd91b3b9a3790d088127e3b22cb882feef8c56ca639d7be6d2`, identical to the upload source.
- Reviewed release v4: source `cb539520774cf6c27e9eb0902c5dfcff8746809a`, version `appgprj_6ae83417d6b88191a4873a4bffafe1d4~appgver_e44b2cdb8ec48191a253efa080d9fbe1`, deployment `appgdep_6ae8b7927c348191a90246c9b8ea1524` succeeded. The v3 upload and `Cloud check` album remained readable after this redeployment.
- Classified the uploaded example as Travel. Saved the `Cloud check` note; reordered the seeded mountain album and reloaded the Site to confirm the new order persisted.
- Saved the pre-generated Paper cut fjord result, applied the Mono tone to that result, and read its retained original. Saved the browser-rendered `Mountains & water` collage to R2. These operations brought the hosted gallery to 15 photos.
- Saved `Graphite notes` with prompt `Soft graphite illustration, warm paper and gentle light.` and the bundled coffee reference. Its private reference loaded, and the recipe remained explicitly Not generated.
- An independent in-app-browser tab loaded all 15 images, the saved collage, recipe and reference. Then an actual sign-out reached the login gate; the user completed OpenAI login, after which the same 15 photos, custom Style and reference were readable. Album order also survived a full page reload.
- GitHub Actions passed on Linux/Node 24 for source `cb53952`: [run 41479731220](https://github.com/SleepyLGod/moment-studio/actions/runs/41479731220).
- Restored the original localhost:4173 demo URL after the entry-point migration. Its entry module returned JavaScript (previously HTML), and the browser displayed the existing 20 browser-local demo photos independently of the hosted 15-photo library.

## Limits

Independent in-app-browser and actual logout/relogin were tested; a separate Chrome check was blocked by browser host policy and remains unverified. No live AI, personal-library import, physical iPhone test, capacity/load benchmark, second real user account or backup/restore drill has been run. Cross-owner authorization and failure/retry edge cases were checked locally; those checks are not claims of a second-user or network-fault exercise on production. The Site remains owner-private. Sharing and real-library onboarding stay deferred.
