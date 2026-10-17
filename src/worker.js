// Static asset serving via Cloudflare Workers + Assets
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
