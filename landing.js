import { loadProgrammes, countMatches, SEGMENT_OPTIONS, STAGE_OPTIONS } from "./shared.js";
import { createMultiSelect } from "./multiselect.js";

async function init() {
  const programmes = await loadProgrammes();

  const countEl = document.getElementById("match-count");
  const state = { stages: [], segments: [], query: "", cvr: "all" };

  function updateCount() {
    const n = countMatches(programmes, state);
    countEl.textContent = `${n} match${n === 1 ? "" : "es"} so far`;
  }

  const stageMs = createMultiSelect(document.getElementById("ms-stage"), {
    options: STAGE_OPTIONS,
    placeholder: document.getElementById("ms-stage").dataset.placeholder,
    onChange: (values) => {
      state.stages = values;
      updateCount();
    },
  });

  const segmentMs = createMultiSelect(document.getElementById("ms-segment"), {
    options: SEGMENT_OPTIONS,
    placeholder: document.getElementById("ms-segment").dataset.placeholder,
    onChange: (values) => {
      state.segments = values;
      updateCount();
    },
  });

  updateCount();

  document.getElementById("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    stageMs.values().forEach((v) => params.append("stage", v));
    segmentMs.values().forEach((v) => params.append("segment", v));
    window.location.href = `results.html?${params.toString()}`;
  });
}

init().catch((err) => {
  console.error(err);
  const el = document.getElementById("match-count");
  el.classList.add("load-error");
  el.textContent = window.location.protocol === "file:"
    ? "Open the site over http (or use the published link) — browsers block data files on file://."
    : "Could not load programme data. Please reload the page.";
});
