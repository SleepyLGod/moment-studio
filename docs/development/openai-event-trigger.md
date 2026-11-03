# Website-triggered OpenAI subscription image proof

> Recheck on 2026-11-04: the earlier failure is not sufficient to attribute the cause to OpenAI. A separate, definite bug was found in our callback transport: Workers rejects `redirect: error` before sending HTTP. The correction and a real Workers-runtime regression test are implemented; online subscription creation still needs rechecking after publication.

## Goal and boundary

The owner clicks **Generate public sample** on `/cloud-proof`. The Site commits one public-coffee job and sends an MCP event to an already connected OpenAI Work Cloud listener. The listener claims the job, edits the fixed source with the native subscription image tool and saves actual output bytes through the Site MCP tool. No Mac process, paid API, third-party compute, private-photo input or manual-album write is involved.

An initial, one-time OpenAI event-listener setup is required. Publishing an MCP server does not itself create a listener. A missing/expired listener blocks queue creation with a clear error. Cloud execution, event acceptance and final image storage are separate states; `accepted` does not mean the image was generated.

```mermaid
sequenceDiagram
  participant W as Website button
  participant S as Private Sites API/MCP
  participant D as D1/R2
  participant O as OpenAI Work Cloud
  O->>S: events/subscribe (owner identity)
  S->>O: Signed verification challenge
  O-->>S: Echo challenge
  S->>D: Persist verified listener
  W->>S: POST /api/cloud-proof
  S->>D: Idempotent public-sample job
  S->>O: Signed public_sample.queued event
  O-->>S: Event accepted
  O->>S: Claim public sample once
  O->>S: Read fixed public image
  Note over O: Native subscription image edit
  O->>S: Save JPEG / SHA256 / lease / cloud task URL
  S->>D: Verify bytes, commit derivative + completed job
  W->>S: Read persistent task status
```

## Interfaces and state

- MCP advertises `events` in discovery and initialization, and implements `events/list`, `events/subscribe`, `events/unsubscribe`.
- `public_sample.queued` has no user-selectable filters; its payload contains only job ID and the fixed public photo ID `1060`.
- `public_cloud_connection` returns readiness/expiry, never signing secrets or callback URLs.
- `public_sample_image` exposes only the checksum-verified bundled JPEG, not arbitrary photo IDs or the private gallery.
- Existing claim/save tools retain owner checks, one claim, fenced commits, byte verification and idempotent delivery. Provenance accepts native Cloud and Work chat URLs.
- Listener state is one row per owner in `cloud_event_subscriptions`, via append-only migration `0007_new_the_leader.sql`. Secrets stay server-side. Default and maximum granted lifetime is 24 hours; OpenAI must refresh before expiration. Expiration or unsubscribe disables new delivery.
- Only fixed first-party OpenAI HTTPS callback hosts are accepted. Credentials in URLs, custom ports, fragments, arbitrary subdomains/IPs and redirects are rejected. The deployment trusts the fixed first-party domains' DNS; it does not implement a general-purpose callback fetcher or user-selectable URL routing.
- Standard Webhooks HMAC covers event ID, signing timestamp and exact body. Subscription IDs are deterministic. Verification challenges are random, bounded and compared without value-dependent early exit. Successful challenge caching is bounded; key rotation signs with both keys for five minutes.
- The button request awaits delivery, with at most three attempts for transient errors. The event ID/body remain stable across retries. A persisted delivery lease prevents concurrent sends; accepted events are not resent. Failed delivery can be retried from the same button without creating another job or re-running inference. No `waitUntil`, Mac poller, extra queue service or own-account Worker is used for this path.
- One new event-proof work key keeps the prior manually started proof and its image intact. This is still a bounded public-sample acceptance test, not arbitrary-photo production integration.

## Verification

Local protocol tests validate signatures/challenges, origin and redirect rejection, owner authorization, idempotent subscriptions/claims, repeated event delivery and unchanged manual albums. Local SQLite/R2 simulation is not hosted proof.

Hosted acceptance remains pending until the actual plugin discovers the event, OpenAI stores a verified listener, a website click delivers the event, an unattended OpenAI task creates and saves a fresh image, the Site reload/download checks match and the original manual-album rows compare exactly. No manual follow-up may perform the claim/generation on behalf of the event run.

## References

