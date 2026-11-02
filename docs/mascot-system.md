# Mascot System

The six supplied globe-free cutouts are decorative companions, not part of a CV template.
The existing globe-backed header/footer logo remains unchanged. In-page image
URLs use the `v=cutout` revision to refresh previously cached mascot images.

## Components And Assets

- `src/components/Mascot.jsx`: `mood`, `image` override, `size` (`badge`, `compact`, `small`, `medium`, `large`), `placement`, `animation` (`auto` or `none`), and `eager` props.
- `public/assets/mascot.css`: reserved square space, once-only entrance, mood-specific whole-image movement, hover, crossfades, responsive sizes, reduced-motion and print exclusion.
- `public/assets/mascot-motion.js`: one shared IntersectionObserver, mutation registration/cleanup for React navigation, media preference and tab-visibility listeners. No scroll handlers or new dependency.
- `scripts/prepare-mascots.mjs <source-folder>`: uniformly scales the approved PNGs onto transparent 512px WebP canvases with a shared bottom baseline. Originals are not changed.

Reserved widths are 56 / 88 / 152 / 208 / 248px for badge / compact / small /
medium / large. At 600px and below they become 44 / 72 / 112 / 144 / 176px.
The editor grid reserves the compact width; the menu logo has independent sizing.

## Career Tips Card Animation

Every article card uses the shared `Mascot` with a four-frame `sprite` and a
staggered `spriteDelay`. `peekaboo-wave.webp` contains registered wave and blink
poses; `peekaboo-static.webp` remains visible before loading, without JavaScript,
on image failure, and with reduced motion. The existing observer pauses the
sprite offscreen, when the tab is hidden, or when motion is explicitly disabled.
Article titles, photos, filters, pagination and grid/list links are unchanged.

The built-in image generation tool derived the frames from the supplied
`Peekaboo Mascot Behind a Website Card.png`. Generation prompt: preserve the
boy's identity and navy outfit, remove the blank website panel and lettering,
create four registered transparent poses (neutral, outward wave, inward wave,
brief closed-eye blink), and clean background fringes. No CSS face distortion.
The selected source is saved locally at `artifacts/peekaboo-animation-source.png`.
Run `node scripts/prepare-peekaboo.mjs <source-png>` to create the two optimized
public WebP files. Run `node scripts/check-peekaboo.mjs` for focused browser checks.

## Placements

| Page | Appearances |
| --- | --- |
| Homepage | Welcoming introduction, thoughtful templates, excited final CTA |
| FAQ | Thoughtful questions, reassuring support |
| Blog index | Thoughtful introduction, excited final CTA |
| Articles | Thoughtful opening, excited final CTA; confident reading milestone on client-side articles |
| Templates / CV examples | Thoughtful introduction, confident closing milestone |
| Job/city guides | Focused introduction, excited final builder CTA |
| About / OFW | Welcoming introduction; confident milestone on the longer OFW page |
| Contact / Privacy / Terms / 404 | One reassuring appearance |
| CV builder | Small focused editor companion, thoughtful design mode, confident high-completion review mode |
| Account / OTP dialogs | Small reassuring guidance; confidence after OTP verification |
| Cover letter / downloads | Focused editor, excited existing download-confirmation area |

Mascots never enter `.cv-paper` or `.letter-paper`. The PDF/Word exporters
continue to generate documents from CV data, independently of the website DOM.
The decorative wrappers also opt out of html2canvas and printing.

## Local Checks

Run `npm run build`, then `npm run preview -- --port 5186`.
Set `PREVIEW_URL=http://127.0.0.1:5186` and run
`node scripts/check-mascots.mjs` for the full route and workflow checks.
`QUICK_MASCOTS=1` selects representative routes for faster iteration.

The workflow test stubs contact and OTP services, and renders the PDF response
locally with Chromium. It verifies actual PDF and DOCX files, not live email
delivery, cloud persistence, or production backend availability. No emails are sent.
