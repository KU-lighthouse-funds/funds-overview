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

/** One or more journey stages — comma-separated in CSV, like industry segments. */
export function parseStages(row) {
  return (row.Stage || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function rowMatchesStages(row, pickedStages) {
  if (!pickedStages?.length) return true;
  const rowStages = parseStages(row);
  if (rowStages.includes("All stages")) return true;
  return pickedStages.some((s) => rowStages.includes(s));
}

/** Innovation journey stages for filters and the landing-page dropdown. */
export const STAGE_OPTIONS = [
  {
    value: "Exploratory innovation",
    label: "Exploratory innovation",
    desc: "Usually TRL 1–3. Research and early ideas before structured commercial testing.",
  },
  {
    value: "Commercial validation",
    label: "Commercial validation",
    desc: "Usually TRL 3–6. Maturing research toward market relevance; typically university employees and pre-CVR.",
  },
  {
    value: "Venture formation",
    label: "Venture formation",
    desc: "Usually TRL 3–7. Founder-led commercialisation with incorporation as a planned outcome, not a prerequisite.",
  },
  {
    value: "Growth/scale",
    label: "Growth/scale",
    desc: "Usually TRL 8–10. Scaling proven solutions — export, deployment, and market expansion.",
  },
];

/** Canonical industry segments for filters and the landing-page dropdown. */
const SEGMENT_OPTIONS_RAW = [
  {
    value: "General",
    label: "General",
    desc: "Always shown regardless of segment",
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

export const SEGMENT_OPTIONS = [...SEGMENT_OPTIONS_RAW].sort((a, b) => {
  if (a.value === "General") return -1;
  if (b.value === "General") return 1;
  return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
});

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

let programmesCache = null;
let programmesDataVersion = null;
let programmesPromise = null;
let programmesRevalidatePromise = null;
const programmesListeners = new Set();
const PROGRAMMES_CACHE_KEY = "ku-funds-programmes-v4";
const PROGRAMMES_CACHE_SCHEMA = 4;

function normalizeProgrammesPayload(raw) {
  if (Array.isArray(raw)) {
    return { version: `legacy-${raw.length}`, programmes: raw };
  }
  return {
    version: String(raw?.version || raw?.programmes?.length || 0),
    programmes: Array.isArray(raw?.programmes) ? raw.programmes : [],
  };
}

function readProgrammesCache() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(PROGRAMMES_CACHE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.schema !== PROGRAMMES_CACHE_SCHEMA || !parsed?.version || !Array.isArray(parsed.data)) {
        continue;
      }
      programmesDataVersion = parsed.version;
      return parsed.data;
    } catch {
      /* unavailable or corrupt */
    }
  }
  return null;
}

function writeProgrammesCache(version, data) {
  programmesDataVersion = version;
  const payload = JSON.stringify({ schema: PROGRAMMES_CACHE_SCHEMA, version, data });
  for (const store of [localStorage, sessionStorage]) {
    try {
      store.setItem(PROGRAMMES_CACHE_KEY, payload);
    } catch {
      /* quota or private mode */
    }
  }
}

async function fetchProgrammesFromNetwork() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch("data/programmes.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const { version, programmes } = normalizeProgrammesPayload(raw);
      return { version, programmes };
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  return { version: "0", programmes: [] };
}

function notifyProgrammesUpdated(programmes) {
  programmesListeners.forEach((fn) => {
    try {
      fn(programmes);
    } catch (err) {
      console.error(err);
    }
  });
}

function revalidateProgrammesCache(cachedVersion) {
  if (programmesRevalidatePromise) return programmesRevalidatePromise;

  programmesRevalidatePromise = fetchProgrammesFromNetwork()
    .then(({ version, programmes }) => {
      if (cachedVersion && cachedVersion === version) return programmesCache;
      programmesCache = programmes;
      writeProgrammesCache(version, programmes);
      notifyProgrammesUpdated(programmes);
      return programmes;
    })
    .catch((err) => {
      console.warn("Programme data revalidation failed:", err);
      return programmesCache;
    })
    .finally(() => {
      programmesRevalidatePromise = null;
    });

  return programmesRevalidatePromise;
}

/** Cached programmes if already in memory or storage; otherwise null. */
export function peekProgrammesCache() {
  if (programmesCache) return programmesCache;
  return readProgrammesCache();
}

/** Called when a background refresh returns newer programme data. */
export function onProgrammesUpdated(listener) {
  programmesListeners.add(listener);
  return () => programmesListeners.delete(listener);
}

export function loadProgrammes() {
  if (programmesCache) {
    revalidateProgrammesCache(programmesDataVersion);
    return Promise.resolve(programmesCache);
  }

  const cachedData = readProgrammesCache();
  const cachedVersion = programmesDataVersion;

  if (cachedData) {
    programmesCache = cachedData;
    revalidateProgrammesCache(cachedVersion);
    return Promise.resolve(cachedData);
  }

  if (!programmesPromise) {
    programmesPromise = fetchProgrammesFromNetwork()
      .then(({ version, programmes }) => {
        programmesCache = programmes;
        writeProgrammesCache(version, programmes);
        return programmes;
      })
      .finally(() => {
        programmesPromise = null;
      });
  }

  return programmesPromise;
}

loadProgrammes();

/** Delay rapid calls — e.g. search input. */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function filtersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    stages: params.getAll("stage"),
    segments: params.getAll("segment"),
    opportunities: params.getAll("opportunity"),
    query: (params.get("q") || "").trim(),
    cvr: params.get("cvr") || "all",
  };
}

export function filtersToSearchParams(filters) {
  const params = new URLSearchParams();
  (filters.stages || []).forEach((v) => params.append("stage", v));
  (filters.segments || []).forEach((v) => params.append("segment", v));
  (filters.opportunities || []).forEach((v) => params.append("opportunity", v));
  if (filters.query) params.set("q", filters.query);
  if (filters.cvr && filters.cvr !== "all") params.set("cvr", filters.cvr);
  return params;
}

export function filterProgrammes(programmes, filters) {
  const q = (filters.query || "").toLowerCase();
  const cvr = filters.cvr || "all";

  return programmes.filter((row) => {
    if (filters.stages?.length && !rowMatchesStages(row, filters.stages)) return false;

    if (filters.segments?.length) {
      const segs = parseSegments(row);
      // "General" programmes are relevant to every segment, so they always show.
      const isGeneral = segs.some((s) => s.toLowerCase() === "general");
      if (!isGeneral && !filters.segments.some((s) => segs.includes(s))) return false;
    }

    if (filters.opportunities?.length) {
      const type = (row.Opportunity || "").trim();
      if (!filters.opportunities.includes(type)) return false;
    }

    if (filters.opportunityCol != null) {
      const type = (row.Opportunity || "").trim();
      if (!filters.opportunityCol.includes(type)) return false;
    }

    if (filters.stageCol != null) {
      const rowStages = parseStages(row);
      if (!filters.stageCol.some((s) => rowStages.includes(s))) return false;
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
      row["Fund contact email"],
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function countMatches(programmes, filters) {
  return filterProgrammes(programmes, filters).length;
}
