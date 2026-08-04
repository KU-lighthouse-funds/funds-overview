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
