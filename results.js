import {
  loadProgrammes,
  filtersFromUrl,
  filterProgrammes,
  isSignificantFunding,
  escapeHtml,
} from "./shared.js";

const state = { expanded: new Set() };

function cvrShort(value) {
  const v = (value || "Any").trim();
  if (v === "Yes") return "required";
  if (v === "No") return "pre-company";
  return "any";
}

function hasKuSupport(row) {
  const unit = (row["KU support unit"] || "").trim();
  return unit && unit !== "—" && unit !== "-" && unit !== "–";
}

function renderRow(row, idx) {
  const id = `${row.Name}::${idx}`;
  const open = state.expanded.has(id);
  const funding = (row["Funding Amount"] || "").trim();
  const quick = (row["Quick info"] || "").trim();
  const lead = isSignificantFunding(funding) ? funding : "";
  const body = quick || (lead ? "" : funding || "—");
  const needsClamp = (lead + " " + body).length > 180;

  const geo = (row.Geography || "").trim() || "—";
  const cvrApp = cvrShort(row["CVR at application"]);
  const cvrStart = cvrShort(row["CVR at programme start"]);

  const extra = [];
  if (row.Deadline) {
    extra.push(`<p><strong>Deadline:</strong> ${escapeHtml(row.Deadline)}</p>`);
  }
  if (hasKuSupport(row) && row["KU contact hint"]) {
    extra.push(
      `<p><strong>Who to ask:</strong> ${escapeHtml(row["KU contact hint"])}</p>`
    );
  }

  let kuBlock = "";
  if (hasKuSupport(row)) {
    let ku = escapeHtml(row["KU support unit"]);
    if (row["KU faculty focus"]) {
      ku += ` · ${escapeHtml(row["KU faculty focus"])}`;
    }
    kuBlock = `<p class="ku-inline"><strong>KU partner:</strong> ${ku}</p>`;
  }

  return `
    <tr>
      <td class="name-cell">
        ${
          row.Link
            ? `<a href="${escapeHtml(row.Link)}" target="_blank" rel="noopener">${escapeHtml(row.Name)}</a>`
            : escapeHtml(row.Name)
        }
        <p class="name-meta">${escapeHtml(geo)}</p>
        <p class="name-meta">CVR apply: ${escapeHtml(cvrApp)} · CVR start: ${escapeHtml(cvrStart)}</p>
      </td>
      <td>${escapeHtml(row.Opportunity || "")}</td>
      <td>${escapeHtml(row["Industrial segment"] || "")}</td>
      <td class="criteria-cell">${escapeHtml(row.Criteria || "—")}</td>
      <td>${escapeHtml(row.Stage || "")}</td>
      <td class="info-cell">
        ${lead ? `<p class="funding-lead">${escapeHtml(lead)}</p>` : ""}
        <p class="info-text ${!open && needsClamp ? "clamped" : ""}">${escapeHtml(body)}</p>
        ${kuBlock}
        ${
          needsClamp || extra.length
            ? `<button type="button" class="toggle-more" data-toggle="${escapeHtml(id)}">${
                open ? "Show less" : "Read more…"
              }</button>`
            : ""
        }
        ${open && extra.length ? `<div class="extra">${extra.join("")}</div>` : ""}
      </td>
    </tr>
  `;
}

function summaryText(filters) {
  const bits = [];
  if (filters.stages.length) bits.push(`Stages: ${filters.stages.join(", ")}`);
  if (filters.segments.length) bits.push(`Segments: ${filters.segments.join(", ")}`);
  if (filters.query) bits.push(`Keyword: “${filters.query}”`);
  return bits.length ? bits.join(" · ") : "No filters — showing all programmes";
}

async function init() {
  const programmes = await loadProgrammes();
  const filters = filtersFromUrl();
  const filtered = filterProgrammes(programmes, filters);

  document.getElementById("match-count").textContent =
    `${filtered.length} matching opportunit${filtered.length === 1 ? "y" : "ies"}`;
  document.getElementById("filter-summary").textContent = summaryText(filters);

  const body = document.getElementById("results-body");
  const empty = document.getElementById("empty");

  function paint() {
    body.innerHTML = filtered.map((row, i) => renderRow(row, i)).join("");
    empty.classList.toggle("hidden", filtered.length > 0);
    body.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-toggle");
        if (state.expanded.has(id)) state.expanded.delete(id);
        else state.expanded.add(id);
        paint();
      });
    });
  }

  paint();
}

init().catch((err) => {
  console.error(err);
  document.getElementById("match-count").textContent = "Could not load data.";
});
