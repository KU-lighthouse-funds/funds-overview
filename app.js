const STAGE_ORDER = [
  "Exploratory innovation",
  "PoC",
  "Early venture",
  "Growth/scale",
  "All stages",
];

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

const state = {
  programmes: [],
  stages: new Set(),
  segments: new Set(),
  query: "",
  expanded: new Set(),
};

function isSignificantFunding(amount) {
  const a = (amount || "").trim();
  if (!a) return false;
  if (NON_SIGNIFICANT_FUNDING.some((re) => re.test(a))) return false;
  // Must contain a concrete amount-ish signal
  return /\d/.test(a) || /DKK|EUR|€|\$|kr/i.test(a);
}

function parseSegments(row) {
  return (row["Industrial segment"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function cvrLabel(value, when) {
  const v = (value || "Any").trim();
  if (v === "Yes") return { text: `CVR ${when}: required`, cls: "yes" };
  if (v === "No") return { text: `CVR ${when}: pre-company`, cls: "no" };
  return { text: `CVR ${when}: any`, cls: "any" };
}

function buildInfoParts(row) {
  const funding = (row["Funding Amount"] || "").trim();
  const quick = (row["Quick info"] || "").trim();
  const significant = isSignificantFunding(funding);
  const lead = significant ? funding : "";
  const body = quick;
  return { lead, body, significant };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chip(label, group) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip";
  btn.textContent = label;
  btn.dataset.group = group;
  btn.dataset.value = label;
  btn.setAttribute("aria-pressed", "false");
  btn.addEventListener("click", () => {
    const set = group === "stage" ? state.stages : state.segments;
    if (set.has(label)) set.delete(label);
    else set.add(label);
    btn.setAttribute("aria-pressed", set.has(label) ? "true" : "false");
  });
  return btn;
}

function matches(row) {
  if (state.stages.size && !state.stages.has(row.Stage)) return false;

  if (state.segments.size) {
    const segs = parseSegments(row);
    const hit = [...state.segments].some((s) => segs.includes(s));
    if (!hit) return false;
  }

  const q = state.query.trim().toLowerCase();
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
}

function renderRow(row, idx) {
  const id = `${row.Name}::${idx}`;
  const open = state.expanded.has(id);
  const { lead, body } = buildInfoParts(row);
  const app = cvrLabel(row["CVR at application"], "apply");
  const start = cvrLabel(row["CVR at programme start"], "start");

  const needsClamp = (lead + " " + body).length > 180;
  const showExtra = open;

  const extraBits = [];
  if (row.Deadline) {
    extraBits.push(`<p><strong>Deadline:</strong> ${escapeHtml(row.Deadline)}</p>`);
  }
  if (row["KU support unit"] && row["KU support unit"] !== "—") {
    extraBits.push(
      `<p><strong>KU support:</strong> ${escapeHtml(row["KU support unit"])}` +
        (row["KU faculty focus"] ? ` · ${escapeHtml(row["KU faculty focus"])}` : "") +
        `</p>`
    );
  }
  if (row["KU contact hint"]) {
    extraBits.push(`<p><strong>Who to ask:</strong> ${escapeHtml(row["KU contact hint"])}</p>`);
  }
  // Intentionally omit Stage, Geography, Criteria, Funding Amount, CVR here (shown in row)

  return `
    <tr data-id="${escapeHtml(id)}">
      <td><span class="muted">${escapeHtml(row.Opportunity || "")}</span></td>
      <td class="name-cell">
        ${
          row.Link
            ? `<a href="${escapeHtml(row.Link)}" target="_blank" rel="noopener">${escapeHtml(row.Name)}</a>`
            : escapeHtml(row.Name)
        }
      </td>
      <td>${escapeHtml(row.Stage || "")}</td>
      <td>${escapeHtml(row.Geography || "")}</td>
      <td>
        <div class="cvr">
          <span class="badge ${app.cls}">${escapeHtml(app.text)}</span>
          <span class="badge ${start.cls}">${escapeHtml(start.text)}</span>
        </div>
      </td>
      <td class="info-cell">
        ${lead ? `<p class="funding-lead">${escapeHtml(lead)}</p>` : ""}
        <p class="info-text ${!open && needsClamp ? "clamped" : ""}">${escapeHtml(body || (lead ? "" : "—"))}</p>
        ${
          needsClamp || extraBits.length
            ? `<button type="button" class="toggle-more" data-toggle="${escapeHtml(id)}">${
                open ? "Show less" : "Read more…"
              }</button>`
            : ""
        }
        ${
          showExtra && extraBits.length
            ? `<div class="extra">${extraBits.join("")}</div>`
            : ""
        }
      </td>
    </tr>
  `;
}

function render() {
  const filtered = state.programmes.filter(matches);
  const body = document.getElementById("results-body");
  const empty = document.getElementById("empty");
  const count = document.getElementById("match-count");

  count.textContent = `${filtered.length} matching opportunit${filtered.length === 1 ? "y" : "ies"} so far`;
  body.innerHTML = filtered.map((row, i) => renderRow(row, i)).join("");
  empty.classList.toggle("hidden", filtered.length > 0);

  body.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-toggle");
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      render();
    });
  });
}

function runSearch() {
  state.query = document.getElementById("q").value;
  state.expanded.clear();
  render();
  document.querySelector(".results")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function init() {
  const res = await fetch("data/programmes.json");
  state.programmes = await res.json();

  const stages = STAGE_ORDER.filter((s) => state.programmes.some((p) => p.Stage === s));
  const segmentSet = new Set();
  state.programmes.forEach((p) => parseSegments(p).forEach((s) => segmentSet.add(s)));
  const segments = [...segmentSet].sort((a, b) => a.localeCompare(b));

  const stageHost = document.getElementById("stage-chips");
  const segHost = document.getElementById("segment-chips");
  stages.forEach((s) => stageHost.appendChild(chip(s, "stage")));
  segments.forEach((s) => segHost.appendChild(chip(s, "segment")));

  document.getElementById("search-btn").addEventListener("click", runSearch);
  document.getElementById("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  // Live filter as chips change + typing (optional smooth UX)
  stageHost.addEventListener("click", () => render());
  segHost.addEventListener("click", () => render());
  document.getElementById("q").addEventListener("input", () => {
    state.query = document.getElementById("q").value;
    render();
  });

  render();
}

init().catch((err) => {
  console.error(err);
  document.getElementById("match-count").textContent =
    "Could not load programme data. Check data/programmes.json.";
});
