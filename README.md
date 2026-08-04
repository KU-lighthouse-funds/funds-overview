# KU Lighthouse — Funding overview

Public searchable overview of grants and programmes for founders and researchers.

**Live site:** https://ku-lighthouse-funds.github.io/funds-overview/

## Design

Layout follows the original Lovable app; everything visual follows the KU INNO design guide
(`brand directions.pptx` in the parent folder).

**Palette** — only these six, plus purple as the KU Lighthouse marker:

| | |
|---|---|
| Red-orange | `#DB3B0A` |
| Light blue | `#B7D7DE` |
| Champagne | `#FEFAF2` |
| Dark blue | `#122947` |
| KU red | `#901A1E` |
| Dark grey | `#3D3D3D` |
| Purple (Lighthouse only) | `#C6C5FF` |

**Contrast** — the guide approves dark blue or red-orange on champagne, dark blue on light blue, and
champagne on red-orange. It rejects red-orange on light blue and dark blue on red-orange. Because
results rows turn light blue on hover and when opened, all text inside the table is dark blue.

**Shapes** — square corners, no drop shadows, and either a solid fill or a 1.5px outline, never both.

**Tables** — no fill, full 1.5px grid in the text colour, left-aligned and vertically centred.

**Type** — Open Sans. Semibold caps for headings, regular caps for sub-headings, regular sentence
case for body. Body line height is 1.5 rather than the deck's 1.2, which is set for slide type.

**Logo** — top-left with a thin rule underneath; the negative version on the dark landing page.

## Data

Built from `funds with KU support - v4.csv`. To refresh:

```bash
python sync_data.py
```

## Local preview (before pushing)

Preview changes on your machine with **live reload** — save a file and the browser refreshes.

From this folder:

```powershell
.\dev.ps1
```

Refresh data from the CSV first:

```powershell
.\dev.ps1 -Sync
```

Then open:

- Landing: http://localhost:8080/
- Results: http://localhost:8080/results.html

Press **Ctrl+C** in the terminal to stop. When it looks right, commit and push as usual.

Plain static server (no auto-reload):

```bash
python -m http.server 8080
```

Do not open `index.html` directly — `fetch` needs `http://`, not `file://`.
