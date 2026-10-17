// Only requests matching assets.run_worker_first in wrangler.jsonc ("/api/*") reach this script.
// Every page and asset is served straight from dist/ without invoking the Worker.
//
// Add a form handler by registering it below, e.g. routes['/api/contact'] = handleContact.
// Secrets (TURNSTILE_SECRET_KEY, email API keys): `npx wrangler secret put NAME` for production,
// `.dev.vars` (git-ignored) for `npx wrangler dev`.
const routes = {};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const handler = routes[pathname];
    if (!handler) return json({ error: 'Not found' }, 404);
    return handler(request, env, ctx);
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      // _headers does not apply to Worker responses, so set this here
      'X-Robots-Tag': 'noindex',
    },
  });
}

// Server-side Turnstile check — call from every form handler before doing anything else.
async function verifyTurnstile(request, env, token) {
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token || '');
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const outcome = await res.json();
  return outcome.success === true;
}
