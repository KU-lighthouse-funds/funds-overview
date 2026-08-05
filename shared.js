const NON_SIGNIFICANT_FUNDING = [
  /^varies$/i,
  /^n\/?a$/i,
  /^-$/,
  /^event/i,
  /^recognition only/i,
  /^no cash/i,
  /^no direct/i,
  /^ticketed/i,
  /^programme support/i,
  /^program support/i,
  /^paid advisory/i,
  /^in-kind \(office/i,
  /^prize-based \(national/i,
];

export function isSignificantFunding(amount) {
  const a = (amount || "").trim();
  if (!a) return false;
  if (NON_SIGNIFICANT_FUNDING.some((re) => re.test(a))) return false;
  return /\d/.test(a) || /DKK|EUR|€|\$|kr/i.test(a);
}

export function parseSegments(row) {
  return (row["Industrial segment"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hasKuSupport(row) {
  const unit = (row["KU support unit"] || "").trim();
  return Boolean(unit) && !["—", "–", "-", "?"].includes(unit);
}

function monthIndex(token) {
  const key = token.toLowerCase().replace(/\./g, "").slice(0, 4);
  if (key.startsWith("jan")) return 0;
  if (key.startsWith("feb")) return 1;
  if (key.startsWith("mar")) return 2;
  if (key.startsWith("apr")) return 3;
  if (key.startsWith("may")) return 4;
  if (key.startsWith("jun")) return 5;
  if (key.startsWith("jul")) return 6;
  if (key.startsWith("aug")) return 7;
  if (key.startsWith("sep")) return 8;
  if (key.startsWith("oct")) return 9;
  if (key.startsWith("nov")) return 10;
  if (key.startsWith("dec")) return 11;
  return -1;
}

function dateKey(year, month, day, now) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (year != null) return new Date(year, month, day).getTime();

  let candidate = new Date(now.getFullYear(), month, day);
  if (candidate < startOfToday) candidate = new Date(now.getFullYear() + 1, month, day);
  return candidate.getTime();
}

/** Best-effort timestamp for sorting by nearest deadline; null when unknown / rolling. */
export function deadlineSortKey(text, now = new Date()) {
  const raw = (text || "").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (/^rolling\.?$/.test(lower)) return null;
  if (/^annual call\.?$/.test(lower)) return null;
  if (/^per (programme )?call\.?$/.test(lower)) return null;
  if (/^check /.test(lower)) return null;

  for (const match of raw.matchAll(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/g)) {
    const month = monthIndex(match[2]);
    if (month >= 0) return dateKey(+match[3], month, +match[1], now);
  }

  for (const match of raw.matchAll(/\b([A-Za-z]+)\.?\s+(\d{4})\b/g)) {
    const month = monthIndex(match[1]);
    if (month >= 0) return dateKey(+match[2], month, 1, now);
  }

  const monthHits = [];
  for (const match of raw.matchAll(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\b/gi
  )) {
    const month = monthIndex(match[1]);
    if (month >= 0) monthHits.push(dateKey(null, month, 1, now));
  }
  if (monthHits.length) return Math.min(...monthHits);

  const dayFirst = raw.match(/(\d{1,2})\s+([A-Za-z]+)(?!\s+\d{4})/);
  if (dayFirst) {
    const month = monthIndex(dayFirst[2]);
    if (month >= 0) return dateKey(null, month, +dayFirst[1], now);
  }

  return null;
}

/** Short Info-header line when a parseable deadline is still ahead; null otherwise. */
export function deadlineLead(text, now = new Date()) {
  const key = deadlineSortKey(text, now);
  if (key == null) return null;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (key < startOfToday) return null;

  const raw = (text || "").trim();
  const date = new Date(key);
  const opts = { day: "numeric", month: "long" };
  if (/\d{4}/.test(raw) || date.getFullYear() !== now.getFullYear()) {
    opts.year = "numeric";
  }

  return `Deadline ${date.toLocaleDateString("en-GB", opts)}`;
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Drop repeated or overlapping sentences so Quick info does not restate itself. */
export function dedupeCopy(text) {
  const raw = (text || "").trim();
  if (!raw) return raw;

  const parts = raw.match(/[^.!?]+[.!?]?/g)?.map((p) => p.trim()).filter(Boolean) ?? [raw];
  const kept = [];
  const norms = [];

  for (const part of parts) {
    const norm = part
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!norm) continue;

    const dup = norms.some(
      (prev) =>
        prev === norm ||
        (norm.length >= 20 && prev.includes(norm)) ||
        (prev.length >= 20 && norm.includes(prev))
    );
    if (dup) continue;

    kept.push(part);
    norms.push(norm);
  }

  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

export async function loadProgrammes() {
  // One retry: the first request can land while GitHub Pages is still swapping files.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch("data/programmes.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  return [];
}

export function filtersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    stages: params.getAll("stage"),
    segments: params.getAll("segment"),
    query: (params.get("q") || "").trim(),
    cvr: params.get("cvr") || "all",
  };
}

export function filterProgrammes(programmes, filters) {
  const q = (filters.query || "").toLowerCase();
  const cvr = filters.cvr || "all";

  return programmes.filter((row) => {
    if (filters.stages?.length) {
      // Programmes that span the whole journey stay visible whichever stage is picked.
      const spansAllStages = row.Stage === "All stages";
      if (!spansAllStages && !filters.stages.includes(row.Stage)) return false;
    }

    if (filters.segments?.length) {
      const segs = parseSegments(row);
      // "General" programmes are relevant to every segment, so they always show.
      const isGeneral = segs.some((s) => s.toLowerCase() === "general");
      if (!isGeneral && !filters.segments.some((s) => segs.includes(s))) return false;
    }

    if (cvr !== "all") {
      const atApplication = (row["CVR at application"] || "Any").trim();
      if (cvr === "no-company" && atApplication === "Yes") return false;
      if (cvr === "have-cvr" && atApplication === "No") return false;
    }

    if (!q) return true;
    const hay = [
      row.Name,
      row.Opportunity,
      row.Criteria,
      row["Industrial segment"],
      row.Stage,
      row.Geography,
      row["Funding Amount"],
      row["Quick info"],
      row.Deadline,
      row["KU support unit"],
      row["KU faculty focus"],
      row["KU contact email"],
      row["KU contact hint"],
      row["PPT notes"],
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function countMatches(programmes, filters) {
  return filterProgrammes(programmes, filters).length;
}
