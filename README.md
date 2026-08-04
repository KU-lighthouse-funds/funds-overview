# KU Lighthouse — Funding overview

Public searchable overview of grants and programmes for founders and researchers.

**Live site (after Pages is enabled):** https://ku-lighthouse-funds.github.io/funds-overview/

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
