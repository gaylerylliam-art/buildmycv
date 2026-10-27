# Upload Existing CV

This replaces the old browser parser, heuristic/mock fallback, automatic rewrite/translation, and immediate import. The old `parseCv` endpoint returns 410 so stale clients must refresh.

## Setup

Use Node.js 22.16 or newer (Node 24 is supported). The native image decoder must be installed on the deployment target; `npm ci` installs the appropriate optional platform binary.

Set these server-side environment variables on Netlify (Functions scope), then deploy:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Existing OpenAI integration key. Required for visual OCR and organizing fields. |
| `CV_IMPORT_SIGNING_SECRET` | A separate, random secret of at least 32 characters for private guest sessions and extraction receipts. Never expose it with `VITE_` or `REACT_APP_`. Generate locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. |
| `CV_IMPORT_MODEL` | Optional override for this feature. Defaults to existing `OPENAI_MODEL`, then `gpt-4o-mini`. Must support Responses, PDF/image input, and strict Structured Outputs. |

No new OCR account or permanent upload store is required. The application stays usable without a CV upload configuration: upload errors explain that processing is unavailable; it never returns sample extraction.

The existing guest builder remains available without requiring a Supabase account. A signed, HttpOnly, SameSite=Strict cookie authorizes guest processing; source receipts are bound to that session. No server-stored job or source can be read by another user. Requests must come from the same origin, and Netlify's function configuration limits each IP to 20 requests/minute. Existing Supabase authentication and private draft access continue to govern cloud saving after an import.

## Local development

Install dependencies with `npm ci`. Put server variables in the ignored `.env.local` (do not commit it). Run `npm run dev:cv-import` in one terminal and `npm run dev` in another. The Vite proxy routes only `/.netlify/functions/cvImport` to the real local processing service on port 8889. Both parsing and actual AI processing run on the server. Netlify production does not require this local service. A plain `vite preview` serves built UI only; use Netlify dev for a full built-app preview with functions.

## Processing and limits

- PDF, DOCX, JPG/JPEG and PNG; maximum 3 MiB per file and 12 PDF pages. These limits keep base64 JSON below Netlify's buffered function payload cap. PDFs with more pages are rejected, never truncated. Text is capped at 60,000 characters, image resolution at 16 megapixels, and DOCX archives at 300 entries / 20 MiB expanded / 8 MiB per entry.
- Extension, magic bytes, base64, image dimensions/decoding, archive structure, encryption and content limits are checked server-side. DOCX ZIPs are streamed with size validation before Mammoth is allowed to parse them. Macros, embedded programs, XML entity declarations and PDF active content/attachments are rejected. PDF.js is used without eval, XFA or executable document actions. JavaScript/HTML in uploaded content is never rendered as markup or executed.
- Digital PDF pages and DOCX text use PDF.js and Mammoth on the server. HTTP(S), email and telephone hyperlink targets in PDF annotations / DOCX relationships are retained as source text without following links. PDFs with image content, sparse text, or ambiguous column gutters use visual OCR. In mixed PDFs, digital page text remains embedded text while scanned/complex pages receive OCR. Embedded text is retained separately for comparison. Sending the complete PDF to the provider preserves page layout and mixed-page context; it can include digital pages too.
- Image and PDF OCR use the existing OpenAI Responses integration. PDFs send both page images and embedded text through the provider's supported PDF input. OCR returns a validated numbered result for every page or fails the whole extraction. Missing/blank/partial OCR never silently becomes a successful import. If an OCR-required PDF page has no readable text, the whole extraction fails; remove legitimate blank pages before retrying.
- English and Arabic text remain in their original language. Visual OCR reads columns independently. Native PDF item grouping respects RTL direction; ambiguous ordering goes through vision. Mixed-language fields use `dir="auto"`; the reviewer can choose RTL for the resulting builder CV.
- AI output uses a strict JSON schema and the same runtime validator on the server and client. Source data is supplied as inert document content, without tools. No instructions from the CV are executed. Unsupported extracted statements are removed and flagged. Names, dates, employers, qualifications, achievements and responsibility wording are not rewritten. Missing information remains blank.
- Matching extracted values to source text is deliberately conservative. Legitimate reformatted lines may be flagged/blanked; reviewers can restore them. All source text stays available, and unmatched source lines are added to unclassified content. This does not establish OCR accuracy: OCR itself may misread a source image, so names, dates, numbers and affiliations still require human review.
- Progress follows actual upload completion, text extraction, organizing, and review. Organizing retries reuse extracted text. Expired sessions require re-extracting the retained original file. A successful import identifier is applied only once; processing endpoints themselves do not write CV drafts.

