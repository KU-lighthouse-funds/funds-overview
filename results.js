import {
  loadProgrammes,
  peekProgrammesCache,
  onProgrammesUpdated,
  filtersFromUrl,
  filtersToSearchParams,
  filterProgrammes,
  parseSegments,
  parseStages,
  rowMatchesStages,
  isSignificantFunding,
  hasKuSupport,
  deadlineSortKey,
  deadlineLead,
  escapeHtml,
  dedupeCopy,
  debounce,
} from "./shared.js";
import { createColumnFilter } from "./multiselect.js";

const PAGE_SIZE = 25;

function uniqueColumnValues(rows, key) {
  if (key === "Stage") {
    return [...new Set(rows.flatMap((r) => parseStages(r)))].sort((a, b) =>
      a.localeCompare(b, "en", { sensitivity: "base" })
    );
  }
  return [...new Set(rows.map((r) => (r[key] || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  );
}

const state = {
  all: [],
  filters: { ...filtersFromUrl(), opportunityCol: null, stageCol: null },
  sort: { key: null, dir: 1 },
  expanded: new Set(),
  columnFilters: null,
  visibleLimit: PAGE_SIZE,
};

function rowKey(row) {
  return `${(row.Name || "").trim()}\u001f${(row.Link || "").trim()}`;
}

function getMatchedRows() {
  return sorted(filterProgrammes(state.all, state.filters));
}

function pruneExpanded() {
  const keys = new Set(getMatchedRows().map(rowKey));
  for (const key of state.expanded) {
    if (!keys.has(key)) state.expanded.delete(key);
  }
}

function filtersForColumnOptions(excludeKey) {
  return { ...state.filters, [excludeKey]: null };
}

function syncFilterVisible(instance, values) {
  instance.setVisible(values ?? []);
}

function updateColumnFilters() {
  if (!state.columnFilters) return;

  const oppRows = filterProgrammes(state.all, filtersForColumnOptions("opportunityCol"));
  const oppOpts = uniqueColumnValues(oppRows, "Opportunity").map((v) => ({
    value: v,
    label: v,
  }));
  state.columnFilters.opportunity.setOptions(oppOpts, { silent: true });
  state.columnFilters.opportunityMobile.setOptions(oppOpts, { silent: true });
  syncFilterVisible(state.columnFilters.opportunity, state.filters.opportunityCol);
  syncFilterVisible(state.columnFilters.opportunityMobile, state.filters.opportunityCol);

  const stageRows = filterProgrammes(state.all, filtersForColumnOptions("stageCol"));
  const stageOpts = uniqueColumnValues(stageRows, "Stage").map((v) => ({
    value: v,
    label: v,
  }));
  state.columnFilters.stage.setOptions(stageOpts, { silent: true });
  state.columnFilters.stageMobile.setOptions(stageOpts, { silent: true });
  syncFilterVisible(state.columnFilters.stage, state.filters.stageCol);
  syncFilterVisible(state.columnFilters.stageMobile, state.filters.stageCol);
}

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
  const stages = parseStages(row);
  const picked = state.filters.stages || [];
  if (!stages.length) return "—";
  if (stages.length === 1) {
    const stage = stages[0];
    if (picked.length && picked.includes(stage)) {
      return `<span class="stage-picked">${escapeHtml(stage)}</span>`;
    }
    return escapeHtml(stage);
  }
  return `<div class="chips">${stages
    .map((s) => {
      const cls = picked.includes(s) ? " chip picked stage-chip" : " chip stage-chip";
      return `<span class="${cls.trim()}">${escapeHtml(s)}</span>`;
    })
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

const LIGHTHOUSE_EMAIL = "lighthouse@ku.dk";
const POC_EMAIL = "POC@adm.ku.dk";

/** Compact KU line: unit badge, then · linked address(es) — same pattern for Lighthouse and Preaward. */
function kuSupportHtml(row) {
  const unit = (row["KU support unit"] || "").trim();
  const parts = [kuUnitBadge(unit)];

  if (row["KU faculty focus"] && !/^pre-?award$/i.test(unit)) {
    parts.push(`<span class="ku-faculty">${escapeHtml(row["KU faculty focus"])}</span>`);
  }

  if (/^lighthouse$/i.test(unit)) {
    parts.push(mailLink({ label: "", address: LIGHTHOUSE_EMAIL }, false));
  } else if (/^pre-?award$/i.test(unit)) {
    const contacts = kuContacts(row);
    const useLabel = contacts.length > 1;
    contacts.forEach((c) => parts.push(mailLink(c, useLabel)));
  }

  return parts.join(" · ");
}

function kuSupportMobileHtml(row) {
  if (!hasKuSupport(row)) return "";
  const unit = (row["KU support unit"] || "").trim();
  return `<span class="mobile-card-ku-label">KU support</span> ${kuUnitBadge(unit)}`;
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

function fundContactHtml(row) {
  const raw = (row["Fund contact email"] || "").trim();
  if (!raw) return "";
  const parts = raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts
    .map((part) => {
      const at = part.lastIndexOf(":");
      if (at === -1) {
        return mailLink({ label: "", address: part }, false);
      }
      const label = part.slice(0, at).trim();
      const address = part.slice(at + 1).trim();
      return mailLink({ label, address }, Boolean(label));
    })
    .join(" · ");
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
  const fund = fundContactHtml(row);
  if (fund) {
    blocks.push(`<div><h4>Fund contact</h4><p>${fund}</p></div>`);
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

function metaStackMobileHtml(row, criteria) {
  const segments = segmentChips(row);
  return `
    <div class="mobile-expand-meta">
      <div class="mobile-expand-meta-row">
        <div class="mobile-expand-meta-stack">
          <div class="meta-stack-item">
            <span class="meta-stack-label">Opportunity</span>
            <span>${escapeHtml(row.Opportunity || "—")}</span>
          </div>
          <div class="meta-stack-item">
            <span class="meta-stack-label">Stage</span>
            <span>${stageCell(row)}</span>
          </div>
        </div>
        <div class="mobile-expand-segments">
          <span class="meta-stack-label">Industry segment</span>
          ${segments || "<span>—</span>"}
        </div>
      </div>
      <div class="meta-stack-item mobile-expand-criteria">
        <span class="meta-stack-label">Criteria</span>
        <span>${escapeHtml(criteria || "—")}</span>
      </div>
    </div>`;
}

function mobileCardHtml(row, { criteria, lead, deadlineLine, body, showMore }) {
  const infoHeadline = lead || deadlineLine || "";
  const kuMobile = kuSupportMobileHtml(row);

  return `
    <div class="mobile-card">
      <div class="mobile-card-duo">
        <div class="mobile-card-field">
          <span class="mobile-card-label">Opportunity</span>
          <p class="mobile-card-clamp">${escapeHtml(row.Opportunity || "—")}</p>
          ${kuMobile ? `<p class="mobile-card-ku">${kuMobile}</p>` : ""}
        </div>
        <div class="mobile-card-field">
          <span class="mobile-card-label">Criteria</span>
          <p class="mobile-card-clamp">${escapeHtml(criteria || "—")}</p>
        </div>
      </div>
      <div class="mobile-card-block mobile-card-info">
        ${infoHeadline ? `<p class="mobile-card-headline">${escapeHtml(infoHeadline)}</p>` : ""}
        ${body ? `<p class="mobile-card-clamp">${escapeHtml(body)}</p>` : ""}
        ${showMore ? `<p class="read-more">Show more</p>` : ""}
      </div>
    </div>`;
}

function rowHtml(row, idx) {
  const id = String(idx);
  const open = state.expanded.has(rowKey(row));

  const funding = (row["Funding Amount"] || "").trim();
  const quick = dedupeCopy(row["Quick info"] || "");
  const criteria = dedupeCopy(row.Criteria || "");
  const lead = isSignificantFunding(funding) ? funding : "";
  const body = quick || (lead ? "" : funding || "—");
  const deadlineLine = deadlineLead(row.Deadline);

  const geo = (row.Geography || "").trim();
  const tags = cvrTags(row);

  const kuLine = hasKuSupport(row)
    ? `<p class="ku-line">KU support: ${kuSupportHtml(row)}</p>`
    : "";

  const hasExtra =
    Boolean(row.Deadline) ||
    hasKuSupport(row) ||
    Boolean(whoToAskContent(row)) ||
    Boolean((row["Fund contact email"] || "").trim()) ||
    (funding && !lead);
  const showMore = !open && (body.length > 90 || hasExtra);

  return `
    <tr class="${open ? "is-open" : ""}" data-row="${id}">
      <td class="name-cell">
        <div class="name-row">
          <button type="button" class="caret" data-toggle="${id}"
                  aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} details">▶</button>
          ${
            row.Link
              ? `<div class="name-main">
                  <a href="${escapeHtml(row.Link)}" class="name-link">${escapeHtml(row.Name)}</a>
                  <a href="${escapeHtml(row.Link)}" class="name-outlink" target="_blank" rel="noopener"
                     aria-label="${escapeHtml(row.Name)} — opens in new tab">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>`
              : `<span class="name-plain">${escapeHtml(row.Name)}</span>`
          }
        </div>
        <p class="name-sub">
          ${geo ? `<span class="geo">${escapeHtml(geo)}</span>` : ""}
          ${tags
            .map((t) => `<span class="pill ${t.cls}">${escapeHtml(t.text)}</span>`)
            .join("")}
        </p>
        ${!open ? mobileCardHtml(row, { criteria, lead, deadlineLine, body, showMore }) : ""}
      </td>
      ${
        open
          ? `<td class="expand-split-cell" colspan="5">
        <div class="expand-split">
          <div class="expand-stack">
            <div class="expand-meta-desktop">${metaStackHtml(row, criteria)}</div>
            <div class="expand-meta-mobile">${metaStackMobileHtml(row, criteria)}</div>
          </div>
          <div class="expand-info">
            ${lead ? `<p class="funding-lead">${escapeHtml(lead)}</p>` : ""}
            ${deadlineLine ? `<p class="deadline-lead">${escapeHtml(deadlineLine)}</p>` : ""}
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
        ${deadlineLine ? `<p class="deadline-lead">${escapeHtml(deadlineLine)}</p>` : ""}
        <p class="info-text clamped">${escapeHtml(body)}</p>
        ${kuLine}
        ${showMore ? `<p class="read-more">Show more</p>` : ""}
      </td>`
      }
    </tr>
  `;
}

function defaultSortCompare(a, b, pickedStages) {
  const kuA = hasKuSupport(a) ? 0 : 1;
  const kuB = hasKuSupport(b) ? 0 : 1;
  if (kuA !== kuB) return kuA - kuB;

  if (kuA === 0) {
    if (pickedStages.length) {
      const stageA = parseStages(a).some((s) => pickedStages.includes(s)) ? 0 : 1;
      const stageB = parseStages(b).some((s) => pickedStages.includes(s)) ? 0 : 1;
      if (stageA !== stageB) return stageA - stageB;
    }
    return String(a.Name || "").localeCompare(String(b.Name || ""), "en", {
      sensitivity: "base",
    });
  }

  const da = deadlineSortKey(a.Deadline);
  const db = deadlineSortKey(b.Deadline);
  const datedA = da != null ? 0 : 1;
  const datedB = db != null ? 0 : 1;
  if (datedA !== datedB) return datedA - datedB;
  if (da != null && db != null && da !== db) return da - db;

  if (pickedStages.length) {
    const stageA = parseStages(a).some((s) => pickedStages.includes(s)) ? 0 : 1;
    const stageB = parseStages(b).some((s) => pickedStages.includes(s)) ? 0 : 1;
    if (stageA !== stageB) return stageA - stageB;
  }

  return String(a.Name || "").localeCompare(String(b.Name || ""), "en", {
    sensitivity: "base",
  });
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

  const picked = state.filters.stages || [];
  return [...rows].sort((a, b) => defaultSortCompare(a, b, picked));
}

function updateSortUi() {
  const reset = document.getElementById("sort-reset");
  const usingCustom = Boolean(state.sort.key);
  reset.hidden = !usingCustom;
}

function resetSort() {
  state.sort = { key: null, dir: 1 };
  state.expanded.clear();
  state.visibleLimit = PAGE_SIZE;
  document.querySelectorAll("th.sortable").forEach((th) => th.removeAttribute("aria-sort"));
  updateSortUi();
  paint();
}

function syncUrl() {
  const qs = filtersToSearchParams(state.filters).toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

function applyFiltersAndPaint({ resetExpanded = false, resetPage = true } = {}) {
  if (resetExpanded) state.expanded.clear();
  else pruneExpanded();
  if (resetPage) state.visibleLimit = PAGE_SIZE;
  syncUrl();
  updateColumnFilters();
  paintTable();
}

function replaceRowElement(id, row) {
  const tr = document.querySelector(`tr[data-row="${id}"]`);
  if (!tr) {
    paintTable();
    return;
  }
  const wrapper = document.createElement("tbody");
  wrapper.innerHTML = rowHtml(row, id);
  tr.replaceWith(wrapper.firstElementChild);
}

function toggleRow(id) {
  const matched = getMatchedRows().slice(0, state.visibleLimit);
  const row = matched[Number(id)];
  if (!row) return;

  const key = rowKey(row);
  if (state.expanded.has(key)) state.expanded.delete(key);
  else state.expanded.add(key);
  replaceRowElement(id, row);
}

function tableSkeletonHtml(count = 6) {
  return Array.from({ length: count }, () => `
    <tr class="skeleton-row" aria-hidden="true">
      <td colspan="6">
        <div class="skeleton-block skeleton-block-title"></div>
        <div class="skeleton-block skeleton-block-line"></div>
        <div class="skeleton-block skeleton-block-line short"></div>
      </td>
    </tr>`).join("");
}

function showTableSkeleton() {
  const body = document.getElementById("results-body");
  const wrap = document.getElementById("load-more-wrap");
  body.innerHTML = tableSkeletonHtml();
  wrap?.classList.add("hidden");
  document.getElementById("result-count").classList.add("skeleton-text");
}

function updateLoadMore(total, shown) {
  const wrap = document.getElementById("load-more-wrap");
  const btn = document.getElementById("load-more");
  if (!wrap || !btn) return;

  const remaining = total - shown;
  if (remaining <= 0) {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");
  const step = Math.min(PAGE_SIZE, remaining);
  btn.textContent = `Show ${step} more (${remaining} remaining)`;
}

function updateResultCount(total) {
  const el = document.getElementById("result-count");
  el.classList.remove("skeleton-text");
  const shown = Math.min(state.visibleLimit, total);
  el.textContent =
    shown < total
      ? `${shown} of ${total} shown · ${state.all.length} total`
      : `${total} of ${state.all.length} results`;
}

function paintTable() {
  const matched = getMatchedRows();
  const body = document.getElementById("results-body");
  const empty = document.getElementById("empty");
  const visible = matched.slice(0, state.visibleLimit);
  const html = visible.map((row, idx) => rowHtml(row, idx)).join("");

  const paint = () => {
    body.innerHTML = html;
    empty.classList.toggle("hidden", matched.length > 0);
    updateResultCount(matched.length);
    updateLoadMore(matched.length, visible.length);
    updateSortUi();
  };

  if (html.length > 120_000) {
    requestAnimationFrame(paint);
  } else {
    paint();
  }
}

function paint() {
  paintTable();
  const syncFilters = () => updateColumnFilters();
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(syncFilters, { timeout: 300 });
  } else {
    syncFilters();
  }
}

async function init() {
  onProgrammesUpdated((rows) => {
    state.all = rows;
    paint();
  });

  const cached = peekProgrammesCache();
  if (cached) {
    state.all = cached;
    paint();
  } else {
    document.getElementById("result-count").classList.add("skeleton-text");
  }

  const dataPromise = loadProgrammes();

  state.columnFilters = {
    opportunity: createColumnFilter(document.getElementById("col-filter-opportunity"), {
      label: "Opportunity",
      options: [],
      onChange: (values) => {
        state.filters.opportunityCol = values;
        applyFiltersAndPaint();
      },
    }),
    opportunityMobile: createColumnFilter(
      document.getElementById("col-filter-opportunity-mobile"),
      {
        label: "Opportunity",
        showLabel: true,
        options: [],
        onChange: (values) => {
          state.filters.opportunityCol = values;
          applyFiltersAndPaint();
        },
      }
    ),
    stage: createColumnFilter(document.getElementById("col-filter-stage"), {
      label: "Stage",
      options: [],
      onChange: (values) => {
        state.filters.stageCol = values;
        applyFiltersAndPaint();
      },
    }),
    stageMobile: createColumnFilter(document.getElementById("col-filter-stage-mobile"), {
      label: "Stage",
      showLabel: true,
      options: [],
      onChange: (values) => {
        state.filters.stageCol = values;
        applyFiltersAndPaint();
      },
    }),
  };

  const q = document.getElementById("q");
  q.value = state.filters.query || "";
  q.addEventListener(
    "input",
    debounce(() => {
      state.filters.query = q.value.trim();
      applyFiltersAndPaint({ resetExpanded: false, resetPage: true });
    }, 180)
  );

  document.getElementById("load-more")?.addEventListener("click", () => {
    state.visibleLimit += PAGE_SIZE;
    paintTable();
  });

  document.querySelectorAll(".seg button").forEach((btn) => {
    const active = btn.dataset.cvr === (state.filters.cvr || "all");
    btn.setAttribute("aria-pressed", String(active));
    btn.addEventListener("click", () => {
      state.filters.cvr = btn.dataset.cvr;
      document
        .querySelectorAll(".seg button")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      applyFiltersAndPaint({ resetExpanded: false, resetPage: true });
    });
  });

  document.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", (event) => {
      if (event.target.closest(".col-filter")) return;
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
      state.visibleLimit = PAGE_SIZE;
      paintTable();
    });
  });

  document.getElementById("sort-reset").addEventListener("click", resetSort);

  const body = document.getElementById("results-body");
  body.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;
    const btn = event.target.closest("[data-toggle]");
    if (btn) {
      event.stopPropagation();
      toggleRow(btn.dataset.toggle);
      return;
    }
    const tr = event.target.closest("tr");
    if (!tr) return;
    const rowBtn = tr.querySelector("[data-toggle]");
    if (rowBtn) toggleRow(rowBtn.dataset.toggle);
  });

  updateSortUi();

  try {
    state.all = await dataPromise;
    paint();
  } catch (err) {
    console.error(err);
    const el = document.getElementById("result-count");
    el.classList.remove("skeleton-text");
    el.classList.add("load-error");
    el.textContent = "Could not load programme data. Please reload the page.";
    document.getElementById("results-body").innerHTML = "";
  }
}

init();
