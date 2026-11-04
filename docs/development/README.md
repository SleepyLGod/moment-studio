# Developer docs

Start with [Deployment](../../DEPLOYMENT.md) for builds, publishing and local D1/R2 setup.

## Current application

| Area | Reference |
| --- | --- |
| Storage, authentication and resource boundaries | [Sites cloud library](../sites-native-design.md) |
| Photo import and orientation | [HEIC and capture dates](heic-import.md) |
| Model refresh, tags, months and groups | [Models and organization](models-and-organization.md) |
| Subscription image editing and listener renewal | [Style Lab](style-lab-subscription.md) |
| Trash and permanent deletion | [Deletion contract](#permanent-deletion) |
| Public static demo | [Pages workflow and release check](../../DEPLOYMENT.md#public-demo) |

### Permanent deletion

The same private confirmation dialog handles one photo or a selection in Trash. It previews the impact of each photo, including album and creation links. Confirming sends the reviewed tokens only for eligible photos. The server revalidates each token, reserves files in D1 and deletes only exclusive R2 objects. Shared assets stay available to other records. Each photo completes independently, so a blocked photo or a changed impact does not cancel the rest of the selection. The result lists photos kept and their reasons. A changed impact requires a new review, including when deleting another selected photo changed the shared-file impact. The demo only offers recoverable Trash.

## Architecture and evidence

- [Architecture and interfaces](architecture.md) explains the original module boundaries and design tradeoffs. [System diagram](diagrams/architecture.svg) · [Interface diagram](diagrams/interfaces.svg) · [Interactive review](architecture-review.html)
- [Hosted gallery verification](../cloud-validation.md) and [executor verification](cloud-executor-validation.md) distinguish local tests from hosted observations.
- [OpenAI click-to-result proof](openai-event-trigger.md) and [early cloud-task proof](openai-cloud-proof.md) record the experiments behind the current Style Lab.
- [Provider research](ai-image-edit-services.md), [model capabilities](model-capabilities-and-resolution.md) and [execution verification](execution-verification.md) retain dated investigations. The adjacent plans and JSON evidence are historical records.

Diagram source lives in `diagrams/*.json`. Keep generated SVGs and the interactive review in sync when changing the diagrams. See [Later work](../../TODO.md) for outstanding decisions and acceptance.
