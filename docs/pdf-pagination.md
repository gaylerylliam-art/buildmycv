# CV PDF pagination

CV exports use CSS @page for the selected paper border on every sheet. In print
media, body padding/width/min-height are reset so those margins are not applied
twice. The server respects the document's @page declaration and uses print media.

Work entries and long sections can fragment naturally. A small experience-heading
wrapper keeps the role/employer/date block together with the following content;
paragraph widows/orphans protect readability without keeping an entire job on one
page. Sidebar main-content padding is horizontal in print; the sidebar grid can
continue across sheets without an artificial one-page minimum height.

The browser fallback uses the same millimeter margin with jsPDF. It captures a
scoped, styled export root in a temporary iframe; it does not inject document-wide
styles into the builder. Small bullet blocks are kept together during bitmap
capture to reduce line slicing. The server PDF remains the preferred text-based
export; fallback is rasterized by html2pdf, as before.

Checks:
- npm run test:pdf-pagination generates 12 real PDFs across four layouts, three
  paper-margin values and LTR/RTL content; checks every page's text bounds,
  non-final-page utilization and all unique responsibility markers.
- npm run test:pdf-fallback forces a server failure, downloads an actual fallback
  PDF, checks repeated margins/sidebar colors on pages 1-2, and confirms iframe
  cleanup and no application style changes.
- npm run test:cv-import checks data/export preservation.

Fixtures contain synthetic information only. Generated files/screenshots are
ignored under artifacts/pdf-pagination. Existing downloaded PDFs cannot be
changed by this code; users regenerate their CV after the fix is deployed.
