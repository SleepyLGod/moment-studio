---
name: publish-moment-site
description: Publish the latest pushed Moment Studio GitHub main to an existing owner-private ChatGPT Site. Invoke explicitly for a private Site release.
---

Read the installed Sites skill. Use its authenticated native tools and source helper. This command updates the existing Site from GitHub `main`.

1. Resolve the target from the supplied private Site URL or the already identified deployment in this conversation. In a fresh conversation without a known target, ask for the Site URL. Use Sites discovery and `get_site` to confirm the exact Site and owner-only audience. Stop if the account, Site or audience does not match. Never create a Site or change sharing.
2. Fetch the verified GitHub origin's latest `main` and capture its full SHA. Open the existing Sites-managed source in a fresh private checkout with the Sites helper and a fresh write credential. Run `node scripts/sync-sites-source.mjs <GitHub checkout> <Sites checkout> <GitHub main SHA>` from the GitHub checkout. The script leaves the GitHub checkout untouched and permits only the Site ID as a difference in the private deployment.
3. If the returned private commit is already the successful live version, report it. Otherwise use the official source helper to install dependencies as needed, run `npm run check`, and package that exact private commit. Pass credentials through hidden stdin per the Sites skill. Save and deploy privately through Sites and poll to a terminal result. Never publish a failed check or divergent source.
4. Verify the live URL and owner-only audience. Report both short SHAs and what was verified. Keep all private project data and deployment artifacts outside GitHub. Do not push to GitHub, rewrite history or modify the separate Pages workflow.
