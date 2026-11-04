import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const manifestPath = '.openai/hosting.json';
const [sourcePath, sitePath, sha] = process.argv.slice(2);
if (process.argv.length !== 5 || !/^[a-f0-9]{40}$/.test(sha || '')) {
  throw new Error('Usage: node scripts/sync-sites-source.mjs <GitHub checkout> <Sites checkout> <verified GitHub main SHA>');
}
const source = realpathSync(sourcePath);
const site = realpathSync(sitePath);
const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding:'utf8'}).trim();
if (source === site || git(site, 'rev-parse', '--show-toplevel') !== site) {
  throw new Error('Use a separate private Sites checkout.');
}
if (git(site, 'status', '--porcelain')) throw new Error('The private checkout has uncommitted work.');

const siteManifest = join(site, manifestPath);
const {project_id} = JSON.parse(readFileSync(siteManifest, 'utf8'));
if (typeof project_id !== 'string' || !project_id) {
  throw new Error('The private checkout must already be bound to a Site.');
}
const portable = JSON.parse(git(source, 'show', `${sha}:${manifestPath}`));
if (Object.hasOwn(portable, 'project_id')) {
  throw new Error('GitHub source must use a portable manifest without a project_id.');
}

git(site, 'fetch', '--no-tags', source, sha);
const alreadySynced = spawnSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], {cwd:site}).status;
if (alreadySynced === 1) {
  const merge = spawnSync('git', ['merge', '--no-ff', '--no-commit', sha], {cwd:site, stdio:'inherit'});
  // The only merge conflict we can resolve automatically is the local Site identity.
  if (merge.status !== 0 && git(site, 'diff', '--name-only', '--diff-filter=U') !== manifestPath) {
    throw new Error('Private source merge failed. Review the disposable checkout before publishing.');
  }
  writeFileSync(siteManifest, JSON.stringify({project_id, ...portable}, null, 2) + '\n');
  git(site, 'add', '--', manifestPath);
  if (git(site, 'diff', '--cached', '--name-only', sha, '--', '.', `:(exclude)${manifestPath}`)) {
    throw new Error('Sites has additional source changes. Reconcile them in GitHub before publishing.');
  }
  git(site, '-c', 'user.name=Sites', '-c', 'user.email=sites@users.noreply.openai.com',
    'commit', '-m', `Sync GitHub main ${sha.slice(0, 12)} for private Sites deployment`);
} else if (alreadySynced !== 0) {
  throw new Error('Unable to compare GitHub and private Site source history.');
}

const {project_id: retainedId, ...deployed} = JSON.parse(readFileSync(siteManifest, 'utf8'));
if (retainedId !== project_id || JSON.stringify(deployed) !== JSON.stringify(portable) ||
    git(site, 'diff', '--name-only', sha, 'HEAD', '--', '.', `:(exclude)${manifestPath}`)) {
  throw new Error('Private source differs from GitHub outside the selected Site identity.');
}
console.log(JSON.stringify({githubCommit:sha, sitesCommit:git(site, 'rev-parse', 'HEAD')}));
