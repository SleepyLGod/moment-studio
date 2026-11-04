import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = '.sites/deploy.json';
const schema = {
  type:'object',
  additionalProperties:false,
  required:['status','githubCommit','sitesCommit','detail'],
  properties:{
    status:{type:'string', enum:['published','already-current','failed']},
    githubCommit:{type:['string','null']},
    sitesCommit:{type:['string','null']},
    detail:{type:['string','null']},
  },
};

function deploy() {
  const ignored = spawnSync('git', ['check-ignore', '--quiet', '--', configPath], {cwd:root});
  if (ignored.status !== 0) throw new Error(`${configPath} must be ignored by Git and untracked.`);

  let config;
  try {
    config = JSON.parse(readFileSync(join(root, configPath), 'utf8'));
  } catch {
    throw new Error(`Create ${configPath} with {"siteUrl":"https://your-site.chatgpt.site"}.`);
  }
  const site = typeof config?.siteUrl === 'string' ? URL.parse(config.siteUrl) : null;
  if (!site || Object.keys(config).length !== 1 || site.protocol !== 'https:' || site.port ||
      !site.hostname.endsWith('.chatgpt.site') || site.href !== site.origin + '/' ||
      (config.siteUrl !== site.origin && config.siteUrl !== site.href)) {
    throw new Error(`${configPath} must contain only siteUrl, an HTTPS chatgpt.site address.`);
  }

  const scratch = mkdtempSync(join(tmpdir(), 'moment-sites-release-'));
  const schemaPath = join(scratch, 'result.schema.json');
  const resultPath = join(scratch, 'result.json');
  writeFileSync(schemaPath, JSON.stringify(schema));

  const prompt = `$publish-moment-site ${site.origin}
This is an explicit, noninteractive owner-private deployment. Read and follow the project skill at
.agents/skills/publish-moment-site/SKILL.md. Use only this exact Site. If a prerequisite is missing,
return failed. Use ${scratch} for separate disposable GitHub and private Sites checkouts, build
artifacts and npm cache. Read the GitHub origin from the current checkout, but perform all fetch
and build steps in the disposable checkouts. The current checkout is read-only for this operation.
Use native authenticated Sites tools. Pass the credential only through the official helper's
hidden stdin. Do not put credentials or private deployment configuration in GitHub or the result.
Return published only after native deployment status is succeeded. Return already-current only
after checking the live deployment's commit. For either success include the two verified full SHAs.
For failed, put a short explanation without credentials, private URLs or raw tool output in detail.`;

  console.log('Checking and publishing the private Sites workspace…');
  const run = spawnSync('codex', [
    '-a', 'never', 'exec', '--ephemeral', '--sandbox', 'workspace-write',
    '-c', 'sandbox_workspace_write.network_access=true',
    '--cd', root, '--add-dir', scratch, '--color', 'never',
    '--output-schema', schemaPath, '--output-last-message', resultPath, '-',
  ], {input:prompt, stdio:['pipe','ignore','ignore']});
  if (run.error?.code === 'ENOENT') throw new Error('Install the Codex CLI and sign in with ChatGPT first.');
  if (run.error || run.status !== 0) {
    throw new Error('Codex CLI could not complete the release. Check codex login status and that the Sites plugin is enabled.');
  }

  let result;
  try {
    result = JSON.parse(readFileSync(resultPath, 'utf8'));
  } catch {
    throw new Error('Codex CLI did not return a release result.');
  }
  if (result?.status === 'failed') {
    throw new Error(typeof result.detail === 'string' && result.detail ? result.detail : 'Sites release failed.');
  }
  if (!['published','already-current'].includes(result?.status) ||
      ![result.githubCommit,result.sitesCommit].every(sha=>/^[a-f0-9]{40}$/.test(sha))) {
    throw new Error('Codex CLI did not confirm both GitHub and Sites revisions.');
  }
  const status = result.status === 'published' ? 'Private Site published' : 'Private Site already current';
  console.log(`${status} · GitHub ${result.githubCommit.slice(0,12)} · Sites ${result.sitesCommit.slice(0,12)}`);
}

try {
  deploy();
} catch (error) {
  console.error(`Sites release failed. ${error.message}`);
  process.exitCode = 1;
}
