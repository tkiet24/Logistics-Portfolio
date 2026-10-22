## 1. Scope

**Redesign (allowed):** font, colors, typography, spacing, radius, elevation, and the CSS look of existing components. In the JS, only the visual constants listed in section 8.

**Keep exactly as is (not allowed to change):**

- All HTML structure, copy, IDs, classes, `data-*` attributes and the 5 sections: `#home`, `#about`, `#skills`, `#work`, `#contact` (Hero, About, Skills and Certification, Experience, Contact).
- Scroll logic (`meas`, `calc`, `cs`/`s` smoothing, `K` camera keyframes), progress bar, active nav highlight, panel fade-in (`.in`), stat count-up, skill chips, raycast hover/click on containers, globe drag, mouse parallax.
- All 3D figures and their motion: globe with route and ship, port with crane, skills container wall, experience road with truck, opening container with beans, drifting particles.
- Light/dark theme mechanism (`prefers-color-scheme` and `data-theme`), `.nogl` fallback, reduced-motion handling, WebGL breakpoints (`innerWidth<720`, `>860`).
- Do not add new elements, sections, libraries or JS features. CSS pseudo-elements are allowed.

---

## 2. Token mapping (existing variable → new value)

Existing variable names are kept so the JS (`css('--bg')`, `--dot`, `--ball`) keeps working.

| Variable              | Old (light)             | New (light)             | New (dark)              | Role                                                          |
| --------------------- | ----------------------- | ----------------------- | ----------------------- | ------------------------------------------------------------- |
| `--bg`                | `#e8eef0`               | `#F3F3F3` (sampled)     | `#0E0C0C`               | Page, scene background, fog                                   |
| `--fg`                | `#1d1612`               | `#030000` (sampled)     | `#F3F3F3`               | Headings, body strong, big numbers                            |
| `--muted`             | `#54606a`               | `#676261`               | `#B3AFAE`               | Paragraphs, captions                                          |
| `--panel`             | `rgba(244,248,249,.84)` | `rgba(255,255,255,.88)` | `rgba(20,17,17,.84)`    | Glass panels, nav strip                                       |
| `--line`              | `rgba(29,22,18,.16)`    | `#E3E3E3` (sampled)     | `rgba(243,243,243,.16)` | 1px borders, dividers                                         |
| `--accent`            | `#c93a1a`               | `#C00719` (sampled)     | `#FA4E42` (sampled)     | Buttons, active chip, progress bar, timeline line, logo block |
| `--onacc`             | `#fff`                  | `#FFFFFF`               | `#1A0504`               | Text on accent                                                |
| `--dot`               | `#18455a`               | `#A4A4A4`               | `#6F6A69`               | Globe dots and particles (grayscale like the reference)       |
| `--ball`              | `#cfdde3`               | `#E3E3E3`               | `#1E1A1A`               | Globe sphere                                                  |
| `--accent-2` (new)    | n/a                     | `#FA4E42` (sampled)     | `#FA4E42`               | Decorative coral: hover borders, arrows                       |
| `--accent-tint` (new) | n/a                     | `#FFB79D` (sampled)     | `#FFB79D`               | Soft chip hover/fill                                          |

**Why two accents:** white text on coral `#FA4E42` is only about 3.4:1 (fails AA for normal text). Deep red `#C00719` with white is about 6.4:1, so it carries all text-on-accent. Coral is decorative or used where text is large. In dark mode coral on near-black is about 5.8:1, so it can be the main accent there.

Contrast checks: `--muted` `#676261` on white about 6:1; dark `--muted` `#B3AFAE` on `#0E0C0C` about 8.9:1.

---

## 3. Drop-in `:root` block

Replace the existing three variable blocks (light, `prefers-color-scheme: dark`, `[data-theme="dark"]`) with this, keeping the same selectors and the existing `box-sizing` and safe-area lines.

```css
:root {
  --bg: #f3f3f3;
  --fg: #030000;
  --muted: #676261;
  --panel: rgba(255, 255, 255, 0.88);
  --line: #e3e3e3;
  --accent: #c00719;
  --onacc: #ffffff;
  --dot: #a4a4a4;
  --ball: #e3e3e3;
  --accent-2: #fa4e42;
  --accent-tint: #ffb79d;
  --font-sans: 'Inter Tight', 'Hanken Grotesk', system-ui, sans-serif;
  --r-card: 6px;
  --r-pill: 999px;
  --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.08);
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 24px;
  --s-6: 28px;
  --s-7: 40px;
  --s-8: 64px;
  --s-9: 96px;
  --gutter: 27px;
  box-sizing: border-box;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #0e0c0c;
    --fg: #f3f3f3;
    --muted: #b3afae;
    --panel: rgba(20, 17, 17, 0.84);
    --line: rgba(243, 243, 243, 0.16);
    --accent: #fa4e42;
    --onacc: #1a0504;
    --dot: #6f6a69;
    --ball: #1e1a1a;
    --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
}
:root[data-theme='dark'] {
  --bg: #0e0c0c;
  --fg: #f3f3f3;
  --muted: #b3afae;
  --panel: rgba(20, 17, 17, 0.84);
  --line: rgba(243, 243, 243, 0.16);
  --accent: #fa4e42;
  --onacc: #1a0504;
  --dot: #6f6a69;
  --ball: #1e1a1a;
  --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.4);
}
```

