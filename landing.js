import {
  loadProgrammes,
  peekProgrammesCache,
  onProgrammesUpdated,
  countMatches,
  SEGMENT_OPTIONS,
  STAGE_OPTIONS,
} from "./shared.js";
import { createMultiSelect } from "./multiselect.js";

let resultsPrefetched = false;

function prefetchResults() {
  if (resultsPrefetched) return;
  resultsPrefetched = true;

  for (const href of ["results.html", "results.js", "shared.js", "multiselect.js"]) {
    const link = document.createElement("link");
    link.rel = href.endsWith(".html") ? "prefetch" : "modulepreload";
    link.href = href;
    document.head.appendChild(link);
  }
}

function init() {
  const countEl = document.getElementById("match-count");
  const searchBtn = document.querySelector(".btn-search");

  const state = { stages: [], segments: [], query: "", cvr: "all" };
  let programmes = null;

  function updateCount() {
    if (!programmes) return;
    countEl.classList.remove("skeleton-text");
    const n = countMatches(programmes, state);
    countEl.textContent = `${n} match${n === 1 ? "" : "es"} so far`;
  }

  const cached = peekProgrammesCache();
  if (cached) {
    programmes = cached;
    updateCount();
  } else {
    countEl.classList.add("skeleton-text");
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

  loadProgrammes()
    .then((rows) => {
      programmes = rows;
      updateCount();
    })
    .catch((err) => {
      console.error(err);
      countEl.classList.remove("skeleton-text");
      countEl.classList.add("load-error");
      countEl.textContent =
        window.location.protocol === "file:"
          ? "Open the site over http (or use the published link) — browsers block data files on file://."
          : "Could not load programme data. Please reload the page.";
    });

  onProgrammesUpdated((rows) => {
    programmes = rows;
    updateCount();
  });

  searchBtn?.addEventListener("mouseenter", prefetchResults, { once: true });
  searchBtn?.addEventListener("focus", prefetchResults, { once: true });

  document.getElementById("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    prefetchResults();
    const params = new URLSearchParams();
    stageMs.values().forEach((v) => params.append("stage", v));
    segmentMs.values().forEach((v) => params.append("segment", v));
    window.location.href = `results.html?${params.toString()}`;
  });
}

init();
