import { restoreFocus } from "../utils/focus";
import { html } from "../utils/helpers";

/** `true` closes the dialog, `false` keeps it open, a string is shown as an error. */
export type FormResult = boolean | string;

export type FormDialogOptions = {
  title: string;
  /** Markup of the form fields. */
  fields: string;
  submitLabel: string;
  onSubmit(data: FormData): FormResult;
  /** Runs once the form is in the page, for field-specific behavior. */
  onReady?(form: HTMLFormElement): void;
};

/**
 * Opens a modal dialog with a title bar and the given body. Every
 * `[data-close]` element and the Esc key close it; the focus then goes back
 * to the control that opened it.
 */
export function openDialog(options: { title: string; body: string; className?: string }): {
  dialog: HTMLDialogElement;
  close(): void;
} {
  const dialog = document.createElement("dialog");
  dialog.className = options.className ?? "form-dialog";
  dialog.setAttribute("aria-label", options.title);
  dialog.innerHTML = `
    <div class="section-heading">
      <h2>${html(options.title)}</h2>
      <button class="button secondary" type="button" data-close>Chiudi</button>
    </div>
    ${options.body}`;
  document.body.appendChild(dialog);

  const close = () => {
    dialog.close();
    dialog.remove();
    restoreFocus();
  };

  dialog.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", close));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  dialog.showModal();
  return { dialog, close };
}

/** Opens a modal form with a title, the given fields and confirm / cancel buttons. */
export function openFormDialog(options: FormDialogOptions): void {
  const { dialog, close } = openDialog({
    title: options.title,
    body: `
      <form>
        ${options.fields}
        <p class="form-error" role="alert" hidden></p>
        <div class="actions editor-actions">
          <button type="submit" class="button primary">${html(options.submitLabel)}</button>
          <button type="button" class="button secondary" data-close>Annulla</button>
        </div>
      </form>`,
  });

  const form = dialog.querySelector("form")!;
  const error = dialog.querySelector<HTMLElement>(".form-error")!;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = options.onSubmit(new FormData(form));
    if (result === true) return close();
    error.textContent = typeof result === "string" ? result : "";
    error.hidden = typeof result !== "string";
  });

  options.onReady?.(form);
}

/* ---------------------------------------------------------------
   Field markup
   --------------------------------------------------------------- */

export function inputField(label: string, name: string, value: string, attributes = ""): string {
  return `<label class="field">${html(label)}<input name="${name}" value="${html(value)}" ${attributes}></label>`;
}

/** Select of `[value, label]` options. A current value outside the list is kept as an extra option. */
export function selectField(
  label: string,
  name: string,
  options: readonly (readonly [string, string])[],
  current: string,
): string {
  const all = options.some(([value]) => value === current) ? options : [...options, [current, current] as const];
  const markup = all
    .map(([value, text]) => `<option value="${html(value)}" ${value === current ? "selected" : ""}>${html(text)}</option>`)
    .join("");
  return `<label class="field">${html(label)}<select name="${name}">${markup}</select></label>`;
}