---

## 4. Typography

**Font:** Inter Tight (replaces Archivo). Fallbacks: Hanken Grotesk, system-ui.

```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap" />
```

**Style:** headings are light (weight 400, not 800), line-height about 1.0, letter-spacing -0.03em. Large numbers are also weight 400.

| Role            | Selector                           | Size                                    | Weight | Line-height | Tracking |
| --------------- | ---------------------------------- | --------------------------------------- | ------ | ----------- | -------- |
| Display H1      | `h1`                               | `clamp(2.5rem,5.4vw,4.5rem)` (40–72px)  | 400    | 1.0         | -0.03em  |
| H2              | `h2`                               | `clamp(1.9rem,3.4vw,2.75rem)` (30–44px) | 400    | 1.05        | -0.03em  |
| Stat number     | `.stats b`                         | `clamp(2rem,3.2vw,2.75rem)`             | 400    | 1.0         | -0.03em  |
| Timeline title  | `li b`                             | 1.15rem                                 | 500    | 1.3         | 0        |
| Body            | `body`, `p`                        | 16px (0.94rem on mobile)                | 400    | 1.6         | 0        |
| Nav links       | `nav a`                            | 0.95rem (0.8rem mobile)                 | 400    | 1.2         | 0        |
| Buttons / chips | `.btn`, `.chip`                    | 1rem                                    | 500    | 1.2         | 0        |
| Caption / hint  | `.stats span`, `.hint`, `li small` | 0.8–0.85rem                             | 400    | 1.4         | 0        |
| Logo block      | `header b`                         | 1rem                                    | 500    | 1           | -0.01em  |

