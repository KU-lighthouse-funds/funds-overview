# KU Lighthouse — Funding overview

Public searchable overview of grants and programmes for founders and researchers.

**Live site:** https://ku-lighthouse-funds.github.io/funds-overview/

Layout and palette follow the original Lovable app: neutral greyscale on white, Open Sans throughout.

## Data

Built from `funds with KU support - v2.csv`. To refresh:

```bash
python sync_data.py
```

## Local preview

Open `index.html` via a local static server (fetch needs http, not `file://`):

```bash
python -m http.server 8080
```

Then visit http://localhost:8080
