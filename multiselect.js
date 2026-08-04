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

  return { values: () => [...selected] };
}
