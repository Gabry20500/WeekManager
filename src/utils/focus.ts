/*
 * The app redraws its whole markup on every change, which would drop the
 * keyboard focus each time. This module remembers which control was focused
 * (by id or data attribute) and puts the focus back on its new copy.
 */

let root: HTMLElement | undefined;
let lastTarget: string | undefined;

/** Selector that identifies a control across redraws, if it has one. */
function selectorOf(element: Element): string | undefined {
  if (element.id) return `#${CSS.escape(element.id)}`;
  for (const attribute of element.attributes) {
    if (attribute.name.startsWith("data-") && attribute.value) {
      return `[${attribute.name}="${CSS.escape(attribute.value)}"]`;
    }
  }
  return undefined;
}

/** Starts remembering the focused control inside `element`. */
export function trackFocus(element: HTMLElement): void {
  root = element;
  element.addEventListener("focusin", (event) => {
    const selector = selectorOf(event.target as Element);
    if (selector) lastTarget = selector;
  });
}

/** Remembers the currently focused control; call right before a redraw. */
export function rememberFocus(): void {
  const active = document.activeElement;
  if (!root || !active || !root.contains(active)) return;
  const selector = selectorOf(active);
  if (selector) lastTarget = selector;
}

/** Chooses where the focus goes on the next restore (e.g. the page heading). */
export function setFocusTarget(selector: string): void {
  lastTarget = selector;
}

/**
 * Focuses the remembered control, or the page heading when it no longer
 * exists. Does nothing while a dialog is open, since the dialog owns the focus.
 */
export function restoreFocus(): void {
  if (!root || !lastTarget || document.querySelector("dialog[open]")) return;
  const target = root.querySelector<HTMLElement>(lastTarget) ?? root.querySelector<HTMLElement>("h1");
  target?.focus({ preventScroll: true });
}