- [Official MCP Events implementation and lifecycle](https://developers.openai.com/plugins/build/mcp-events)
- [Native subscription image generation](https://learn.chatgpt.com/docs/image-generation)
- [Earlier explicitly started cloud round trip](openai-cloud-proof.md)

## Hosted outcome — 2026-11-04 (Hong Kong)

**Not end-to-end accepted.** Site v19 (`5181fb7`) is published owner-private, and the official plugin UI discovers all five tools plus `public_sample.queued`. A normal OpenAI Work Cloud capability check confirmed native image editing and cloud file/checksum tools. However, the official event-task creation interface did not establish a listener.

The Work Cloud verification chat reports these concrete creation outcomes:

1. Two attempts using the exposed declaration's `schedule: ""`, `timing_mode: "condition_watch"` and the exact discovered trigger returned the nested error `The task service returned an unexpected error`. The outer wrapper's `isError: false` was not treated as success.
2. Fresh event discovery says not to provide a schedule, and part of the create description says to omit both timing fields. One controlled attempt omitting both failed at argument binding: `InvalidActionArgumentsError: Missing required tool arguments: timing_mode`.
3. Supplying the required `timing_mode` while still omitting `schedule` then returned `Missing required tool arguments: schedule`.

After every failed creation, the verification chat checked the native task list and the Site's connection tool: no Moment task ID, no duplicate Moment task, and `{"ready":false,"expiresAt":null}`. The normal task-management UI also showed no Moment task; its available creation form exposed clock scheduling only. Existing unrelated tasks were untouched. There was no new queued public job, claim, inference or saved result in this automatic-trigger test. The older manually started successful proof remains a separate result.

The observed failures are contradictory timing-field guidance/binding errors and opaque creation errors; their causal source was not established. The subsequent runtime recheck found an error in our own callback transport, so the earlier service attribution must not be treated as proven. No downstream callback reason was returned. Added server diagnostics contain method/phase/origin only; absence of matching log entries is not proof that the downstream subscription was never attempted. Callback verification and event delivery remain unverified online.

The website keeps **Generate public sample** disabled until a real listener is ready. We did not replace this with Mac execution, a timed poller, another cloud service, private endpoint calls, copied subscription credentials, a paid API, or manual generation presented as an event run. All three manual-album rows compare exactly with their pre-change state.

[Evidence record](evidence/2026-11-04-openai-event-trigger.json) and [verification chat](https://chatgpt.com/c/6aea031e-ad80-83ee-a0e8-9e466e237c87). After the official task interface can create a webhook-only listener, resume at subscription readiness, then perform one actual website click and cloud-output/download readback. Do not repeat the image-generation proof manually as a substitute.


## Callback runtime and parameter recheck — 2026-11-04

The complete exposed create declaration accepts the generic Moment trigger `{connector_id, event, params}`; `schedule: ""` and `timing_mode: "condition_watch"` match both its required fields and one explicit paragraph of its description. A later paragraph says to omit them. Thus the omission experiments show a contract mismatch, but do **not** show that the original complete request was malformed or that OpenAI was unavailable. The update declaration is different: timing fields are optional, and it also supports the same generic trigger branch. No separate raw-webhook creation tool was exposed.

A concrete local bug was reproduced in workerd/Miniflare: `redirect: "error"` throws a `TypeError` before the request is sent. Our new callback used it, even though the existing NVIDIA and executor paths already use `manual`. Replaced it with `manual`; verification and delivery already reject non-2xx responses, so redirects remain forbidden. `tests/cloud-events-runtime.test.mjs` exercises the real callback module in the Workers runtime: it failed on the old code and passes on the correction, including 302 rejection. This uses a controlled callback and is separate from live OpenAI acceptance.

`public_cloud_connection` now includes the last authenticated setup phase/reason in a bounded diagnostic field in the existing owner state. It never exposes signing secrets or callback URL tokens. This will distinguish an actual incoming subscription failure from a creation failure that leaves no recorded authenticated setup. A missing diagnostic alone does not rule out earlier authorization or routing failure.

Official alternative routes checked:

| Route | Fit for this experiment | Evidence / limitation |
| --- | --- | --- |
| MCP Events from the private Site | Preferred: direct event, native subscription processing | [MCP Events](https://developers.openai.com/plugins/build/mcp-events); needs a verified listener and an actual click-to-result test |
| OpenAI hosted task checking the Site queue | Cloud-only, but polling adds latency and idle task usage | [Hosted schedules](https://learn.chatgpt.com/docs/automations); not silently substituted for a direct trigger |
| Existing GitHub PR comment mentioning Codex | Official cloud-chat trigger, but adds a PR/comment as a job carrier | [GitHub integration](https://learn.chatgpt.com/docs/third-party/github); no PR, comment or permission change was made for this research |
| Codex GitHub Action | Excluded | [Official prerequisites](https://learn.chatgpt.com/docs/github-action) require an OpenAI API key; no credentials were copied and no workflow was added |
| Slack / Linear / GitLab triggers | Excluded from this scope | Would add another connected service/workspace; not configured |

Online outcome for the correction is pending; no new inference is authorized by the test code itself.
