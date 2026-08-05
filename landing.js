import { loadProgrammes, countMatches, SEGMENT_OPTIONS } from "./shared.js";
import { createMultiSelect } from "./multiselect.js";

const STAGE_OPTIONS = [
  {
    value: "Exploratory innovation",
    label: "Exploratory innovation",
    desc: "Pre-proof-of-concept — research, idea exploration, pre-company",
  },
  {
    value: "PoC",
    label: "PoC",
    desc: "Proof-of-concept / validation — testing whether the idea works",
  },
  {
    value: "Early venture",
    label: "Early venture",
    desc: "Company building — pre-seed/seed, first customers, incorporation",
  },
  {
    value: "Growth/scale",
    label: "Growth/scale",
    desc: "Post-seed scale-up — growth funding, pilots at scale, expansion",
  },
];

async function init() {
  const programmes = await loadProgrammes();

  const countEl = document.getElementById("match-count");
  const state = { stages: [], segments: [], query: "", cvr: "all" };

  function updateCount() {
    const n = countMatches(programmes, state);
    countEl.textContent = `${n} matching opportunit${n === 1 ? "y" : "ies"} so far`;
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
