# Measurement and advertising setup

The website now uses one Google Analytics runtime on React and static pages.
The public measurement ID is G-3RM5XEZD4C (not a secret). It measures only the
production domain after an explicit analytics opt-in. Preview/localhost visits,
old “I understand” notices, and rejected choices do not enable tracking.

## Required Google Analytics property settings before release

In Admin → Data streams → the website stream → Enhanced measurement settings:
- Turn off “Page changes based on browser history events” in Page views.
  This site sends its own deduplicated, query-free page views. Google can send
  extra history page views independently of send_page_view:false if left on.
- Disable automatic site search, form interactions, outbound clicks and file
  downloads for this CV app. Use the site's controlled events instead, so
  document URLs and user-entered form/search text cannot enter automatic events.
- Review data collection settings: Google signals and user-provided data are
  not needed for these measurements. The site disables ad personalization signals.

In Admin → Data display → Events/Key events, mark download_completed as a key
event, counted once per event. Optionally mark cv_import_completed as a secondary
key event. builder_started is the funnel entry, not a completed CV. New event
names may take time to appear. Zero historical key events cannot be backfilled
by this website change. We have not changed account settings from code.

## Events

- builder_started: once per browser tab session after consent, including when
  consent is granted while the builder is open; remounts do not duplicate it.
- cv_import_completed: after reviewed data is accepted by the builder; failed,
  cancelled or unconfirmed imports do not count. Repeated confirm is guarded
  by the importer's existing import ID set. Only generic format is sent.
- download_completed: after the CV export promise succeeds, not at button click.
  The former duplicate cv_downloaded Google event has been removed.
- cover_letter_downloaded: after a successful cover-letter export.

Only allowlisted events, enumerated attributes and bounded numeric completion
values are sent. Names, CV text, filenames, emails, phone numbers, account/CV IDs,
free-form roles, query strings and hash fragments are excluded. No fallback
console logging or Plausible tracker remains. Safe campaign source/medium values
are recognized for linkedin/facebook/instagram/whatsapp/youtube/tiktok/newsletter/
partner/share/copylink with social/referral/email/cpc. Other arbitrary campaign
values are ignored; do not put personal information in campaign links.

## Privacy choices

Allow analytics and Reject analytics are offered on every page. Privacy choices
reopens settings. Rejection clears accessible GA cookies and stops collection;
it cannot remove previously collected Google data. Essential drafts are not
cleared. If storage is blocked, choice/deduplication may not survive reloads.
Declined visits will not appear in GA, so it is not a complete traffic counter.

## Advertising

Empty ad placeholders are hidden when ads are disabled. A publisher ID alone no
longer starts advertising: VITE_ADSENSE_ENABLED=true is also required. Leave ads
disabled until account/site approval, real slot IDs and suitable placements are
ready. This analytics preference panel is not a Google-certified advertising CMP.
Configure Google's required certified CMP/TCF solution before personalized ads
for EEA, UK or Swiss visitors; review other applicable consent requirements.
Do not put ads inside CV documents, upload/review fields, or next to download
controls where they could cause accidental clicks. Do not fabricate ads.txt:
use the actual publisher account's supplied entry when available.

## Search and content

Sitemap and robots access are included in the build crawlability checks.
Verify the domain, submit /sitemap.xml and inspect real indexing/search queries
in Google Search Console. Code checks do not prove Google has indexed a page.
AdSense review still evaluates content quality, site usability and policies;
these changes do not guarantee approval. Improve original CV examples and
editorial review rather than adding near-duplicate city/job pages in bulk.

## Verification

npm run test:analytics
npm run test:cv-import
npm run build

The Analytics tests simulate Google's queue; they do not send test traffic to
Google or prove that the property received events. Validate consenting real
production visits in Realtime/DebugView after the GA property settings above.
