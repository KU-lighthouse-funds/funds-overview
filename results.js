import {
  loadProgrammes,
  filtersFromUrl,
  filterProgrammes,
  isSignificantFunding,
  escapeHtml,
} from "./shared.js";

const state = { expanded: new Set() };

function cvrLabel(value, when) {
  const v = (value || "Any").trim();
  if (v === "Yes") return { text: `CVR ${when}: required`, cls: "yes" };
  if (v === "No") return { text: `CVR ${when}: pre-company`, cls: "no" };
  return { text: `CVR ${when}: any`, cls: "any" };
}

function renderRow(row, idx) {
  const id = `${row.Name}::${idx}`;
  const open = state.expanded.has(id);
  const funding = (row["Funding Amount"] || "").trim();
  const quick = (row["Quick info"] || "").trim();
  const lead = isSignificantFunding(funding) ? funding : "";
  const body = quick || (lead ? "" : "—");
  const needsClamp = (lead + " " + body).length > 180;
  const app = cvrLabel(row["CVR at application"], "apply");
  const start = cvrLabel(row["CVR at programme start"], "start");

  const extra = [];
  if (row.Deadline) {
    extra.push(`<p><strong>Deadline:</strong> ${escapeHtml(row.Deadline)}</p>`);
  }
  if (row["KU support unit"] && row["KU support unit"] !== "—") {
    extra.push(
      `<p><strong>KU support:</strong> ${escapeHtml(row["KU support unit"])}` +
        (row["KU faculty focus"] ? ` · ${escapeHtml(row["KU faculty focus"])}` : "") +
        `</p>`
    );
  }
  if (row["KU contact hint"]) {
    extra.push(`<p><strong>Who to ask:</strong> ${escapeHtml(row["KU contact hint"])}</p>`);
  }

  return `
    <tr>
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
        <p class="info-text ${!open && needsClamp ? "clamped" : ""}">${escapeHtml(body)}</p>
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