H1 is capped at 72px (not the reference's ~96px) because panels are about 520px wide and the word "Vietnamese" must fit.

Use `font-variant-numeric:tabular-nums` on `.stats b` so the count-up does not jitter.

---

## 5. Spacing, radius, elevation

| Token           | Value                                                  | Replaces / used for                                       |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| Base unit       | 4px (`--s-1`)                                          | Spacing scale 4, 8, 12, 16, 24, 28, 40, 64, 96            |
| `--gutter`      | 27px                                                   | Header side padding                                       |
| Section padding | `96px 6vw` desktop, `80px 12px 20px` mobile (existing) | `section`                                                 |
| Panel padding   | `--s-6` 28px desktop, 18px mobile                      | `.panel`                                                  |
| Panel max-width | 520px desktop, full width mobile                       | `.panel`                                                  |
| `--r-card`      | 6px                                                    | Panel (was 14px), chips (was 10px), nav strip, logo block |
| `--r-pill`      | 999px                                                  | Buttons                                                   |
| `--shadow-soft` | `0 4px 20px rgba(0,0,0,.08)`                           | Panel, nav strip                                          |
| Border          | 1px `--line`                                           | Panels, chips, nav dividers                               |

---

## 6. Component specs (CSS overrides)

Keep every existing selector and behavior (`opacity` transition on `.panel`, `pointer-events` rules). Add or replace only these properties.

```css
body {
  font: 400 16px/1.6 var(--font-sans);
}
h1 {
  font-size: clamp(2.5rem, 5.4vw, 4.5rem);
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 1;
}
h2 {
  font-size: clamp(1.9rem, 3.4vw, 2.75rem);
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

/* progress bar */
#bar {
  background: var(--accent);
}

/* header: red logo block + bordered nav strip */
header {
  padding: calc(13px + env(safe-area-inset-top, 0px)) var(--gutter) 12px;
}
header b {
  background: var(--accent);
  color: var(--onacc);
  padding: 10px 16px;
  border-radius: var(--r-card);
  font-weight: 500;
  letter-spacing: -0.01em;
}
nav {
  display: flex;
  background: var(--panel);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-soft);
}
nav a {
  margin: 0;
  padding: 12px 16px;
  font-size: 0.95rem;
  opacity: 0.7;
  border-left: 1px solid var(--line);
  border-bottom: 2px solid transparent;
}
nav a:first-child {
  border-left: 0;
}
nav a.on {
  opacity: 1;
  border-bottom-color: var(--accent);
}

/* focus */
a:focus-visible,
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* panel */
.panel {
  max-width: 520px;
  border-radius: var(--r-card);
  padding: var(--s-6);
  box-shadow: var(--shadow-soft);
}

/* pill button with attached arrow circle */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--s-3);
  min-height: 44px;
  margin: var(--s-3) var(--s-3) 0 0;
  padding: 6px 6px 6px 20px;
  border-radius: var(--r-pill);
  font-weight: 500;
}
.btn::after {
  content: '→';
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--onacc);
  color: var(--accent);
  transition: transform 0.2s;
}
.btn:hover::after {
  transform: translateX(3px);
}
.btn.o::after {
  background: var(--accent);
  color: var(--onacc);
}

/* stats: big light numbers with thin vertical dividers */
.stats {
  gap: 0;
}
.stats > div {
  padding: 0 var(--s-3);
}
.stats > div:first-child {
  padding-left: 0;
}
.stats > div + div {
  border-left: 1px solid var(--fg);
}
.stats b {
  color: var(--fg);
  font-weight: 400;
  font-size: clamp(2rem, 3.2vw, 2.75rem);
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

/* chips */
.chip {
  border-radius: var(--r-card);
  font-weight: 500;
  min-height: 44px;
  transition: border-color 0.2s;
}
.chip:hover {
  border-color: var(--accent-2);
}

/* timeline */
li {
  border-left: 2px solid var(--accent);
}
li b {
  font-weight: 500;
  font-size: 1.15rem;
}
```

Also extend the reduced-motion rule to `*,*::before,*::after{transition:none!important}` so the button arrow does not animate.

Mobile (`max-width:860px`, existing): keep `header b{display:none}` and centered header. Set `nav a{padding:12px;font-size:.8rem}`, `.panel{padding:18px}`, `.btn` stays 44px high.

---

## 7. Page sections (unchanged content, restyled)

| #   | Section (ID)                         | Content                      | Restyle notes                                                            |
| --- | ------------------------------------ | ---------------------------- | ------------------------------------------------------------------------ |
| 1   | Landing / Hero (`#home`)             | H1, intro, two buttons, hint | Light H1, pill buttons with arrow circle, grayscale globe with red route |
| 2   | About (`#about`)                     | H2, paragraph, 3 stats       | Stats as big light numbers with vertical dividers                        |
| 3   | Skills and Certification (`#skills`) | H2, hint, 6 chips, caption   | Bordered 6px chips, active chip filled accent                            |
| 4   | Experience (`#work`)                 | Timeline of 3 entries        | 2px accent line, medium-weight titles                                    |
| 5   | Contact (`#contact`)                 | H2, text, 2 buttons          | Same pill buttons, primary and outline                                   |

---

## 8. 3D scene palette (JS visual constants only)

These are the only JS edits allowed. Colors map to sampled Emons colors; everything else in the script stays untouched.

| Constant / location                                                 | Old                                                       | New                                                                     |
| ------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `ACC` (route, crane, ship deck, road, truck cab, contact container) | `0xe0502a`                                                | `0xEB2316` (scene red, sampled)                                         |
| `PAL` (6 container colors, in skill order)                          | `[0xe0502a,0x1f6feb,0xf2b705,0x2a9d8f,0xc9d1de,0x7a4cc2]` | `[0xEB2316,0x00716E,0x4A4443,0xFFB79D,0x676261,0xD9D6D4]`               |
| Hemisphere light ground                                             | `0x405070`                                                | `0x6B6564`                                                              |
| Port grid color (`GridHelper`)                                      | `0x7f8aa0`                                                | `0xA4A4A4`                                                              |
| Warehouse box color                                                 | `0xaab6c4`                                                | `0xD9D6D4`                                                              |
| Contact glow plane                                                  | `0xffc27a`                                                | `0xFFB79D`                                                              |
| Contact point light                                                 | `0xffa860`                                                | `0xFFB79D`                                                              |
| Container label font in `tag()`                                     | `800 42px Archivo,system-ui,sans-serif`                   | `500 42px "Inter Tight",system-ui,sans-serif`                           |
| Label text color in `tag()`                                         | always `#fff`                                             | `#fff` on dark fills, `#030000` on light fills (`0xFFB79D`, `0xD9D6D4`) |

Keep unchanged: bean color `0x9a6330` (coffee brown), ship hull white, stripe textures, camera keyframes, all positions and animation math.

Notes:

- Globe dots, particles and sphere already follow `--dot` and `--ball`, so they turn grayscale automatically with the new tokens.
- Container labels are drawn to canvas at script start, before the web font may have loaded (same as the current Archivo behavior). Optional low-risk improvement: wait for `document.fonts.load('500 42px "Inter Tight"')` before building the textures.
- `0x4A4443` containers have low contrast on the dark background; check them in dark mode.

---

## 9. Responsive (PC, Laptop, Mobile)

CSS breakpoint at 860px and JS breakpoints at 720px and 860px already exist and must not move.

| Device | Viewport                   | Layout                                                                                                                                                    |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PC     | ≥ 1440px                   | Panel 520px at left, 3D shifted right by the existing view offset. H1 72px, H2 44px, stats 44px. Section padding 96px 6vw.                                |
| Laptop | 861–1439px                 | Same layout. Type scales through `clamp()` (H1 about 56–72px).                                                                                            |
| Mobile | ≤ 860px (target 360–430px) | Panel full width at the bottom of each section, logo hidden, nav strip centered, H1 40px, stats 2rem (3 columns kept, dividers kept), tap targets ≥ 44px. |

No horizontal page scroll at any width. Test at 1920, 1440, 1280, 1024, 860, 430 and 360px.

---

## 10. Accessibility

- Text on `--accent` uses `--onacc` (white on `#C00719` about 6.4:1).
- Visible focus rings on links and chips (2px accent, offset 3px).
- `prefers-reduced-motion`: keep the existing handling; also disable the button arrow transition.
- Keep `aria-hidden` on the canvas and the `lang` attribute.

---

## 11. Prompt for the AI coding agent

Attach `index.html` and this file.

```
You are redesigning ONLY the visual design system of the attached index.html
using the attached design-system.md. The result must look and behave the
same as today (same flow, scroll behavior, animations, 3D figures, content),
but with the new fonts, colors, typography, spacing, radius and component
styling from design-system.md.

HARD RULES (do not break):
1. Do not change HTML structure, text content, IDs, classes, data-* attributes
   or the 5 sections (#home, #about, #skills, #work, #contact).
2. Do not change any JS logic: scroll math (meas/calc/cs), camera keyframes K,
   panel fade (.in), stat count-up, chip picking, raycast hover/click, globe
   drag, parallax, theme observer, .nogl fallback, reduced-motion handling,
   breakpoints (860px CSS; 720px and 860px in JS).
3. Do not add elements, sections, libraries or features. CSS pseudo-elements
   (e.g. .btn::after) are allowed.
4. Keep the existing CSS variable names (--bg, --fg, --muted, --panel, --line,
   --accent, --onacc, --dot, --ball) because JS reads them. Add the new
   variables from section 3.

WHAT TO CHANGE:
A. Replace the three :root variable blocks with the block in section 3 of
   design-system.md (light, prefers-color-scheme dark, [data-theme="dark"]).
B. Swap the Google Fonts link from Archivo to Inter Tight (400;500;600) and
   use var(--font-sans) on body.
C. Apply the typography table (section 4) and component CSS overrides
   (section 6) to the existing selectors: h1, h2, header/nav, #bar, .panel,
   .btn (with the arrow circle via ::after), .stats, .chip, ol/li, focus
   states, mobile @media(max-width:860px).
D. In the JS apply ONLY the constants in section 8: ACC, PAL, hemisphere
   ground color, grid color, warehouse box color, contact glow and point-light
   colors, the tag() font string, and light/dark label text color in tag().
   Optionally wait for document.fonts.load('500 42px "Inter Tight"') before
   creating the label textures, without changing anything else.
E. Extend the reduced-motion rule to include ::before and ::after.

VERIFY BEFORE FINISHING (report results):
- Page opens; light and dark theme both look correct (toggle
  data-theme="dark" and the OS setting).
- Scrolling still travels globe -> port -> skills wall -> road -> contact
  container, progress bar and active nav item update, panels fade in/out,
  stats count up once, chips update the caption and highlight the container,
  container hover/click works, globe drag works.
- No horizontal scroll at 1920, 1440, 1280, 1024, 860, 430, 360px. H1
  "Vietnamese coffee, delivered on time." does not overflow its panel.
- Contrast: button text, nav text and muted text meet WCAG AA in both themes.
- WebGL-off fallback (.nogl) still shows panels.

OUTPUT: the complete updated index.html, then a short changelog listing every
CSS block and every JS constant you changed. If something in the spec conflicts
with the hard rules, keep the hard rules and tell me.
```
