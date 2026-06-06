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
    coverLetterTemplates.js
    siteContent.js
  utils/
    analytics.js
    downloads.js
    email.js
    recaptcha.js
    supabaseClient.js
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
- `AdPlaceholder`
- `CoverLetterBuilder`
- `CoverLetterForm`
- `CoverLetterPreview`
- `CoverLetterTemplateSelector`
- `CoverLetterDownloadModal`
- `AuthModal`
- `MyCvsPanel`

Supporting data lives in `src/data/categories.js`. PDF and Word download helpers live in `src/utils/downloads.js`.
FAQ and career-tip article content lives in `src/data/siteContent.js`.
Cover letter templates, role categories, sample letters, experience levels, regional formats, fonts, and layouts live in `src/data/coverLetterTemplates.js`.

## Notes

- OTP is mock-only for now and displays the generated code in the modal.
- PDF generation uses `html2pdf.js`; DOCX generation uses the `docx` library.
- CV drafts auto-save locally every 30 seconds and can be restored when the builder opens.
- Mobile CV editing includes an Edit/Preview toggle while desktop keeps the side-by-side builder layout.
- The Cover Letter Builder now works as a full cover letter generator with 60+ predefined roles, experience levels, UAE/GCC, UK, US, Canada, Australia, and international formats, copy-to-clipboard, saved templates, light/dark preview mode, sample generated letters, and the same OTP download flow.
- Google AdSense areas are clean placeholders and do not block the CV creation flow.
- About Us, Contact Us, Privacy Policy, Terms & Conditions, FAQ, and Blog/Career Tips are frontend sections ready for routing or CMS integration later.
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
VITE_AUTH_REDIRECT_URL=https://buildmycvforfree.netlify.app/#builder
VITE_ENABLE_GOOGLE_AUTH=false
VITE_GA_MEASUREMENT_ID=
VITE_RECAPTCHA_SITE_KEY=
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
```

Do not expose `OPENAI_API_KEY`, `RECAPTCHA_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` in frontend `VITE_` variables.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Email/Password in Supabase Auth. Google is optional.
4. In Supabase Auth URL Configuration, set the Site URL to `https://buildmycvforfree.netlify.app`.
5. Add redirect URLs:
   - `https://buildmycvforfree.netlify.app/**`
   - `http://127.0.0.1:5173/**`
   - `http://localhost:5173/**`
6. If your email template uses `{{ .SiteURL }}`, change the confirmation link to use `{{ .RedirectTo }}` so `VITE_AUTH_REDIRECT_URL` is honored.
7. Add your site URL and redirect URLs to the Google provider settings if Google login is enabled.
8. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` and Netlify.
9. Keep `VITE_ENABLE_GOOGLE_AUTH=false` until Google Auth is enabled in Supabase. Set it to `true` only after the Google provider is configured.
10. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Netlify environment variables only if you want the server-side resend confirmation fallback.

Google reCAPTCHA is verified through `netlify/functions/verifyRecaptcha.js`. Supabase native Auth CAPTCHA currently supports hCaptcha/Turnstile, so use this Google reCAPTCHA layer for frontend bot checks or switch to Supabase-native CAPTCHA if you prefer that validation inside Supabase Auth.

## EmailJS contact form

The Contact Us form uses the official `@emailjs/browser` SDK. Create an EmailJS service and template, then set:

```text
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
```

Template variables sent by the form:

```text
app_name
sent_at
user_name
user_email
subject
message
```
