# gkim65.github.io

Personal academic site. Plain HTML/CSS/JS — no build step.

## Files
- `index.html` — landing page: portrait, bio, profile links, research-interest chips and selected publications. Edit text between the `EDIT YOUR CONTENT` comments.
- `research.html` — publication list with year and area filters, and an animated visual above the list for the selected area.
- `talks.html` — talks and conference presentations.
- `news.html` — press coverage, with a year filter.
- `assets/style.css` — all styling. Design tokens (colours, fonts) are at the top.
- `assets/pubs.js` — year/area filters and BibTeX toggles for the research page.
- `assets/area-visuals.js` — the canvas animations for each research area, and the "All" grid of them.
- `assets/news.js` — year filter for the news page.
- `assets/theme.js` — light/dark toggle.
- `assets/profile.jpeg` — portrait; `assets/news/` — news thumbnails.
- `robots.txt`, `sitemap.xml` — for search engines. Add a new page to the sitemap; each page's `<head>` also has a description, canonical link and link-preview (Open Graph) tags, and `index.html` carries the structured `Person` data.

## Adding a publication
Add an `<li>` to the list in `research.html`, newest first. `data-year` drives the year filter and `data-areas` (space-separated keys such as `autonomy conjunction`) the area filter; the inline `.tag` spans give each area its label. Every entry shows arXiv, DOI, Presentation and BibTeX buttons; a missing one stays as a greyed `<a class="link-todo" aria-disabled="true">`, and a slot that can never apply is left out.

`?area=<key>` on the research page URL preselects an area, which is how the home-page chips link in.

## Adding a talk
Add an `<li>` at the top of the list in `talks.html`, with a thumbnail in `assets/talks/` (for a YouTube video, its own thumbnail named by the video ID) and a Video button.

## Deploy
Push to the `main` branch of `gkim65/gkim65.github.io`; GitHub Pages serves it at https://gkim65.github.io within a minute or two.

## Local preview
Run `python3 -m http.server` in this folder and visit http://localhost:8000.
