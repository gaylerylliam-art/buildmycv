# BuildMyCVNow Homepage Verification

Generated: 2026-06-12

## Local Build

Command:

```shell
npm run build
```

Result:

- Vite build completed.
- Static SEO generation completed.
- Crawlability verification passed.
- OG verification passed.

## Static Homepage Checks

Expected:

```shell
curl -s https://buildmycvnow.com/ | grep "Every career"
curl -s https://buildmycvnow.com/ | grep "â€"
```

The first command must return the homepage H1. The second command must return no output.

Local generated HTML checks:

- `Every career. Every country.` is present.
- Exactly one `<h1>` is present.
- `/assets/heygen-demo-poster.svg` is present with explicit dimensions.
- `VideoObject` JSON-LD is present.
- No `â€` or `Â·` mojibake sequences are present.

## Production Verification

Deploy:

- Netlify deploy ID: `6a2bf017313a0ac67d091ce6`
- Site URL: `https://buildmycvnow.com`

Live checks completed after deploy:

- `/` returned HTTP 200.
- `Every career. Every country.` is present.
- `/assets/heygen-demo-poster.svg` is present.
- `VideoObject` JSON-LD is present.
- Old homepage H1 is absent.
- OFW-only homepage block is absent.
- Mojibake check returned false.
- `/builder` returned HTTP 200 and still serves the React SPA shell.

## If Browser Cache Shows Old Page

If `curl` shows the correct homepage but a browser still shows the old page:

1. Hard refresh the browser.
2. In Netlify, trigger a deploy with cache cleared.
3. In Google Search Console, inspect `/` and request indexing.
