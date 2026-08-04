import {
  loadProgrammes,
  filtersFromUrl,
  filterProgrammes,
  parseSegments,
  isSignificantFunding,
  hasKuSupport,
  escapeHtml,
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
  if (atApplication === "No") tags.push({ text: "Pre-company", cls: "" });
  if (atApplication === "Yes") tags.push({ text: "CVR required", cls: "has" });
  if (atApplication !== "Yes" && atStart === "Yes") {
    tags.push({ text: "CVR by start", cls: "has" });
  }
  return tags;
}

function segmentChips(row) {
  const segs = parseSegments(row);
  if (!segs.length) return "";
  return `<div class="chips">${segs
    .map(
      (s) =>
        `<span class="chip${s.toLowerCase() === "general" ? " general" : ""}">${escapeHtml(s)}</span>`
    )
    .join("")}</div>`;
}

function kuSupportHtml(row) {
  const parts = [escapeHtml(row["KU support unit"])];
  if (row["KU faculty focus"]) parts.push(escapeHtml(row["KU faculty focus"]));
  const email = (row["KU contact email"] || "").trim();
  if (email) {
    parts.push(
      `<a href="mailto:${escapeHtml(email)}" class="ku-mail">${escapeHtml(email)}</a>`
    );
  }
  return parts.join(" · ");
}

function rowHtml(row, idx) {
  const id = String(idx);
  const open = state.expanded.has(id);

  const funding = (row["Funding Amount"] || "").trim();
  const quick = (row["Quick info"] || "").trim();
  const lead = isSignificantFunding(funding) ? funding : "";
  const body = quick || (lead ? "" : funding || "—");

  const geo = (row.Geography || "").trim();
  const tags = cvrTags(row);

  const kuLine = hasKuSupport(row)
    ? `<p class="ku-line"><span class="ku-dot"></span>KU support: ${kuSupportHtml(row)}</p>`
    : "";

  const main = `
    <tr class="${open ? "is-open" : ""}">
      <td class="name-cell">
        <div class="name-row">
          <button type="button" class="caret" data-toggle="${id}"
                  aria-expanded="${open}" aria-label="Toggle details">▶</button>
          <span>${
            row.Link
              ? `<a href="${escapeHtml(row.Link)}" target="_blank" rel="noopener">${escapeHtml(row.Name)}</a>`
              : escapeHtml(row.Name)
          }</span>
        </div>
        <p class="name-sub">
          ${geo ? `<span>${escapeHtml(geo)}</span>` : ""}
          ${tags
            .map((t) => `<span class="cvr-tag ${t.cls}">${escapeHtml(t.text)}</span>`)
            .join("")}
        </p>
      </td>
      <td>${escapeHtml(row.Opportunity || "")}</td>
      <td>${segmentChips(row)}</td>
      <td class="criteria-cell">
        <span class="${open ? "" : "clamped"}">${escapeHtml(row.Criteria || "—")}</span>
        ${open ? "" : `<p class="read-more">Click to read more</p>`}
      </td>
      <td class="stage-cell">${escapeHtml(row.Stage || "")}</td>
      <td class="info-cell">
        ${lead ? `<p class="funding-lead">${escapeHtml(lead)}</p>` : ""}
        <p class="info-text ${open ? "" : "clamped"}">${escapeHtml(body)}</p>
        ${kuLine}
      </td>
    </tr>
  `;

  if (!open) return main;

  const cells = [];
  if (row.Deadline) {
    cells.push(`<div><h4>Deadline</h4><p>${escapeHtml(row.Deadline)}</p></div>`);
  }
  if (hasKuSupport(row)) {
    cells.push(`<div><h4>KU support</h4><p>${kuSupportHtml(row)}</p></div>`);
  }
  // Hints that only name the unit again add nothing next to the KU support cell.
  const hint = (row["KU contact hint"] || "").trim();
  if (hint && !/^(ku lighthouse|preaward rso)\.?$/i.test(hint)) {
    cells.push(`<div><h4>Who to ask</h4><p>${escapeHtml(hint)}</p></div>`);
  }
  if (funding && !lead) {
    cells.push(`<div><h4>Funding</h4><p>${escapeHtml(funding)}</p></div>`);
  }

  return `${main}
    <tr class="detail-row">
      <td colspan="6">
        <div class="detail-grid">${cells.join("")}</div>
      </td>
    </tr>`;
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

  body.querySelectorAll("tr:not(.detail-row)").forEach((tr) => {
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
