/** Click-to-open info panel (matches Lovable’s stage help, KU flat styling). */
export function bindInfoPopover(root) {
  const trigger = root.querySelector(".info-trigger");
  const panel = root.querySelector(".info-panel");
  if (!trigger || !panel) return;

  function setOpen(open) {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(panel.hidden);
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}
