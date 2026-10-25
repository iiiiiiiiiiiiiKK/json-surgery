/**
 * Align the local branch with the commit that `sync-api.mjs` created remotely.
 *
 * Why this is needed: the Git Data API does not accept a pre-built commit
 * object, so the commit it creates has its own SHA — the committer identity is
 * normalised to the token owner and the timestamp is the moment of the API
 * call. The *tree* is byte-identical to the local one, but `git status` would
 * still report the branch as diverged.
 *
 * This script reads the remote commit's tree/parents/author/message back from
 * the API, re-creates the exact same commit object locally (same tree, parents,
 * identity, epoch and timezone), verifies the resulting SHA equals the remote
 * one, and only then moves `main` and `origin/main` onto it. If the SHA does
 * not match it changes nothing and exits non-zero.
 *
 * Usage: GITHUB_TOKEN=... node scripts/align-local.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OWNER = 'iiiiiiiiiiiiiKK';
const REPO = 'json-surgery';
const BRANCH = 'main';
const TOKEN = process.env.GITHUB_TOKEN;
const API = 'https://api.github.com';

if (!TOKEN) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

async function api(path) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'json-surgery-align',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** Render an ISO instant + numeric offset into git's raw commit format. */
function toGitDate(iso) {
  const date = new Date(iso);
  const epoch = Math.floor(date.getTime() / 1000);
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${epoch} ${sign}${hh}${mm}`;
}

const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
const remoteSha = ref.object.sha;
const localSha = git('rev-parse', 'HEAD');

if (localSha === remoteSha) {
  console.log(`already aligned at ${remoteSha.slice(0, 7)}`);
  process.exit(0);
}

const commit = await api(`/repos/${OWNER}/${REPO}/git/commits/${remoteSha}`);

// The API response carries the author instant in UTC ("...Z"). Re-deriving the
// original numeric offset is not possible from the response, so try the two
// offsets a commit made from a CN-hosted machine can realistically carry.
const candidates = ['+0800', '+0000'];
const localTree = git('rev-parse', 'HEAD^{tree}');
if (localTree !== commit.tree.sha) {
  console.error(`tree mismatch: local ${localTree} vs remote ${commit.tree.sha}`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'json-surgery-align-'));
const parents = commit.parents.map((p) => p.sha);
const header = (offset) =>
  [
    `tree ${commit.tree.sha}`,
    ...parents.map((p) => `parent ${p}`),
    `author ${commit.author.name} <${commit.author.email}> ${toGitDate(commit.author.date).split(' ')[0]} ${offset}`,
    `committer ${commit.committer.name} <${commit.committer.email}> ${toGitDate(commit.committer.date).split(' ')[0]} ${offset}`,
  ].join('\n');

let rebuilt = null;
for (const offset of candidates) {
  for (const trailer of ['', '\n']) {
    const body = `${header(offset)}\n\n${commit.message.replace(/\n$/, '')}${trailer}`;
    const file = join(dir, 'commit.txt');
    writeFileSync(file, body, 'utf8');
    const sha = git('hash-object', '-t', 'commit', '-w', file);
    if (sha === remoteSha) {
      rebuilt = sha;
      break;
    }
  }
  if (rebuilt) break;
}

if (!rebuilt) {
  console.error(
    'could not reproduce the remote commit object locally.\n' +
      `local HEAD is ${localSha.slice(0, 7)}, remote is ${remoteSha.slice(0, 7)}; ` +
      'the trees match, so the working copy is correct — only the SHA differs.',
  );
  process.exit(1);
}

git('reset', '--hard', rebuilt);
git('update-ref', `refs/remotes/origin/${BRANCH}`, rebuilt);
console.log(`aligned ${localSha.slice(0, 7)} -> ${rebuilt.slice(0, 7)}`);
