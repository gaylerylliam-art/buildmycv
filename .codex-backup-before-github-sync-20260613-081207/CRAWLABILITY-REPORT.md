# Crawlability Report

## Root Cause Found

The current Netlify redirect setup is correctly scoped: `netlify.toml` only routes `/builder/*` to `/builder/index.html`, and there is no `public/_redirects` file overriding static pages.

The remaining risk was process-level: the static homepage generation was not protected by an automated build guard, so a future build could silently ship the empty Vite SPA shell at `/` without failing deployment.

## What Changed

- Added `scripts/verify-crawlability.mjs`.
- The build now fails if critical static routes do not contain a real `<h1>`, enough visible text, unique titles, and matching canonical links.
- The guard also verifies `/builder` remains the SPA app shell instead of a static marketing page.
- Added `scripts/verify-og.mjs` to prevent broken social preview images and missing OG tags.
- Added build-time OG asset generation with `scripts/generate-og-images.mjs`.
- Confirmed `netlify.toml` keeps the SPA fallback scoped to `/builder/*`.
- Confirmed no `public/_redirects` file exists.

## Post-Deploy Verification Commands

```bash
curl -s https://buildmycvnow.com/ | grep '<h1'
curl -s https://buildmycvnow.com/sitemap.xml | head -20
curl -s https://buildmycvnow.com/robots.txt
```

## Search Console Reminder

After this fix is live, open Google Search Console, run URL Inspection on `https://buildmycvnow.com/`, and click **Request indexing**.
