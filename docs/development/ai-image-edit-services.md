# Custom-photo image editing services

Checked 2026-11-03. Official documentation research only: no new account, paid plan, AI permission or paid inference was created. Provider account entitlement and inference quality remain untested.

## First candidate: Cloudflare Workers AI FLUX.2 Klein

- [FLUX.2 Klein 4B](https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/) supports editing. The official [multi-reference API example](https://developers.cloudflare.com/changelog/post/2026-01-28-flux-2-klein-9b-workers-ai/) covers 4B/9B using binary `input_image_0`–`input_image_3`, unlike NVIDIA's preset-image preview. The example limits inputs to 512×512; check the exact current schema before implementation.
- [Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/): 10,000 free neurons/day on Free and Paid plans; listed 4B costs are 5.37 neurons per input 512×512 tile and 26.05 per output tile. Do not promise a fixed number of free generations without exact dimensions, shared account usage and live metering.
- Workers Free stops at the free allocation; Paid can charge overages. The owner's current plan/model entitlement is unverified. Existing Cron authorization does not prove permission to invoke Workers AI. No entitlement change or AI binding was deployed.
- Suggested next validation: check access/plan, use one public project photo, bound dimensions/request count, measure output and usage. This can fit the existing own-account executor without another host.

## Alternative: Alibaba Cloud Model Studio Singapore

[Qwen Image Editing](https://www.alibabacloud.com/help/en/model-studio/qwen-image-edit-api) accepts user-supplied images and prompts. Prefer documented binary/Base64 upload rather than exposing private R2 URLs.

The [price table updated Nov 2](https://www.alibabacloud.com/help/en/model-studio/model-pricing) lists 10-image trials for Singapore International Qwen Image 2.1 Pro/Turbo and 3.0/3.0 Pro. Older 2.0 rows now say no free quota; search snippets claiming 100 free edits are stale. Listed 2.1 Turbo output price after trial is $0.016/image; other models differ.

[Trial rules](https://www.alibabacloud.com/help/en/model-studio/new-free-quota): account information/activation required; normally 90 days. Enable **Free Quota Only** (off by default) before use so trial exhaustion does not become paid usage. Account eligibility and actual quota are untested. No activation or billing change was made.

## Other options

- [Hugging Face image editor](https://huggingface.co/docs/inference-providers/guides/image-editor) supports uploaded images with Qwen Image Edit/FLUX Kontext. [Current pricing](https://huggingface.co/docs/inference-providers/en/pricing) gives free users no included inference credits; PRO includes $2/month. Older free-credit claims are not current evidence.
- NVIDIA FLUX Kontext / FLUX.2 Klein / FLUX.3 Klein preview docs restrict image inputs to preset example IDs. Qwen Image Edit is downloadable, not a verified free custom-image hosted endpoint. The working NVIDIA vision model outputs text tags.

## Gathered Scenes Zine trial

One example was generated with the built-in image-generation tool, using public project photo `public/photos/1015.jpg` and **scenes-gathered-zine-v1-3** at upstream commit `b9edb836c9dd5c5d80995e89ebcaba34b75fd58f`. It keeps the fjord/cliff photo anchor and extends ridge/water geometry into torn paper, charcoal and blue print.

Output, prompt, upstream skill/license and attribution are in the sibling local `work/zine-example-2026-11-03` folder, outside this product repo and hosted assets. No extra R2 file or user-photo transmission was created. This is one creative example, not a website generation integration or provider comparison. The existing nine sample eligibility rules remain unchanged.

[Upstream project](https://github.com/Zeejay0/gathered-scenes-zine-skill) · [Personal Non-Commercial License](https://github.com/Zeejay0/gathered-scenes-zine-skill/blob/b9edb836c9dd5c5d80995e89ebcaba34b75fd58f/LICENSE). Keep attribution/license when sharing materials; commercial/organizational use requires separate permission.
