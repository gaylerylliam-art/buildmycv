# BuildMyCVNow - Free CV Builder

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
  supabaseClient.js
  styles.css
  data/
    blogArticles.js
    categories.js
    coverLetterTemplates.js
    siteContent.js
  utils/
    analytics.js
    downloads.js
    recaptcha.js
    supabaseClient.js
public/
  robots.txt
  sitemap.xml
netlify/
  functions/
    atsCheck.js
    generateCoverLetter.js
    generateCvBullets.js
    verifyRecaptcha.js
supabase/
  schema.sql
docs/
  implementation-notes.md
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
- `AdBanner`
- `CoverLetterBuilder`
- `CoverLetterForm`
- `CoverLetterPreview`
- `CoverLetterTemplateSelector`
- `CoverLetterDownloadModal`
- `AuthModal`
- `MyCvsPanel`

Supporting data lives in `src/data/categories.js`. PDF and Word download helpers live in `src/utils/downloads.js`.
FAQ and career-tip article content lives in `src/data/siteContent.js`.
Static blog route articles live in `src/data/blogArticles.js`.
Cover letter templates, role categories, sample letters, experience levels, regional formats, fonts, and layouts live in `src/data/coverLetterTemplates.js`.

## Notes

- OTP is mock-only for now and displays the generated code in the modal.
- PDF generation uses `html2pdf.js`; DOCX generation uses the `docx` library.
- CV drafts auto-save locally every 30 seconds and can be restored when the builder opens.
- Mobile CV editing includes an Edit/Preview toggle while desktop keeps the side-by-side builder layout.
- Urgent CV mode lets users continue without cloud saving and verify by email OTP before download.
- Registered account mode enables cloud saving, My CVs, profile photo storage, and online CV management.
- The Cover Letter Builder now works as a full cover letter generator with 60+ predefined roles, experience levels, UAE/GCC, UK, US, Canada, Australia, and international formats, copy-to-clipboard, saved templates, light/dark preview mode, sample generated letters, and the same OTP download flow.
- Google AdSense areas use a reusable `AdBanner` component. AdSense loads only when `VITE_ADSENSE_CLIENT_ID` is set to a real `ca-pub-` ID.
- Builder-page ads are disabled by default so ads do not sit beside form actions or download buttons. Set `VITE_ENABLE_BUILDER_ADS=true` only after approval if you intentionally want those slots.
- The Blog section includes 25 original career-tip articles for UAE, GCC, Philippines, and job-category-specific CV searches.
- A cookie notice explains browser storage, analytics, reCAPTCHA, and ad cookies.
- About, Contact, Privacy Policy, Terms of Use, Blog index, and Blog article pages are routed with React Router v6.
- The Contact page submits messages to Supabase `contact_messages`.
- Supabase schema/RLS scaffolding is in `supabase/schema.sql`.
- OpenAI-backed Netlify Function scaffolds are in `netlify/functions/` and return mock JSON until `OPENAI_API_KEY` is configured.

## Environment variables

Copy `.env.example` to `.env` locally and add the matching values in Netlify:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
RECAPTCHA_SECRET_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
VITE_AUTH_REDIRECT_URL=https://buildmycvnow.com/#builder
VITE_ENABLE_GOOGLE_AUTH=false
VITE_GA_MEASUREMENT_ID=
VITE_RECAPTCHA_SITE_KEY=
VITE_ADSENSE_CLIENT_ID=
VITE_ENABLE_BUILDER_ADS=false
```

Do not expose `OPENAI_API_KEY`, `RECAPTCHA_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` in frontend `VITE_` variables.
This Vite app supports both `VITE_SUPABASE_*` and `REACT_APP_SUPABASE_*` browser-safe Supabase variable names.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Email/Password in Supabase Auth. Google is optional.
4. Configure EmailJS OTP variables in Netlify if you want email OTP messages to be sent instead of test-mode OTP display.
5. In Supabase Auth URL Configuration, set the Site URL to `https://buildmycvnow.com`.
6. Add redirect URLs:
   - `https://buildmycvnow.com/**`
   - `http://127.0.0.1:5173/**`
   - `http://localhost:5173/**`
7. If your email template uses `{{ .SiteURL }}`, change the confirmation link to use `{{ .RedirectTo }}` so `VITE_AUTH_REDIRECT_URL` is honored.
8. Add your site URL and redirect URLs to the Google provider settings if Google login is enabled.
9. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` and Netlify. `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` are also supported for compatibility.
10. Keep `VITE_ENABLE_GOOGLE_AUTH=false` until Google Auth is enabled in Supabase. Set it to `true` only after the Google provider is configured.
11. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Netlify environment variables only if you want the server-side resend confirmation fallback.

## User modes

- Urgent CV mode / No cloud saving: users can continue immediately and verify by email OTP before download. CV data stays in browser state/localStorage only. Supabase CV records, file uploads, and My CVs are disabled.
- Registered account mode / Cloud saving: users log in with email/password or Google. My CVs, save, duplicate, delete, and Supabase Storage profile photos are enabled.

Google reCAPTCHA is verified through `netlify/functions/verifyRecaptcha.js`. Supabase native Auth CAPTCHA currently supports hCaptcha/Turnstile, so use this Google reCAPTCHA layer for frontend bot checks or switch to Supabase-native CAPTCHA if you prefer that validation inside Supabase Auth.

## Static routes

- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/blog`
- `/blog/:slug`
- `/builder`

Existing hash links such as `/#builder`, `/#templates`, and `/#faq` remain supported.
