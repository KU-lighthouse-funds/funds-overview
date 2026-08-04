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
  if (!segs.length) return "";
  return `<div class="chips">${segs
    .map(
      (s) =>
        `<span class="chip${s.toLowerCase() === "general" ? " general" : ""}">${escapeHtml(s)}</span>`
    )
    .join("")}</div>`;
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

/** Compact form for the table cell: campus names stand in for long addresses. */
function kuSupportHtml(row) {
  const parts = [kuUnitBadge(row["KU support unit"])];
  if (row["KU faculty focus"]) {
    parts.push(`<span class="ku-faculty">${escapeHtml(row["KU faculty focus"])}</span>`);
  }
  const contacts = kuContacts(row);
  const useLabel = contacts.length > 1;
  contacts.forEach((c) => parts.push(mailLink(c, useLabel)));
  return parts.join(" · ");
}

/** Expanded form: every address written out in full. */
function kuContactBlock(row) {
  const contacts = kuContacts(row);
  if (!contacts.length) return "";
  if (contacts.length === 1) return `<p>${mailLink(contacts[0], false)}</p>`;
  return `<p>Research Funding Support, by campus:</p>
    <ul class="ku-campus">${contacts
      .map((c) => `<li>${escapeHtml(c.label)} — ${mailLink(c, false)}</li>`)
      .join("")}</ul>`;
}

function rowExtraHtml(row) {
  const blocks = [];
  if (row.Deadline) {
    blocks.push(`<div><h4>Deadline</h4><p>${escapeHtml(row.Deadline)}</p></div>`);
  }
  if (hasKuSupport(row)) {
    const faculty = row["KU faculty focus"]
      ? `<span class="ku-faculty"> · ${escapeHtml(row["KU faculty focus"])}</span>`
      : "";
    blocks.push(
      `<div><h4>KU support</h4><p>${kuUnitBadge(row["KU support unit"])}${faculty}</p>${kuContactBlock(row)}</div>`
    );
  }
  const hint = (row["KU contact hint"] || "").trim();
  if (hint && !/^(ku lighthouse|preaward rso)\.?$/i.test(hint)) {
    blocks.push(`<div><h4>Who to ask</h4><p>${escapeHtml(hint)}</p></div>`);
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

  const hint = (row["KU contact hint"] || "").trim();
  const hasExtra =
    Boolean(row.Deadline) ||
    hasKuSupport(row) ||
    (hint && !/^(ku lighthouse|preaward rso)\.?$/i.test(hint)) ||
    (funding && !lead);
  const showMore = !open && (body.length > 90 || hasExtra);

  return `
    <tr class="${open ? "is-open" : ""}">
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
      <td>${escapeHtml(row.Opportunity || "")}</td>
      <td>${segmentChips(row)}</td>
      <td class="criteria-cell">
        <span class="${open ? "" : "clamped"}">${escapeHtml(criteria || "—")}</span>
      </td>
      <td class="stage-cell">${escapeHtml(row.Stage || "")}</td>
      <td class="info-cell">
        ${lead ? `<p class="funding-lead">${escapeHtml(lead)}</p>` : ""}
        <p class="info-text ${open ? "" : "clamped"}">${escapeHtml(body)}</p>
        ${open ? rowExtraHtml(row) : kuLine}
        ${showMore ? `<p class="read-more">Show more</p>` : ""}
      </td>
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
