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

## Backend scaffolding added

- `supabase/schema.sql` defines `profiles`, `cvs`, `cv_drafts`, `cv_history`, and `download_requests`.
- Row level security policies are included so users can only manage their own saved CV data.
- A private `profile-photos` storage bucket and ownership policies are included for future Supabase profile photo upload.
- `netlify/functions/generateCvBullets.js` is ready for OpenAI-powered CV bullet suggestions.
- `netlify/functions/atsCheck.js` is ready for OpenAI-powered ATS checking.
- `netlify/functions/generateCoverLetter.js` is ready for OpenAI-powered cover letter drafting.
- The functions return safe mock JSON when `OPENAI_API_KEY` is not configured.

## Production work still needed

- Connect Supabase Auth in the React app for email/password and Google login.
- Add the `My CVs` dashboard with edit, duplicate, delete, and download actions after Supabase client credentials are configured.
- Replace the current square-only profile photo upload with a crop tool before upload to Supabase Storage.
- Add full `i18next` translations for English, Arabic, Filipino/Tagalog, Hindi, and Urdu, including RTL layout for Arabic and Urdu.
- Add UI panels that call the new Netlify Functions for bullet suggestions, ATS checks, and AI cover letter drafting.
- Add shareable public CV links using `cvs.share_slug` and `cvs.is_public`.

## Third-party library choice

- `html2pdf.js` was added for browser-side PDF exports because it works with existing HTML/CSS previews and avoids exposing any server-side document generation service during the prototype stage.
- Supabase is prepared as the data/auth/storage layer because the requested features map cleanly to Auth, Postgres, RLS, and Storage.
- Netlify Functions are used for OpenAI calls so the API key stays server-side and is never bundled into the frontend.
