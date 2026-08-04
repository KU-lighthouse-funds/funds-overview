# KU Lighthouse — Funding overview

Public searchable overview of grants and programmes for founders and researchers.

**Live site:** https://ku-lighthouse-funds.github.io/funds-overview/

Layout follows the original Lovable app. Colour is KU Lighthouse applied softly — cream surfaces,
dark blue text, red-orange actions, purple reserved for the KU marker. Type is Open Sans: semibold
uppercase for headings and subheadings, regular for body copy.

## Data

Built from `funds with KU support - v4.csv`. To refresh:

```bash
python sync_data.py
```

## Local preview

Open `index.html` via a local static server (fetch needs http, not `file://`):

```bash
python -m http.server 8080
```

Then visit http://localhost:8080
