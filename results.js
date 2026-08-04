import {
  loadProgrammes,
  filtersFromUrl,
  filterProgrammes,
  parseSegments,
  isSignificantFunding,
  hasKuSupport,
  escapeHtml,
  dedupeCopy,
} from "./shared.js";

const state = {
  all: [],
  filters: filtersFromUrl(),
  sort: { key: null, dir: 1 },
  expanded: new Set(),
};

function cvrTags(row) {
  const atApplication = (row["CVR at application"] || "Any").trim();
  const atStart = (row["CVR at programme start"] || "Any").trim();
  const tags = [];
  if (atApplication === "No") tags.push({ text: "Pre-company", cls: "pill-pre" });
  if (atApplication === "Yes") tags.push({ text: "CVR required", cls: "pill-cvr" });
  if (atApplication !== "Yes" && atStart === "Yes") {
    tags.push({ text: "CVR by start", cls: "pill-cvr-soon" });
  }
  return tags;
}

function segmentChips(row) {
  const segs = parseSegments(row);
  const picked = new Set(state.filters.segments || []);
  if (!segs.length) return "";
  return `<div class="chips">${segs
    .map((s) => {
      const cls = picked.has(s) ? " chip picked" : " chip";
      return `<span class="${cls.trim()}">${escapeHtml(s)}</span>`;
    })
    .join("")}</div>`;
}

function stageCell(row) {
  const stage = (row.Stage || "").trim();
  const picked = state.filters.stages || [];
  if (picked.length && picked.includes(stage)) {
    return `<span class="stage-picked">${escapeHtml(stage)}</span>`;
  }
  return escapeHtml(stage);
}

/** "a@ku.dk" or "Nørre: a@ku.dk | Søndre: b@ku.dk" -> [{ label, address }]. */
function kuContacts(row) {
  return (row["KU contact email"] || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.lastIndexOf(":");
      if (at === -1) return { label: "", address: part };
      return { label: part.slice(0, at).trim(), address: part.slice(at + 1).trim() };
    });
}

function mailLink(contact, useLabel) {
  const text = useLabel && contact.label ? contact.label : contact.address;
  return `<a href="mailto:${escapeHtml(contact.address)}" class="ku-mail"
     title="${escapeHtml(contact.address)}">${escapeHtml(text)}</a>`;
}

function kuUnitBadge(unit) {
  const u = (unit || "").trim();
  if (/^lighthouse$/i.test(u)) {
    return `<span class="pill pill-lighthouse">${escapeHtml(u)}</span>`;
  }
  if (/^pre-?award$/i.test(u)) {
    return `<span class="pill pill-preaward">${escapeHtml(u)}</span>`;
  }
  return escapeHtml(u);
}

const LIGHTHOUSE_EMAIL = "lighthouse@ku.dk";
const POC_EMAIL = "POC@adm.ku.dk";

function lighthouseBadgeHtml() {
  return `<a href="mailto:${LIGHTHOUSE_EMAIL}" class="ku-mail pill pill-lighthouse" title="${LIGHTHOUSE_EMAIL}">Lighthouse</a>`;
}

/** Compact KU line: Lighthouse pill → lighthouse@ku.dk; Preaward → campus links. */
function kuSupportHtml(row) {
  const unit = (row["KU support unit"] || "").trim();
  const parts = [];

  if (/^lighthouse$/i.test(unit)) {
    parts.push(lighthouseBadgeHtml());
  } else {
    parts.push(kuUnitBadge(unit));
  }

  if (row["KU faculty focus"]) {
    parts.push(`<span class="ku-faculty">${escapeHtml(row["KU faculty focus"])}</span>`);
  }

  if (/^pre-?award$/i.test(unit)) {
    const contacts = kuContacts(row);
    const useLabel = contacts.length > 1;
    contacts.forEach((c) => parts.push(mailLink(c, useLabel)));
  }

  return parts.join(" · ");
}

function whoToAskContent(row) {
  const hint = (row["KU contact hint"] || "").trim();
  const email = (row["KU contact email"] || "").trim().toLowerCase();
  const unit = (row["KU support unit"] || "").trim();

  if (/^lighthouse$/i.test(unit) && email === POC_EMAIL.toLowerCase()) {
    return { kind: "poc" };
  }

  if (!hint || /^(ku lighthouse|preaward rso)\.?$/i.test(hint)) {
    return null;
  }

  if (/^lighthouse$/i.test(unit) && /poc@adm\.ku\.dk/i.test(hint)) {
    return { kind: "poc" };
  }

  return { kind: "hint", text: hint };
}

function whoToAskHtml(row) {
  const content = whoToAskContent(row);
  if (!content) return "";
  if (content.kind === "poc") {
    return mailLink({ label: "", address: POC_EMAIL }, false);
  }
  return escapeHtml(content.text);
}

function rowExtraHtml(row) {
  const blocks = [];
  if (row.Deadline) {
    blocks.push(`<div><h4>Deadline</h4><p>${escapeHtml(row.Deadline)}</p></div>`);
  }
  const who = whoToAskHtml(row);
  if (who) {
    blocks.push(`<div><h4>Who to ask</h4><p>${who}</p></div>`);
  }
  const funding = (row["Funding Amount"] || "").trim();
  const lead = isSignificantFunding(funding) ? funding : "";
  if (funding && !lead) {
    blocks.push(`<div><h4>Funding</h4><p>${escapeHtml(funding)}</p></div>`);
  }
  if (!blocks.length) return "";
  const cols = Math.min(blocks.length, 3);
  return `<div class="row-extra"><div class="row-extra-grid cols-${cols}">${blocks.join("")}</div></div>`;
}

