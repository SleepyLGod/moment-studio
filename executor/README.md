# Own-account executor

This Worker is in the same repository as the Sites app. Its scheduled handler awaits one bounded call to the fixed moment Site, once per minute. D1 stores tasks; no second queue or database is introduced. The Site runs analysis business code and persists all task state. For image edits, this Worker invokes its AI binding once and returns the bytes to the authenticated Site completion endpoint. Both flows run independently of browser state.

## Configuration

Wrangler 4.92.0 is pinned in the root dependencies. OAuth and deployment completed on 2026-11-03 in the owner's account. Scopes are account/user read, Workers/script write and tail read, plus OAuth offline access. See [actual cloud evidence](../docs/development/cloud-executor-validation.md) for versions, successful closed-browser analysis and remaining fault-injection limits.

Project-local Wrangler authentication can be isolated with `XDG_CONFIG_HOME="$PWD/.wrangler/executor-cli"`; `.wrangler/` is ignored. Set `WRANGLER_LOG_PATH` to an ignored or temporary path so the CLI does not try to write global system settings. Do not commit CLI credentials or copy them into this document.

The executor requires two encrypted secrets:

- `MOMENT_EXECUTOR_KEY`: a dedicated random key, also configured on the Site. It authorizes only the task-advancement endpoint.
- `MOMENT_SITE_ACCESS_TOKEN`: the platform service-access token for this exact Site. It is only sent to that fixed origin, never to NVIDIA or a URL supplied by a request.

The Sites app separately requires `NVIDIA_API_KEY`, the same executor key, and the explicit `MOMENT_BACKGROUND_ENABLED=true` switch. Leave the switch unset/false until a working executor and a deliberate example-only acceptance run are ready. Secret values are not stored in this repo or browser code.

`workers_dev=false` and no routes means the executor has no public URL. Its code also protects diagnostic `POST /run` with the dedicated key, but that route is not externally exposed. Cron execution requires no public request and awaits the upstream response. Failure propagates to Cron logs instead of reporting success. The next tick scans D1 again; leases fence overlapping/expired invocations. Both outbound requests use `redirect: manual` and reject non-200 responses; Cloudflare does not implement `redirect: error`.

## Checks completed locally

```sh
node --test tests/executor.test.mjs tests/jobs.test.mjs
node node_modules/wrangler/bin/wrangler.js deploy --config executor/wrangler.jsonc --dry-run
```

The dry-run bundles code without deploying or configuring Cron. It does not prove account access, private Site access, cloud D1 execution or closed-browser completion.

## Cloud acceptance procedure

1. Complete Cloudflare OAuth; inspect/select the intended account and confirm the Worker name does not belong to an unrelated existing project.
2. Deploy the narrowly authenticated Sites runner with append-only migration 0003 and required secrets. Validate that missing/wrong keys still fail and ordinary private files still require identity.
3. Put executor secrets through official secret input, deploy this Worker and configure its one-minute Cron. Check the actual saved trigger, not just the build output.
4. Prepare one non-personal example photo in private R2 and create its analysis task through owner-authenticated access. Close all app pages. Read the resulting D1 job/photo through an independent later session and correlate actual scheduled Worker logs.
5. Exercise overlap and expired-lease recovery in the cloud; preserve downloaded original hash. Then enable the broader UI work in the implementation plan.

Closed-browser completion, actual scheduled logs, D1 readback, original hash and cloud overlap checks passed. Expired-lease recovery and old-token fencing passed local SQLite tests only; production fault injection remains pending. No personal library was processed.

## Free-only image edits

The `AI` binding invokes only `@cf/black-forest-labs/flux-2-klein-4b`, with existing previews and optional style reference, fixed 512×512 output. Enable `MOMENT_IMAGE_EDIT_ENABLED=true` on the Site only after verifying the owner account is Workers Free. No paid plan is activated by this configuration; the provider’s daily free limit is the cap. Upgrading the account later would change that billing behavior and requires a separate decision.

The existing secrets also authorize `POST /api/internal/jobs/:id/result`, fenced by `x-job-lease`. The executor retries delivery of the same result at most twice; it never repeats an uncertain model call. An expired image lease becomes `unknown`, while NVIDIA analysis retains its existing safe retry rules. See [image editing contract and evidence](../docs/development/cloudflare-style-edit.md).
