# Deployment

One source repository builds two editions. GitHub Actions publishes the static demo. Sites publishes the authenticated workspace from an exact pushed commit.

| Edition | Entry | Build | Hosting |
| --- | --- | --- | --- |
| Demo | `demo/index.html` | `DEMO_BASE=/moment-studio/ npm run build:demo` | [GitHub Pages](https://sleepylgod.github.io/moment-studio/) |
| Private workspace | `app/`, `worker/`, `server/` | `npm run build` | Existing owner-private Sites project |

## Public demo

The [Pages workflow](.github/workflows/pages.yml) builds on pushes to `main` and can also run manually. Pages uses GitHub Actions as its source. The deployment artifact contains the HTML, frontend bundles, bundled sample images and their public credits, fonts and license files. It excludes the Sites build, private files and test records. The demo runs in browser-local mode and uses IndexedDB.

The source repository is private. GitHub's Pages entitlement for this repository permits the demo to be public. The project URL uses the `/moment-studio/` path under the account's existing `.github.io` address. Release checks should open that path in a browser and exercise sample images, the font and one sample Style result.

## Private Sites workspace

Reuse the `project_id` in `.openai/hosting.json` and the existing owner-only audience. Sites provisions the manifest's D1 (`DB`) and R2 (`BUCKET`) bindings and supplies visitor identity. API handlers also enforce owner and resource checks. Service-access tokens do not supply a visitor identity.

Use the Sites source helper to push the exact checked commit and package `dist/`. Save and deploy that same commit through Sites, then verify its deployment status and owner-only audience. A GitHub push publishes the demo through Actions, while the private workspace uses the Sites publication workflow.

Sites applies SQL migrations during publication. Generate new ones with `npm run db:generate`, inspect them and commit the SQL plus Drizzle metadata. Treat applied migrations as immutable.

### AI execution

- [Style Lab](docs/development/style-lab-subscription.md) uses the private Sites plugin and an OpenAI cloud task triggered by `style_edit.queued`. The existing listener has its own renewal lifecycle. The private site's Settings shows readiness and expiry.
- [NVIDIA photo tags](docs/development/models-and-organization.md) use the same-repo [Cloudflare Cron executor](executor/README.md). It wakes the private Sites runner. Job records and images stay with Sites. Store `MOMENT_EXECUTOR_KEY`, `MOMENT_SITE_ACCESS_TOKEN` and `NVIDIA_API_KEY` as applicable platform secrets.
- [Cloudflare FLUX.2 experiments](docs/development/cloudflare-style-edit.md) and the [public-sample OpenAI proof](docs/development/openai-event-trigger.md) are separate historical routes. The active Style Lab uses the subscription task above.

## Deploy your own copy

The source repository is private. Obtain access and permission from its owner before copying or deploying it. The application's source has no public open-source license. A new installation starts with an independent database, file storage and connections.

1. **Browser demo.** Use `npm run dev:demo` locally or publish the static build. If you publish under a different project name, set `DEMO_BASE` in the Pages workflow to that project's URL path. This edition uses sample images and browser-local storage and needs no AI credentials.
2. **Private cloud library.** Create your own ChatGPT Site and publish from its own source repository. Replace the existing `project_id` in `.openai/hosting.json` with the new Site's ID and retain the D1, R2 and MCP declarations. Sites provisions fresh storage. Keep the audience owner-only, then test login, upload and original download before enabling AI.
3. **NVIDIA photo tags.** Get your own NVIDIA API key with access to a compatible vision endpoint. Set `NVIDIA_API_KEY` on your Site, change `SITE_ORIGIN` in `executor/worker.mjs` to your new Site URL, and deploy the Cron Worker to your own Cloudflare account. Use a new shared `MOMENT_EXECUTOR_KEY` and your new Site's `MOMENT_SITE_ACCESS_TOKEN`, following the [executor setup](executor/README.md).
4. **Live Style Lab.** In an eligible ChatGPT Work account or workspace, connect the plugin provisioned by your new Site. Create your own cloud task for `style_edit.queued` with access to native image editing. Follow the [task setup](docs/development/style-lab-subscription.md#cloud-task-setup) and confirm that Settings reports a connection. Test one public sample through to a saved result. This route uses the connected subscription.

The existing hosted installation has been exercised. This checklist has not been run end to end on a second account. Check Sites, plugin and event-trigger availability in the intended account before relying on live editing.

## Local cloud simulation

Use Node.js 24. Install dependencies, build once, and apply migrations to a fresh local store in filename order.

```sh
npm ci
npm run build
for migration in drizzle/*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB \
    --local --config dist/server/wrangler.json --persist-to .wrangler/state --file "$migration" || exit 1
done
npm run dev -- --port 4174
```

For an existing local store, apply only its outstanding migrations. The loopback preview has mock sign-in. `.wrangler/state` is local, ignored and separate from hosted data.

## Verify and recover

`npm run check` runs the tests, type checking and both builds. For local HTTP verification, run `node tests/worker-smoke.mjs http://127.0.0.1:4174` against a disposable store. Use bundled examples for hosted checks and document hosted outcomes separately in [Cloud validation](docs/cloud-validation.md). For changes to Trash, verify mixed outcomes locally and use read-only impact previews on the real site.

A code rollback cannot restore deleted data. Permanent deletion checks links again at execution, protects shared files and preserves photos that cannot be deleted. Export and restore drills are still open.
