# gkim65.github.io

Personal academic site. Plain HTML/CSS/JS — no build step.

## Files
- `index.html` — landing page (photo, bio, links). Edit text between the `EDIT YOUR CONTENT` comments.
- `research.html` — interactive conjunction scene + paper list. Add papers as `<li>` items; each has `data-topics` (e.g. `data-topics="conjunction ground-stations"`) that ties it to scene regions.
- `projects.html` — HUCsat, theses, etc.
- `assets/style.css` — all styling. Design tokens (colors/fonts) are at the top.
- `assets/research.js` — the hover/click filtering for the research page.
- `assets/headshot.jpg` — **add your photo here** (any square-ish image works).

## Editing the research scene
Each interactive region in the SVG is a `<g class="hot" data-topic="...">`. To link a paper to a region, give the paper's `<li>` a matching value in `data-topics`. A paper can belong to multiple regions (space-separated) or none.

## Deploy
Push to the `main` branch of `gkim65/gkim65.github.io`, then in the repo:
Settings → Pages → set Source to the `main` branch. Live at https://gkim65.github.io within a minute or two.

## Local preview
Open `index.html` in a browser, or run `python3 -m http.server` in this folder and visit http://localhost:8000.
