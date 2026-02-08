# CLAUDE.md

## Project Overview

Static single-page newspaper-style website called "DREAM POST" (드림 포스트). Built as a Sparta Coding Club project. Content is in Korean about a character named "유민" in a steampunk-themed world.

## Repository Structure

```
mynewa/
├── index.html        # Main (and only) webpage
├── DID video.mp4     # Embedded video asset (~3.1 MB)
└── CLAUDE.md         # This file
```

## Tech Stack

- **Language:** HTML5 (vanilla, no framework)
- **Styling:** External CSS from Sparta Coding Club S3 CDN
- **JavaScript:** External JS from Sparta Coding Club S3 CDN
- **Fonts:** Google Fonts (Playfair Display, Droid Serif)
- **Build system:** None — static files served directly

## External Dependencies (CDN)

All external resources are loaded from CDNs at runtime:

- **CSS:** `https://s3.ap-northeast-2.amazonaws.com/materials.spartacodingclub.kr/free/codingday/news.css`
- **JS:** `https://s3.ap-northeast-2.amazonaws.com/materials.spartacodingclub.kr/free/codingday/news.js`
- **Fonts:** Google Fonts API
- **Images:** Sparta Coding Club S3 bucket (steampunk.png, jackpot.png, nomad.png)

## Development

### Running Locally

Open `index.html` directly in a browser. No build step, server, or installation required.

### Testing

No test framework or tests exist.

### Linting / Formatting

No linting or formatting tools are configured.

## Code Conventions

- HTML uses class-based selectors (`.head`, `.collumns`, `.collumn`, `.headline`, `.hl1`–`.hl6`, `.media`, `.figure`, `.figcaption`, `.citation`)
- Responsive viewport meta tag is set
- Open Graph meta tags are included for social sharing
- Video element uses `controls loop muted autoplay` attributes
- Content is primarily Korean with some English text
- No inline `<style>` blocks — all styling is external
- Minimal inline styles (only `font-style: italic` in one span)

## Notes for AI Assistants

- This is a single-file static project. Keep changes minimal and self-contained.
- External CSS/JS are hosted on Sparta Coding Club's S3 bucket and cannot be modified locally.
- The video file (`DID video.mp4`) is a binary asset — do not attempt to read or modify it.
- Any new styling should either go inline or in a new local CSS file, since the external stylesheet is not under version control.
- Preserve the Korean-language content and newspaper layout structure when making edits.
