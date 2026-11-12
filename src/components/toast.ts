export type ToastOptions = {
  kind?: "info" | "error";
  /** Label of an optional action button, e.g. "Annulla". */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds before the toast disappears. */
  duration?: number;
};

const DEFAULT_DURATION = 5000;
const ACTION_DURATION = 8000;

let region: HTMLElement | undefined;

/** Where toasts must live to be visible: the topmost open dialog, else the page. */
function currentHost(except?: Element): Element {
  const dialogs = [...document.querySelectorAll("dialog[open]")].filter((dialog) => dialog !== except);
  return dialogs.at(-1) ?? document.body;
}

/**
 * Call before removing a dialog: a toast shown from inside it (e.g. "saved,
 * undo?") moves out and stays visible after the dialog is gone.
 */
export function releaseToasts(dialog: Element): void {
  if (region && dialog.contains(region)) currentHost(dialog).appendChild(region);
}

/**
 * Shows a short message at the bottom of the screen, replacing the previous
 * one. The countdown pauses while the toast is hovered or focused.
 */
export function showToast(message: string, options: ToastOptions = {}): void {
  // A modal dialog covers the page, so the toast must live inside it.
  const host = currentHost();
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
  }
  if (region.parentElement !== host) host.appendChild(region);

  const toast = document.createElement("div");
  toast.className = `toast ${options.kind === "error" ? "error" : ""}`;
  toast.setAttribute("role", options.kind === "error" ? "alert" : "status");

  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);

  const dismiss = () => toast.remove();

  if (options.actionLabel && options.onAction) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "toast-action";
    action.textContent = options.actionLabel;
    action.addEventListener("click", () => {
      dismiss();
      options.onAction?.();
    });
    toast.appendChild(action);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Chiudi notifica");
  close.textContent = "×";
  close.addEventListener("click", dismiss);
  toast.appendChild(close);

  const duration = options.duration ?? (options.actionLabel ? ACTION_DURATION : DEFAULT_DURATION);
  let timer = window.setTimeout(dismiss, duration);
  const pause = () => window.clearTimeout(timer);
  const resume = () => {
    pause();
    timer = window.setTimeout(dismiss, duration);
  };
  toast.addEventListener("pointerenter", pause);
  toast.addEventListener("pointerleave", resume);
  toast.addEventListener("focusin", pause);
  toast.addEventListener("focusout", resume);

  region.replaceChildren(toast);
}
