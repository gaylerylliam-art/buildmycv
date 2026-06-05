# CVforAll - Free CV Builder

Modern React + Tailwind frontend for a free CV/resume builder focused on fresh graduates, rank-and-file workers, skilled workers, domestic service workers, and job seekers.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://127.0.0.1:5173
```

## Build

```bash
npm run build
```

## File structure

```text
index.html
package.json
tailwind.config.js
postcss.config.js
src/
  main.jsx
  App.jsx
  styles.css
  data/
    categories.js
    siteContent.js
  utils/
    downloads.js
```

## Main components

The named reusable components are implemented in `src/App.jsx`:

- `LandingPage`
- `CategorySelector`
- `CVBuilderForm`
- `LiveCVPreview`
- `ThemeSelector`
- `LayoutSelector`
- `DownloadModal`
- `AdPlaceholder`

Supporting data lives in `src/data/categories.js`. Mock PDF and Word download helpers live in `src/utils/downloads.js`.
FAQ and career-tip article content lives in `src/data/siteContent.js`.

## Notes

- OTP is mock-only for now and displays the generated code in the modal.
- PDF and Word generation are mock browser downloads structured for replacement with real export services later.
- Google AdSense areas are clean placeholders and do not block the CV creation flow.
- About Us, Contact Us, Privacy Policy, Terms & Conditions, FAQ, and Blog/Career Tips are frontend sections ready for routing or CMS integration later.
