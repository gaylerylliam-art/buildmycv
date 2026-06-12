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

## If Browser Cache Shows Old Page

If `curl` shows the correct homepage but a browser still shows the old page:

1. Hard refresh the browser.
2. In Netlify, trigger a deploy with cache cleared.
3. In Google Search Console, inspect `/` and request indexing.
