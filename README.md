# moment

A private photo workbench: collect photos, compose albums and collages, and save reusable Style recipes. The same React UI runs as a Sites cloud app or a browser-local static demo.

![Library](docs/screenshots/library.png)

## Cloud architecture

Sites hosts the TypeScript API and UI using its official Vinext starter. D1 stores owner-scoped metadata; R2 stores uploads, previews, references and rendered results. The existing Site identity and owner-private audience are preserved.

Uploads accept still HEIC, JPG, PNG and WebP, up to 12 MiB per file and 20 files per batch. Uploaded originals are immutable. The browser creates one upright JPEG preview (maximum 768 pixels), without persisting an extra full-size JPEG. HEIC display, tones and collages use that preview; original downloads retain the uploaded bytes. Files are readable only through authenticated owner-scoped routes. Existing browser data is not automatically imported.

Albums, category changes, Style recipes and saved creations use resource APIs. Collages and tones still render in the browser. Cloud Style Lab uses FLUX.2 Klein 4B on the owner’s Cloudflare Workers AI account for prompt-based image editing. Output is explicitly Original or Custom; unsupported sizes show an error rather than silently resizing or cropping. Each result is a separate file, preserving the original. Photos can be moved to recoverable Trash; this hides them without reclaiming file bytes. The static demo retains nine pre-generated examples. iCloud synchronization is not connected.

## Development

[Developer documentation](docs/development/README.md) contains architecture diagrams, interface contracts and separate local/cloud evidence. Owner-only **AI tags** submits persisted analysis jobs, advanced by an own-account Cloudflare Cron Worker while the page is closed. Models refresh on page load and prefer the last successful compatible profile. **Months** opens indexed monthly photo pages; **Recent** derives small groups from existing AI tags and dates, without changing manual albums. See [rules and acceptance](docs/development/models-and-organization.md). See [live image editing](docs/development/cloudflare-style-edit.md) for the free-only profile and task contract.

Use Node.js 24+ and npm. Install with `npm install`; run `npm run build` once to generate local Worker binding configuration. Apply the SQL files in `drizzle/` in order using the local commands in [DEPLOYMENT.md](DEPLOYMENT.md), then run `npm run dev -- --port 4174`.

The portable preview offers mock ChatGPT sign-in only on loopback. Hosted sign-in is managed by Sites; no local mock identity is used in production. Local and hosted databases/files are separate.

For the static demo, run `npm run dev:demo` (port 4173) or `npm run build:demo` (output `dist-demo/`). Demo records stay in that browser's IndexedDB and never write to the production API. Use `DEMO_BASE=/moment-studio/` for a project Pages build.

## Checks

- `npm test`: exact pre-generated sample provenance and backend authorization/upload/resource tests.
- `npm run typecheck`: TypeScript check.
- `npm run build`: Sites Worker build in `dist/`.
- `npm run build:demo`: independent static demo build.
- `node tests/worker-smoke.mjs http://127.0.0.1:4174`: running local Workers integration; uses only bundled example photos and leaves named QA records.

[DEPLOYMENT.md](DEPLOYMENT.md) distinguishes local simulation, source synchronization and hosted verification. [The active design](docs/sites-native-design.md) describes the resource boundaries. [TODO.md](TODO.md) contains Go/PostgreSQL, Docker, migration, Pages publication and other future work.

## Boundaries

EXIF capture dates drive monthly organization. Unknown camera timezones stay explicitly unknown; missing capture dates use file modification dates. See [import behavior and validation](docs/development/heic-import.md). Live Photos, HEIC sequences, videos, multi-user sharing, real-library migration are not implemented. Private records use the authenticated owner identity; sharing this Site with additional viewers requires an explicit membership design. User-authored names, notes and prompts retain their language; controls remain English with Sleet Mono and Chinese fallbacks.

[Asset notes](docs/ASSETS.md) document the bundled example photos, generated samples and font license. The screenshots above are illustrative, not evidence of a hosted persistence test.

The [website-triggered OpenAI subscription proof](docs/development/openai-event-trigger.md) has passed actual public-sample click-to-result acceptance: a website click sends an MCP event, an enabled OpenAI cloud task edits the image using the native subscription tool, and actual output returns to private D1/R2. Reopened-page and downloaded-file checks passed, with manual albums unchanged. This route uses no Mac runner, paid API, new cloud service or timed poller. View `/cloud-proof` on the private Site. It remains one fixed public sample per owner; general Style Lab integration and long-term listener renewal are separate work. The [earlier explicitly started cloud proof](docs/development/openai-cloud-proof.md) is retained as historical evidence.