## Review and data loss controls

The review shows original page text, any separate embedded PDF text, warnings, uncertainty paths, and editable fields and work records. It preserves the original File and extracted source in tab memory through failures and retries. Users can add/remove jobs and correct every supported field. Confirmation is reset whenever the reviewed draft or builder data changes. No builder state changes before explicit confirmation.

Import replaces matching fields (including blanks) and the work history. It preserves unrelated builder settings and leaves the user's cover letter unchanged. A snapshot in memory allows the user to confirm restoring the previous CV. Awards, volunteering, professional links and unclassified text are now editable builder fields. Awards, volunteering and links are included in previews and PDF/Word exports (including RTL Word paragraphs); unclassified text is retained but is not printed automatically. Referee information remains subject to the builder's existing explicit consent controls.

## Privacy, deletion and failures

Original files are never written to disk, Supabase Storage, Netlify Blobs, public URLs, or application logs. Each request uses bounded memory and releases PDF workers and ZIP streams. Responses are private/no-store. Temporary browser originals, extracted pages and undo snapshots are discarded on Clear or when the importer unmounts; a browser refresh/navigation also loses them (a pending review warns on full-page unload). Imported fields use the builder's existing local/cloud saving behavior, described in the existing privacy UI. Clearing an upload does not delete a CV already imported or saved; delete saved drafts through the existing account controls.

Requests to OpenAI set `store:false`, use inline file data, and do not create persistent Files API objects. Provider-side abuse monitoring/retention depends on the account's provider policy; this feature does not promise zero provider retention. No document text, filenames, personal fields, provider payloads or source-language metadata is sent to application logs or import analytics.

Provider requests have a 42-second deadline and each processing request has a 50-second overall abort signal, inside Netlify's synchronous-function limit. The browser times out at 58 seconds. Cancellation aborts the client request; an already accepted provider operation may finish before its deadline. No permanent upload objects or job records require later cleanup. Retries may incur another provider call, but cannot duplicate an import. The UI keeps the selected file and extracted text for retry, reports failures, and never changes the builder on failure.

## Provider adapter

`netlify/lib/cv-import/provider.js` exports the production adapter with:

- `ocr({buffer, mime, pageCount, signal}) -> {pages:[{pageNumber,text}],warnings:[]}`
- `organize({text,signal}) -> CV_IMPORT_SCHEMA`

Replace that adapter to use another OCR or AI vendor. Keep the numbered-page completeness check, source-as-data instruction, no-retention request policy where supported, bounded timeouts, and schema validation. Test doubles exist only under `tests/` and the explicit browser test script; the deployed default handler always uses the real adapter.

## Verification

- `npm run test:cv-import`: real synthetic digital/scanned/mixed/multi-column/Arabic PDF, DOCX and image fixtures; native text extraction and decoding; OCR routing via an explicitly labeled test double; invalid, corrupt, encrypted and oversized inputs; provider/schema errors; grounding and source retention; origin, session, receipt ownership and retries.
- `node scripts/check-cv-import-ui.mjs`: browser flow against real parsing with a labeled synthetic provider contract. Checks transient failures, retained source, editable review, required confirmation, import/preview mapping, undo, invalid uploads and Arabic/mobile layout. This starts an isolated loopback test server with synthetic CVs, not the production provider.
- `npm run build`: frontend, prerendering, crawlability and social metadata checks.
- Optional actual-provider verification: set `CV_IMPORT_LIVE_TESTS=1` and `OPENAI_API_KEY`, then run `npm run test:cv-import`. It sends only synthetic fixture CVs. Live OCR/AI accuracy is not verified when that test is skipped.

## Known limits

Dense/very low-resolution scans, handwriting, unusual embedded fonts and complex layouts can require manual correction or fail. Visual OCR is probabilistic. DOCX embedded images are not OCRed: export image-based Word CVs to PDF. There is no automatic translation or stylistic improvement in this import flow. Original scanned page images are not displayed inline (the user retains the original file); the extracted transcription and separate embedded text remain available. Review is intentionally tab-local; it does not survive refresh, tab closure or navigation away. No deployment or production provider configuration is performed by these source changes.

Provider documentation: [File inputs](https://developers.openai.com/api/docs/guides/file-inputs), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
