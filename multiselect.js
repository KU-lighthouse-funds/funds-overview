import { escapeHtml } from "./shared.js";

/**
 * Dropdown multi-select: a closed toggle plus a panel of checkable options,
 * each option optionally carrying a one-line explanation.
 */
export function createMultiSelect(root, { options, placeholder, onChange }) {
  const selected = new Set();

  root.innerHTML = `
    <button type="button" class="ms-toggle" aria-expanded="false" aria-haspopup="listbox">
      <span class="ms-label placeholder">${escapeHtml(placeholder)}</span>
      <svg class="ms-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <div class="ms-panel" role="listbox" aria-multiselectable="true" hidden>
      ${options
        .map(
          (o) => `
        <button type="button" class="ms-option" role="option" aria-selected="false"
                data-value="${escapeHtml(o.value)}">
          <span class="ms-check" aria-hidden="true">✓</span>
          <span>
            <span class="ms-opt-name">${escapeHtml(o.label)}</span>
            ${o.desc ? `<span class="ms-opt-desc">${escapeHtml(o.desc)}</span>` : ""}
          </span>
        </button>`
        )
        .join("")}
    </div>
  `;

  const toggle = root.querySelector(".ms-toggle");
  const panel = root.querySelector(".ms-panel");
  const label = root.querySelector(".ms-label");

  function renderLabel() {
    if (selected.size === 0) {
      label.textContent = placeholder;
      label.classList.add("placeholder");
      return;
    }
    label.classList.remove("placeholder");
    const picked = [...selected];
    label.textContent =
      picked.length <= 2 ? picked.join(", ") : `${picked.length} selected`;
  }

  function syncOptions() {
    panel.querySelectorAll(".ms-option").forEach((opt) => {
      opt.setAttribute("aria-selected", String(selected.has(opt.dataset.value)));
    });
    renderLabel();
  }

  function setValues(values) {
    selected.clear();
    (values || []).forEach((v) => selected.add(v));
    syncOptions();
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", () => setOpen(panel.hidden));

  panel.addEventListener("click", (event) => {
    const opt = event.target.closest(".ms-option");
    if (!opt) return;
    const value = opt.dataset.value;
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    opt.setAttribute("aria-selected", String(selected.has(value)));
    renderLabel();
    onChange?.([...selected]);
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  return { values: () => [...selected], setValues };
}

/**
 * Column-header filter: every value starts visible; uncheck to hide rows.
 * Options can be updated dynamically via setOptions().
 * Returns null when all are checked (= no filter).
 */
export function createColumnFilter(root, { options: initialOptions, label, onChange }) {
  let options = [...initialOptions];
  const visible = new Set(options.map((o) => o.value));

  root.innerHTML = `
    <button type="button" class="col-filter-toggle" aria-expanded="false"
            aria-haspopup="listbox" aria-label="Filter ${escapeHtml(label)}">
      <svg class="col-filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      <span class="col-filter-dot" hidden aria-hidden="true"></span>
    </button>
    <div class="col-filter-panel" role="listbox" aria-multiselectable="true" hidden>
      <div class="col-filter-actions">
        <button type="button" class="col-filter-action" data-action="all">Select all</button>
        <button type="button" class="col-filter-action" data-action="none">Unselect all</button>
      </div>
      <div class="col-filter-options"></div>
    </div>
  `;

  const toggle = root.querySelector(".col-filter-toggle");
  const panel = root.querySelector(".col-filter-panel");
  const optionsEl = root.querySelector(".col-filter-options");
  const dot = root.querySelector(".col-filter-dot");

  function renderOptionsList() {
    if (!options.length) {
      optionsEl.innerHTML = `<p class="col-filter-empty">None in current results</p>`;
      return;
    }
    optionsEl.innerHTML = options
      .map(
        (o) => `
        <label class="col-filter-option">
          <input type="checkbox" checked value="${escapeHtml(o.value)}" />
          <span class="col-filter-label">${escapeHtml(o.label)}</span>
        </label>`
      )
      .join("");
  }

  function syncCheckboxes() {
    panel.querySelectorAll('.col-filter-option input[type="checkbox"]').forEach((input) => {
      input.checked = visible.has(input.value);
    });
    dot.hidden = visible.size >= options.length;
  }

  function emit() {
    onChange?.(visible.size >= options.length ? null : [...visible]);
  }

  function positionPanel() {
    const rect = toggle.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    panel.style.position = "fixed";
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.bottom + 4}px`;
    panel.style.minWidth = `${Math.max(rect.width, 176)}px`;
    panel.style.maxHeight = `${Math.max(120, Math.min(256, spaceBelow))}px`;
    panel.style.zIndex = "200";
  }

  function dockPanel() {
    panel.style.position = "";
    panel.style.left = "";
    panel.style.top = "";
    panel.style.minWidth = "";
    panel.style.maxHeight = "";
    panel.style.zIndex = "";
    panel.classList.remove("is-floating");
    root.appendChild(panel);
  }

  function onViewportChange() {
    if (panel.hidden) return;
    positionPanel();
  }

  function setOpen(open) {
    if (open) {
      panel.classList.add("is-floating");
      document.body.appendChild(panel);
      positionPanel();
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      window.addEventListener("scroll", onViewportChange, true);
      window.addEventListener("resize", onViewportChange);
    } else {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      dockPanel();
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    }
  }

  function setVisible(values) {
    visible.clear();
    if (!values?.length) {
      options.forEach((o) => visible.add(o.value));
    } else {
      values.forEach((v) => visible.add(v));
    }
    syncCheckboxes();
  }

  function setOptions(nextOptions, { silent = false } = {}) {
    const oldValues = new Set(options.map((o) => o.value));
    const next = [...nextOptions];
    const nextValues = new Set(next.map((o) => o.value));

    for (const value of visible) {
      if (!nextValues.has(value)) visible.delete(value);
    }
    for (const o of next) {
      if (!oldValues.has(o.value)) visible.add(o.value);
    }

    options = next;
    renderOptionsList();
    syncCheckboxes();
    if (!silent) emit();
  }

  function selectAll() {
    options.forEach((o) => visible.add(o.value));
    syncCheckboxes();
    emit();
  }

  function unselectAll() {
    visible.clear();
    syncCheckboxes();
    emit();
  }

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(panel.hidden);
  });

  panel.addEventListener("click", (event) => {
    event.stopPropagation();
    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "all") selectAll();
    else if (action.dataset.action === "none") unselectAll();
  });

  panel.addEventListener("change", (event) => {
    const input = event.target;
    if (input.type !== "checkbox") return;
    if (input.checked) visible.add(input.value);
    else visible.delete(input.value);
    dot.hidden = visible.size >= options.length;
    emit();
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target) && !panel.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  renderOptionsList();
  syncCheckboxes();

  return {
    values: () => (visible.size >= options.length ? null : [...visible]),
    setVisible,
    setOptions,
  };
}
