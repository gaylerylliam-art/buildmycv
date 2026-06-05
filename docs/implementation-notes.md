# CVforAll Implementation Notes

## Implemented in the frontend

- Real client-side PDF generation uses `html2pdf.js` so CV and cover letter downloads preserve text, color, spacing, and profile photos better than the earlier mock files.
- Download filenames follow the requested pattern, for example `Juan_Dela_CV.pdf` and `Juan_Dela_Cover_Letter.pdf`.
- The CV builder keeps the desktop side-by-side editor and preview layout.
- Mobile users now get an `Edit` / `Preview` toggle so the form and live preview are easy to use on small screens.
- Drafts auto-save to `localStorage` every 30 seconds.
- When a local draft exists, the app prompts: `You have an unsaved CV - continue editing?`
- A subtle save indicator appears in the builder header.
- A CV completeness score helps users see what information is still missing.
- The Cover Letter Builder now includes a standalone generator flow with applicant details, nationality, visa status, LinkedIn URL, years of experience, job description, experience level, and regional format controls.
- The cover letter role system includes professional, education, domestic, technician, construction, and general worker roles, plus sample generated letters for the requested example categories.
- Cover letters can be copied to clipboard, saved locally as reusable templates, previewed in light or dark mode, and downloaded as PDF or DOCX.
- Supabase Auth UI is available in the builder with email/password login, signup, logout, and Google OAuth.
- Logged-in users can save, load, duplicate, and delete CV records from the `cvs` table, with the app enforcing the requested 5-CV save limit before insert.
- Profile photos upload to Supabase Storage when the user is logged in, while the live browser preview remains available immediately.
- Google Analytics loads from `VITE_GA_MEASUREMENT_ID` and tracks key app actions.
- Google reCAPTCHA v3 loads from `VITE_RECAPTCHA_SITE_KEY` and verifies through the `verifyRecaptcha` Netlify Function when `RECAPTCHA_SECRET_KEY` is configured.
- The Contact Us form sends messages through EmailJS when `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, and `VITE_EMAILJS_PUBLIC_KEY` are configured.

## Backend scaffolding added

- `supabase/schema.sql` defines `profiles`, `cvs`, `cv_drafts`, `cv_history`, and `download_requests`.
- `supabase/schema.sql` also defines `cover_letters` and `analytics_events`.
- Row level security policies are included so users can only manage their own saved CV data.
- A private `profile-photos` storage bucket and ownership policies are included for future Supabase profile photo upload.
- `netlify/functions/generateCvBullets.js` is ready for OpenAI-powered CV bullet suggestions.
- `netlify/functions/atsCheck.js` is ready for OpenAI-powered ATS checking.
- `netlify/functions/generateCoverLetter.js` is ready for OpenAI-powered cover letter drafting.
- `netlify/functions/verifyRecaptcha.js` verifies Google reCAPTCHA tokens server-side.
- The functions return safe mock JSON when `OPENAI_API_KEY` is not configured.

## Production work still needed

- Apply `supabase/schema.sql` to the live Supabase project.
- Add Supabase, Google Analytics, Google reCAPTCHA, and OpenAI environment variables in Netlify.
- Add EmailJS service, template, and public key variables in Netlify.
- Replace the current square-only profile photo upload with a crop tool before upload to Supabase Storage.
- Add full `i18next` translations for English, Arabic, Filipino/Tagalog, Hindi, and Urdu, including RTL layout for Arabic and Urdu.
- Add UI panels that call the new Netlify Functions for CV bullet suggestions and ATS checks.
- The Cover Letter Generator already calls the Netlify cover letter function when available and falls back to the local template generator during local Vite development.
- Add shareable public CV links using `cvs.share_slug` and `cvs.is_public`.

## Third-party library choice

- `html2pdf.js` was added for browser-side PDF exports because it works with existing HTML/CSS previews and avoids exposing any server-side document generation service during the prototype stage.
- `docx` was added so CV and cover letter downloads can produce real `.docx` files instead of HTML files renamed as Word documents.
- Supabase is prepared as the data/auth/storage layer because the requested features map cleanly to Auth, Postgres, RLS, and Storage.
- Netlify Functions are used for OpenAI calls so the API key stays server-side and is never bundled into the frontend.
