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

export async function loadProgrammes() {
  const res = await fetch("data/programmes.json");
  if (!res.ok) throw new Error("Failed to load programmes.json");
  return res.json();
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
    if (filters.stages?.length && !filters.stages.includes(row.Stage)) return false;

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
