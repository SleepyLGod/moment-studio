# Sites + static demo, one repository

The active backend is Sites-native TypeScript/Workers + D1 + R2. Go/PostgreSQL and independent container hosting are future alternatives in `TODO.md`.

## Sites

Reuse the project_id in `.openai/hosting.json`. The manifest declares `d1: DB` and `r2: BUCKET`; Sites provisions hosted resources. It must not contain the old static directory declaration. Keep the official starter's build and `sites()` integration.

Existing address: <https://moment-studio-sleepylgod-demo.von-lu-cuhk.chatgpt.site>. Preserve owner-private access. Hosted authentication is supplied by Sites; API handlers additionally require identity and record ownership. Platform service-access tokens do not supply a visitor identity and cannot substitute for user authorization.

Generate schema-only migrations with `npm run db:generate`, inspect the SQL and commit SQL plus Drizzle metadata. Applied migrations are immutable. Local migrations and hosted migrations are independent; Sites applies hosted migrations during publication.

Use the Sites source helper to build, push the exact source and package `dist/`; save and deploy that same commit. GitHub source synchronization is separate from Sites publication. A successful frontend build does not prove that D1 or R2 are connected.

## Local simulation

After a build, apply each migration in filename order, substituting its exact path:

    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_ambitious_black_cat.sql
    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_loud_blue_blade.sql

Run `npm run dev -- --port 4174`. Mock sign-in is only for loopback development and is excluded from hosted production. `.wrangler/state` contains local simulated records and files; it is ignored and must not be treated as hosted storage or uploaded as source.

## Static demo / GitHub Pages

`npm run build:demo` builds the same UI from `demo/index.html` into `dist-demo/`. Only this mode uses IndexedDB records. Set `DEMO_BASE=/moment-studio/` for the Pages project path. No production credentials are bundled.

Pages publication is deferred until private-repository entitlement is confirmed. Do not create a second source repo or change repository visibility as a workaround. The existing personal homepage is unchanged.

## Acceptance and recovery

Local unit tests, local Workers HTTP tests and hosted browser tests are separate evidence. Hosted acceptance requires example upload/download byte equality, owner-only reads, persisted album/style/creation records, re-authentication and readback after redeployment. Record actual results in `docs/cloud-validation.md` when performed.

Code-version rollback does not restore database or uploaded files. Before a real gallery is onboarded, design database/file export and perform a restore drill. No implicit real-browser-data migration, real-library upload, live-model call or file cleanup is part of this release.
