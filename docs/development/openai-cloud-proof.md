# Public-sample OpenAI cloud round trip

## Scope

Validate Sites → an OpenAI cloud task → native subscription image editing → private Sites D1/R2 storage. No Mac inference runner, paid OpenAI API, new cloud service, personal photo, or manual-album mutation. This is a bounded experiment, separate from the existing Cloudflare editing provider.

`/cloud-proof` queues exactly one bundled public coffee sample (`1060`). Repeated clicks return the same job. At this stage a cloud task is explicitly started for the experiment; **automatic website-to-task triggering has not been implemented or verified**. Do not describe this as a production Style Lab provider yet.

## Interfaces

```mermaid
sequenceDiagram
  participant P as Private Sites page
  participant S as Sites API / MCP
  participant D as D1 / R2
  participant C as OpenAI cloud task
  participant I as Native subscription image tool
  P->>S: POST /api/cloud-proof
  S->>D: One subscription-proof job
  Note over C: Cloud task started for this experiment
  C->>S: claim_public_sample (owner identity)
  S-->>C: Public sample / prompt / one-hour lease
  C->>I: Edit public source once
  I-->>C: Actual generated image file
  C->>S: save_public_sample_result (JPEG bytes / SHA-256 / lease / task URL)
  S->>D: Verify R2 bytes; commit file + derivative + task state
  P->>S: GET /api/cloud-proof
  S-->>P: Result read through private /api/files/:id
```

- `POST /mcp`: MCP discovery and three narrow tools: status, claim, save. Sites authenticates callers; all tool execution also checks the existing library owner. No private-photo enumeration, album writes or arbitrary source uploads.
- Existing `jobs` table, isolated `subscription-proof` kind. Existing own-account Worker claims only `edit`/`analyze`; it cannot execute this experiment.
- Claim is atomic and non-repeatable. Uncertain/expired execution is not automatically re-generated. Save retries compare actual bytes and original task provenance.
- Result is a JPEG at the generated dimensions, up to 2 MiB. No upscaling or square crop. One persistent result file also serves as its preview; original public photo remains immutable. The full native output may also remain in the cloud task's ordinary output directory.
- R2 checksum readback precedes a fenced D1 transaction. Photo carries original relationship, prompt, task URL, dimensions and result SHA-256. Failed metadata commit cannot appear as completed.
- MCP accepts bounded JSON (3 MiB), all ordinary gallery metadata retains its existing 64 KiB limit. No login cookie or subscription credential is copied into the Site.

## Validation status

Local regression and hosted evidence are recorded separately. Before claiming a full round trip: queue through the deployed page, observe a real OpenAI cloud task claim and generation, observe its save tool success, reload the deployed page, download and compare SHA-256, and compare manual-album rows before/after. A standalone model image or local simulated R2 is insufficient.

## References

- [Sites MCP server](https://learn.chatgpt.com/docs/extend/mcp)
- [OpenAI cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)
- [Image generation](https://learn.chatgpt.com/docs/image-generation)
- [MCP Events](https://developers.openai.com/plugins/build/mcp-events) describes a possible hosted trigger; availability in the chosen cloud task and Site connection must be tested before selecting it.

## Observed hosted result — 2026-11-03

The explicitly started normal task in `moment-subscription-probe` successfully claimed Site job `b4b83c60-7fc6-4c09-b9c4-77b64952dc43`, generated a fresh layered-paper coffee image, and called the Site's save tool. The generation and conversion ran on OpenAI cloud Linux, not the Mac. The validation browser tab was closed while the task ran. Native MCP status subsequently returned `succeeded`.

The saved JPEG is **1422 × 1106**, **544,973 bytes**. Reloading `/cloud-proof` displayed the actual image at those natural dimensions. Downloading it through the authenticated Site returned SHA-256 `181d5be03f008532f1ee1fecb22d253c7c494275347725e17fbba581a080409d`, exactly matching the cloud-saved result. Anonymous file and MCP tool requests both returned **401**. All three manual-album rows were read using the native live D1 inspector before and after, without projection truncation, and were exactly unchanged.

[Machine-readable evidence](evidence/2026-11-03-openai-cloud-roundtrip.json) separates UI observations, native readbacks and cloud-task reports. Local checks passed 76 tests, typecheck, static-demo and full-stack builds. No paid OpenAI API, Mac inference runner or new cloud service was used. Exact subscription-quota consumption was not measured.

**Remaining boundary:** this proves cloud processing and automatic result delivery after an explicitly started task. It does not prove that pressing the website button automatically creates/wakes an OpenAI task. That trigger needs its own implementation and hosted acceptance; MCP Events in a supported Work Cloud chat is a documented candidate, not a tested guarantee for this Codex environment.
