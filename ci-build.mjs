// CI entry point: build dist/, then audit it — strict on the production branch, --preview elsewhere.
// Runs automatically before every `wrangler deploy` / `versions upload` via the "build" block in
// wrangler.jsonc, so Cloudflare Workers Builds (Git integration) and GitHub Actions both gate deploys
// the same way with no dashboard build command.
//
//   node ci-build.mjs
//
// Branch comes from WORKERS_CI_BRANCH (Workers Builds) or GITHUB_REF_NAME (GitHub Actions),
// falling back to the local git branch. PRODUCTION_BRANCH overrides "main".
import { execFileSync } from 'child_process';

const run = (args) => execFileSync(process.execPath, args, { stdio: 'inherit' });

let branch = process.env.WORKERS_CI_BRANCH || process.env.GITHUB_REF_NAME;
if (!branch) {
  try { branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { branch = ''; }
}
const production = branch === (process.env.PRODUCTION_BRANCH || 'main');

console.log(`ci-build: branch "${branch || 'unknown'}" → ${production ? 'strict' : 'preview'} audit`);
try {
  run(['build.mjs']);
  run(production ? ['audit.mjs'] : ['audit.mjs', '--preview']);
} catch (e) {
  process.exit(e.status || 1);
}
