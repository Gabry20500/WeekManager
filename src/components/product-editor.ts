import type { Profile } from "../models/types";
import { isBuiltinProfile } from "../data/food-catalog";
import { validProfile } from "../services/storage";
import { restoreFocus } from "../utils/focus";
import { createId, html } from "../utils/helpers";
import { showToast } from "./toast";

const MACRO_FIELDS = [
  ["kcal", "Calorie (kcal)"],
  ["protein", "Proteine (g)"],
  ["carbs", "Carboidrati (g)"],
  ["fat", "Grassi (g)"],
] as const;

/**
 * Modal editor for nutrition profiles. Editing a built-in profile saves a
 * personal copy; `onClose` runs whenever the dialog is dismissed.
 */
export function openProductEditor(
  profiles: Profile[],
  onSave: (profile: Profile) => boolean,
  onClose: () => void,
): void {
  const dialog = document.createElement("dialog");
  dialog.className = "nutrition-dialog";
  dialog.setAttribute("aria-label", "Prodotti personali");
  document.body.appendChild(dialog);

  const close = () => {
    dialog.close();
    dialog.remove();
    onClose();
    restoreFocus();
  };

  const show = (id?: string) => {
    const product = profiles.find((item) => item.id === id);

    const options = profiles
      .map(
        (item) => `<option value="${html(item.id)}" ${id === item.id ? "selected" : ""}>${html(item.name)}</option>`,
      )
      .join("");
    const macroInputs = MACRO_FIELDS.map(
      ([key, label]) =>
        `<label class="field">${label}<input name="${key}" type="number" min="0" step="any" inputmode="decimal" required value="${product ? product[key] : ""}"></label>`,
    ).join("");

    dialog.innerHTML = `
      <div class="section-heading">
        <h2>Schede e prodotti</h2>
        <button class="button secondary" id="close-product" type="button">Chiudi</button>
      </div>
      <label class="field">Scheda da modificare
        <select id="product-picker"><option value="">Nuovo prodotto</option>${options}</select>
      </label>
      <form id="product-form">
        <label class="field">Nome, marca e stato (crudo/cotto)
          <input name="name" required maxlength="160" value="${html(product?.name ?? "")}">
        </label>
        <label class="field">Valori riferiti a
          <select name="basis">
            <option value="g" ${product?.basis === "g" ? "selected" : ""}>100 g</option>
            <option value="ml" ${product?.basis === "ml" ? "selected" : ""}>100 ml</option>
          </select>
        </label>
        <div class="nutrition-input-grid">${macroInputs}</div>
        <label class="field">Fonte / etichetta
          <input name="source" required value="${html(product?.source ?? "")}">
        </label>
        <p class="help">Se cambi una scheda precaricata, viene creata una copia personale. Lo storico dei pasti non viene ricalcolato.</p>
        <button class="button primary full" type="submit">Salva prodotto</button>
      </form>`;

    dialog.querySelector("#close-product")!.addEventListener("click", close);
    dialog
      .querySelector<HTMLSelectElement>("#product-picker")!
      .addEventListener("change", (event) => show((event.target as HTMLSelectElement).value));

    dialog.querySelector<HTMLFormElement>("#product-form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.target as HTMLFormElement);
      const isPersonal = product !== undefined && !isBuiltinProfile(product);

      const personal: Profile = {
        id: isPersonal ? product.id : `custom-${createId()}`,
        name: String(data.get("name") ?? "").trim(),
        basis: data.get("basis") === "ml" ? "ml" : "g",
        source: String(data.get("source") ?? "").trim(),
        kcal: Number(data.get("kcal")),
        protein: Number(data.get("protein")),
        carbs: Number(data.get("carbs")),
        fat: Number(data.get("fat")),
        portions: product?.portions ?? {},
        category: "Personali",
      };

      if (!validProfile(personal) || !personal.source) {
        showToast("Controlla tutti i campi.", { kind: "error" });
        return;
      }
      if (onSave(personal)) close();
    });
  };

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  show();
  dialog.showModal();
}
