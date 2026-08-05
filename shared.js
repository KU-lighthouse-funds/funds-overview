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

/** Canonical industry segments for filters and the landing-page dropdown. */
export const SEGMENT_OPTIONS = [
  {
    value: "General",
    label: "General",
    desc: "Cross-sector — shown for every segment you pick",
  },
  {
    value: "Life Sciences",
    label: "Life Sciences",
    desc: "Health, biotech, medtech, neuroscience, drug discovery, care tech",
  },
  {
    value: "Food & Agriculture",
    label: "Food & Agriculture",
    desc: "Food, agrifood, plant-based, bioresource, farming innovation",
  },
  {
    value: "Quantum",
    label: "Quantum",
    desc: "Quantum computing, sensing, communication, quantum devices",
  },
  {
    value: "Chemistry",
    label: "Chemistry",
    desc: "Chemistry in life science, materials, green and industrial applications",
  },
  {
    value: "Physics & Materials",
    label: "Physics & Materials",
    desc: "Physics, materials science, nanomaterials, advanced materials",
  },
  {
    value: "Deep Tech",
    label: "Deep Tech",
    desc: "Hard-science ventures and novel platforms not covered above",
  },
  {
    value: "Tech & AI",
    label: "Tech & AI",
    desc: "Software, AI, robotics, engineering, drones, maritime, fintech",
  },
  {
    value: "Cleantech & Energy",
    label: "Cleantech & Energy",
    desc: "Climate, sustainability, clean energy, environmental tech",
  },
  {
    value: "Manufacturing & Industry",
    label: "Manufacturing & Industry",
    desc: "Production, industry 4.0, industrial processes",
  },
  {
    value: "Social Impact",
    label: "Social Impact",
    desc: "Social innovation, education, welfare-oriented projects",
  },
  {
    value: "Creative & Media",
    label: "Creative & Media",
    desc: "Creative industries, media, gaming, design, sports, tourism",
  },
  {
    value: "Defense",
    label: "Defense",
    desc: "Defense tech and dual-use with defense relevance",
  },
];

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

  const hits = [];
  const yearInText = raw.match(/\b(\d{4})\b/)?.[1];

  for (const match of raw.matchAll(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/g)) {
    const month = monthIndex(match[2]);
    if (month >= 0) hits.push(dateKey(+match[3], month, +match[1], now));
  }

  for (const match of raw.matchAll(/\b([A-Za-z]+)\.?\s+(\d{4})\b/g)) {
    const month = monthIndex(match[1]);
    if (month >= 0) hits.push(dateKey(+match[2], month, 1, now));
  }

  for (const match of raw.matchAll(/(\d{1,2})\s+([A-Za-z]+)(?!\s+\d{4})/g)) {
    const month = monthIndex(match[2]);
    if (month >= 0) {
      hits.push(dateKey(yearInText ? +yearInText : null, month, +match[1], now));
    }
  }

  if (!hits.length) {
    for (const match of raw.matchAll(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\b/gi
    )) {
      const month = monthIndex(match[1]);
      if (month >= 0) hits.push(dateKey(yearInText ? +yearInText : null, month, 1, now));
    }
  }

  if (!hits.length) return null;
  return Math.min(...hits);
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
      row["Segment tags"],
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
