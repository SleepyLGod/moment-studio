# Own-account executor (not yet deployed)

This Worker is in the same repository as the Sites app. Its scheduled handler awaits one bounded call to the fixed moment Site, once per minute. D1 stores tasks; no second queue or database is introduced. The Site runs the analysis business code, while this Worker supplies the scheduled invocation independent of browser state.

## Configuration

Wrangler 4.92.0 is already pinned in the root dependencies. Official login was initiated with only account/user read and Workers write permissions (offline access is required by OAuth). Current authorization is incomplete.

Project-local Wrangler authentication can be isolated with `XDG_CONFIG_HOME="$PWD/.wrangler/executor-cli"`; `.wrangler/` is ignored. Set `WRANGLER_LOG_PATH` to an ignored or temporary path so the CLI does not try to write global system settings. Do not commit CLI credentials or copy them into this document.

The executor requires two encrypted secrets:

- `MOMENT_EXECUTOR_KEY`: a dedicated random key, also configured on the Site. It authorizes only the task-advancement endpoint.
- `MOMENT_SITE_ACCESS_TOKEN`: the platform service-access token for this exact Site. It is only sent to that fixed origin, never to NVIDIA or a URL supplied by a request.

The Sites app separately requires `NVIDIA_API_KEY`, the same executor key, and the explicit `MOMENT_BACKGROUND_ENABLED=true` switch. Leave the switch unset/false until a working executor and a deliberate example-only acceptance run are ready. Secret values are not stored in this repo or browser code.

The public executor route accepts only authenticated `POST /run` for deliberate testing; all other paths return 404. Cron execution requires no public request and awaits the upstream response. Failure propagates to Cron logs instead of reporting success. The next tick scans D1 again; leases fence overlapping/expired invocations.

## Checks completed locally

```sh
node --test tests/executor.test.mjs tests/jobs.test.mjs
node node_modules/wrangler/bin/wrangler.js deploy --config executor/wrangler.jsonc --dry-run
```

The dry-run bundles code without deploying or configuring Cron. It does not prove account access, private Site access, cloud D1 execution or closed-browser completion.

## Required cloud acceptance

1. Complete Cloudflare OAuth; inspect/select the intended account and confirm the Worker name does not belong to an unrelated existing project.
2. Deploy the narrowly authenticated Sites runner with append-only migration 0003 and required secrets. Validate that missing/wrong keys still fail and ordinary private files still require identity.
3. Put executor secrets through official secret input, deploy this Worker and configure its one-minute Cron. Check the actual saved trigger, not just the build output.
4. Prepare one non-personal example photo in private R2 and create its analysis task through owner-authenticated access. Close all app pages. Read the resulting D1 job/photo through an independent later session and correlate actual scheduled Worker logs.
5. Exercise overlap and expired-lease recovery in the cloud; preserve downloaded original hash. Then enable the broader UI work in the implementation plan.

Nothing in this README claims these cloud steps have passed.
