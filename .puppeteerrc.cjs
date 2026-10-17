// Screenshots run locally only. Workers Builds and other CI set CI=true, so they skip Puppeteer's
// Chrome download during `npm install` (it's never used there and slows every deploy).
// Locally Chrome caches in ~/.cache/puppeteer.
module.exports = { skipDownload: Boolean(process.env.CI) };
