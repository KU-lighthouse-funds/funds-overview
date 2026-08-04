import {
  loadProgrammes,
  parseSegments,
  countMatches,
  readFiltersFromForm,
} from "./shared.js";

async function init() {
  const programmes = await loadProgrammes();
  const segmentSelect = document.getElementById("segment");
  const segments = new Set();
  programmes.forEach((p) => parseSegments(p).forEach((s) => segments.add(s)));
  [...segments]
    .sort((a, b) => a.localeCompare(b))
    .forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      segmentSelect.appendChild(opt);
    });

  const form = document.getElementById("search-form");
  const countEl = document.getElementById("match-count");

  function updateCount() {
    const filters = readFiltersFromForm(form);
    const n = countMatches(programmes, filters);
    countEl.textContent = `${n} matching opportunit${n === 1 ? "y" : "ies"} so far`;
  }

  form.addEventListener("change", updateCount);
  form.addEventListener("input", updateCount);
  updateCount();
}

init().catch((err) => {
  console.error(err);
  document.getElementById("match-count").textContent =
    "Could not load programme data.";
});
