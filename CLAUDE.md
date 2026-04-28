# CLAUDE.md

## Project overview

BG Image Generator is a browser-based batch image generator using OpenAI's image API. Users upload a CSV, write a prompt template with `{{column}}` placeholders, and generate images for each row.

Hosted on GitHub Pages: https://lajlev.github.io/bg-image-generator/

## Tech stack

- Vanilla HTML, CSS, JavaScript (no frameworks, no build tools)
- OpenAI Images API (`/v1/images/generations`)
- JSZip (CDN) for zip downloads
- Google Fonts: Press Start 2P (pixel headlines), Space Grotesk (body)
- GitHub Pages deployment from `main` branch root (legacy/Jekyll)

## File structure

- `index.html` — Main app HTML, sidebar + single-column layout
- `style.css` — Dark mode retro 16-bit theme (no border-radius, amber accent #f59e0b)
- `app.js` — All app logic (~780 lines vanilla JS)
- `samples/` — CSV sample files (pirate, space, medieval themes)
- `logo.png` — 16-bit pixelated logo
- `tutorial.mp4` — Video tutorial
- `_config.yml` — Jekyll config to exclude non-site files from GitHub Pages

## Key patterns

- `modelConfig` object defines valid sizes and pricing per model (gpt-image-1, DALL-E 3, DALL-E 2)
- `{{placeholder}}` template syntax for prompts and filenames
- API key, prompt history, model/size preferences stored in localStorage
- CSV parsing handles quoted fields and escaped quotes
- 136 board game flavor text entries shown during generation with CSS animations
- Collapsible `<details>` elements for API key section and CSV data table

## Design

- Dark mode only (#111 bg, #1a1a1a cards, #333 borders)
- Amber accent color: #f59e0b
- No border-radius anywhere (sharp pixel aesthetic)
- Sidebar on desktop, horizontal header on mobile (breakpoint: 700px)
- Press Start 2P font for headings (uppercase), Space Grotesk for body

## Deployment

Deployed via `gh-pages` from `main` branch. Push to `main` to deploy.

```bash
git push origin main
```

## Common tasks

- To add a new image model: update `modelConfig` in app.js with sizes and pricing
- To add sample datasets: add CSV to `samples/`, add entry to `samples` object in app.js, add option to `#sample-select` in index.html
- To add flavor text: append `[message, game]` tuples to the `flavorTexts` array in app.js
