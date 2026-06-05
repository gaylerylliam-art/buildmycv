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
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GA_MEASUREMENT_ID=
VITE_RECAPTCHA_SITE_KEY=
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
```

Do not expose `OPENAI_API_KEY` or `RECAPTCHA_SECRET_KEY` in frontend `VITE_` variables.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Email/Password and Google providers in Supabase Auth.
4. Add your site URL and redirect URLs, including your Netlify URL and local `http://127.0.0.1:5173`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` and Netlify.

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