function metaStackHtml(row, criteria) {
  const segments = segmentChips(row);
  return `
    <div class="meta-stack">
      <div class="meta-stack-item">
        <span class="meta-stack-label">Opportunity</span>
        <span>${escapeHtml(row.Opportunity || "—")}</span>
      </div>
      <div class="meta-stack-item">
        <span class="meta-stack-label">Industry segment</span>
        ${segments || "<span>—</span>"}
      </div>
      <div class="meta-stack-item">
        <span class="meta-stack-label">Stage</span>
        <span>${stageCell(row)}</span>
      </div>
      <div class="meta-stack-item">
        <span class="meta-stack-label">Criteria</span>
        <span>${escapeHtml(criteria || "—")}</span>
      </div>
    </div>`;
}

function rowHtml(row, idx) {
  const id = String(idx);
  const open = state.expanded.has(id);

  const funding = (row["Funding Amount"] || "").trim();
  const quick = dedupeCopy(row["Quick info"] || "");
  const criteria = dedupeCopy(row.Criteria || "");
  const lead = isSignificantFunding(funding) ? funding : "";
  const body = quick || (lead ? "" : funding || "—");

  const geo = (row.Geography || "").trim();
  const tags = cvrTags(row);

  const kuLine = hasKuSupport(row)
    ? `<p class="ku-line">KU support: ${kuSupportHtml(row)}</p>`
    : "";

  const hasExtra =
    Boolean(row.Deadline) ||
    hasKuSupport(row) ||
    Boolean(whoToAskContent(row)) ||
    (funding && !lead);
  const showMore = !open && (body.length > 90 || hasExtra);

  return `
    <tr class="${open ? "is-open" : ""}" data-row="${id}">
      <td class="name-cell">
        <div class="name-row">
          <button type="button" class="caret" data-toggle="${id}"
                  aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} details">▶</button>
          <span>${
            row.Link
              ? `<a href="${escapeHtml(row.Link)}" target="_blank" rel="noopener">${escapeHtml(row.Name)}</a>`
              : escapeHtml(row.Name)
          }</span>
        </div>
        <p class="name-sub">
          ${geo ? `<span class="geo">${escapeHtml(geo)}</span>` : ""}
          ${tags
            .map((t) => `<span class="pill ${t.cls}">${escapeHtml(t.text)}</span>`)
            .join("")}
        </p>
      </td>
      ${
        open
          ? `<td class="expand-split-cell" colspan="5">
        <div class="expand-split">
          <div class="expand-stack">${metaStackHtml(row, criteria)}</div>
          <div class="expand-info">
            ${lead ? `<p class="funding-lead">${escapeHtml(lead)}</p>` : ""}
            <p class="info-text">${escapeHtml(body)}</p>
            ${rowExtraHtml(row)}
            ${kuLine}
          </div>
        </div>
      </td>`
          : `<td class="opportunity-cell">${escapeHtml(row.Opportunity || "")}</td>
      <td class="segment-cell">${segmentChips(row)}</td>
      <td class="criteria-cell">${escapeHtml(criteria || "—")}</td>
      <td class="stage-cell">${stageCell(row)}</td>
      <td class="info-cell">
        ${lead ? `<p class="funding-lead">${escapeHtml(lead)}</p>` : ""}
        <p class="info-text clamped">${escapeHtml(body)}</p>
        ${kuLine}
        ${showMore ? `<p class="read-more">Show more</p>` : ""}
      </td>`
      }
    </tr>
  `;
}

function sorted(rows) {
  const { key, dir } = state.sort;
  if (key) {
    return [...rows].sort((a, b) =>
      String(a[key] || "").localeCompare(String(b[key] || ""), "en", {
        sensitivity: "base",
      }) * dir
    );
  }
  // Unsorted view: show the stages actually asked for before the always-on
  // "All stages" entries, so those don't bury the real matches.
  const picked = state.filters.stages || [];
  if (!picked.length) return rows;
  return [...rows].sort(
    (a, b) => Number(picked.includes(b.Stage)) - Number(picked.includes(a.Stage))
  );
}

function paint() {
  const matched = sorted(filterProgrammes(state.all, state.filters));
  const body = document.getElementById("results-body");
  const empty = document.getElementById("empty");

  body.innerHTML = matched.map(rowHtml).join("");
  empty.classList.toggle("hidden", matched.length > 0);
  document.getElementById("result-count").textContent =
    `${matched.length} of ${state.all.length} results`;

  function toggleRow(id) {
    if (state.expanded.has(id)) state.expanded.delete(id);
    else state.expanded.add(id);
    paint();
  }

  body.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleRow(btn.dataset.toggle);
    });
  });

  body.querySelectorAll("tbody tr").forEach((tr) => {
    tr.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      const btn = tr.querySelector("[data-toggle]");
      if (btn) toggleRow(btn.dataset.toggle);
    });
  });
}

async function init() {
  state.all = await loadProgrammes();

  const q = document.getElementById("q");
  q.value = state.filters.query || "";
  q.addEventListener("input", () => {
    state.filters.query = q.value.trim();
    state.expanded.clear();
    paint();
  });

  document.querySelectorAll(".seg button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filters.cvr = btn.dataset.cvr;
      document
        .querySelectorAll(".seg button")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      state.expanded.clear();
      paint();
    });
  });

  document.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      state.sort =
        state.sort.key === key
          ? { key, dir: -state.sort.dir }
          : { key, dir: 1 };
      document
        .querySelectorAll("th.sortable")
        .forEach((other) => other.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", state.sort.dir === 1 ? "ascending" : "descending");
      state.expanded.clear();
      paint();
    });
  });

  paint();
}

init().catch((err) => {
  console.error(err);
  const el = document.getElementById("result-count");
  el.classList.add("load-error");
  el.textContent = "Could not load programme data. Please reload the page.";
});
