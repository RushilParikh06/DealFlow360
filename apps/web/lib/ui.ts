import { showBanner } from "./dom";

/** Keyboard behavior shared by the HTML screens; business actions stay in live.ts. */
export function wireAccessibility(root: HTMLElement): () => void {
  const main = root.querySelector("main");
  if (main && !root.querySelector(".df-skip-link")) {
    main.id = "main-content";
    main.tabIndex = -1;
    const skip = document.createElement("a");
    skip.href = "#main-content";
    skip.className = "df-skip-link";
    skip.textContent = "Skip to content";
    root.prepend(skip);
  }

  for (const icon of root.querySelectorAll(".material-symbols-outlined")) icon.setAttribute("aria-hidden", "true");
  for (const th of root.querySelectorAll("thead th")) th.setAttribute("scope", "col");
  for (const region of root.querySelectorAll<HTMLElement>(".overflow-x-auto:has(table)")) {
    region.tabIndex = 0;
    region.setAttribute("role", "region");
    region.setAttribute("aria-label", "Scrollable data table");
  }

  const cleanups: (() => void)[] = [];
  const selectRows = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.matches('input[type="checkbox"]')) return;
    const table = input.closest("table");
    const all = table?.querySelector<HTMLInputElement>('thead input[type="checkbox"]');
    if (!all || !table) return;
    const rows = [...table.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')];
    if (input === all) rows.forEach(row => { row.checked = all.checked; });
    all.checked = rows.length > 0 && rows.every(row => row.checked);
    all.indeterminate = rows.some(row => row.checked) && !all.checked;
  };
  root.addEventListener("change", selectRows);
  cleanups.push(() => root.removeEventListener("change", selectRows));
  const unavailable = (event: Event) => {
    const control = (event.target as Element).closest<HTMLElement>("[data-unavailable]");
    if (!control) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showBanner(root, control.dataset.unavailable || "This action is not connected yet.", "info");
    root.querySelector("[data-df-banner]")?.scrollIntoView({ block: "nearest" });
  };
  root.addEventListener("click", unavailable, true);
  root.addEventListener("submit", unavailable, true);
  cleanups.push(() => {
    root.removeEventListener("click", unavailable, true);
    root.removeEventListener("submit", unavailable, true);
  });
  for (const dialog of root.querySelectorAll<HTMLElement>('[id].fixed.inset-0')) {
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    const heading = dialog.querySelector("h2, h3");
    dialog.setAttribute("aria-label", heading?.textContent?.trim() || "Review details");
    let previous: HTMLElement | null = null;
    let active = false;
    let siblings: [HTMLElement, boolean][] = [];
    const sync = () => {
      const open = !dialog.classList.contains("hidden");
      if (open === active) return;
      active = open;
      if (open) {
        previous = document.activeElement as HTMLElement;
        for (let node: HTMLElement | null = dialog; node && node !== root; node = node.parentElement) {
          for (const sibling of node.parentElement?.children ?? []) {
            if (sibling === node || !(sibling instanceof HTMLElement)) continue;
            siblings.push([sibling, sibling.inert]);
            sibling.inert = true;
          }
        }
        document.body.style.overflow = "hidden";
        (dialog.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea') ?? dialog).focus();
      } else {
        siblings.forEach(([node, inert]) => { node.inert = inert; });
        siblings = [];
        document.body.style.overflow = "";
        previous?.focus();
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dialog.classList.add("hidden"); sync(); }
      if (event.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = controls[0] ?? dialog;
      const last = controls.at(-1) ?? dialog;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", keydown);
    const observer = new MutationObserver(sync);
    observer.observe(dialog, { attributes: true, attributeFilter: ["class"] });
    cleanups.push(() => {
      observer.disconnect();
      dialog.removeEventListener("keydown", keydown);
      siblings.forEach(([node, inert]) => { node.inert = inert; });
      if (active) document.body.style.overflow = "";
    });
  }
  return () => cleanups.forEach(cleanup => cleanup());
}
