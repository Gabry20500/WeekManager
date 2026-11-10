import type { Food, Meal, Profile } from "../models/types";
import { it } from "../locales/it";
import { createSnapshot, findProfile, validSnapshot } from "../services/nutrition";
import { clone, createFood, format, formatMacros, html, normalize } from "../utils/helpers";
import { renderMacros } from "./macro-summary";
import { openProductEditor } from "./product-editor";

const UNITS = ["g", "ml", "pezzi", "fette", "scatolette", "cucchiai", "porzioni", "tazze"];
const MAX_SUGGESTIONS = 10;

/**
 * Modal editor for one meal of one day. `onSave` receives the foods with
 * their nutrition snapshot and returns whether they were persisted.
 */
export function openMealEditor(
  meal: Meal,
  date: string,
  previous: Food[] | undefined,
  getProfiles: () => Profile[],
  saveProfile: (profile: Profile) => boolean,
  onSave: (foods: Food[]) => boolean,
): void {
  const originals = clone(previous ?? meal.foods);

  const dialog = document.createElement("dialog");
  dialog.id = "meal-editor";
  dialog.setAttribute("aria-label", "Modifica pasto");
  dialog.innerHTML = `
    <div class="section-heading">
      <h2>${html(meal.name)}</h2>
      <button class="button secondary" id="close-meal" type="button">Chiudi</button>
    </div>
    <p class="help">${html(date)} · Cerca il prodotto e inserisci il peso mangiato. Crudo e cotto non sono intercambiabili. Per uova, fette e scatolette usa il peso reale senza scarti.</p>
    <button class="button secondary full" id="products" type="button">Nuovo prodotto / modifica scheda</button>
    <form id="meal-form">
      <div id="food-rows"></div>
      <button type="button" class="button secondary full" id="add-food">${it.addFood}</button>
      <div id="draft-macros"></div>
      <div class="actions editor-actions">
        <button type="submit" class="button primary">${it.confirm}</button>
        <button type="button" class="button secondary" id="cancel-meal">${it.cancel}</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  const container = dialog.querySelector<HTMLElement>("#food-rows")!;
  const preview = dialog.querySelector<HTMLElement>("#draft-macros")!;

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const rows = () => Array.from(container.querySelectorAll<HTMLElement>("[data-food]"));

  /** Reads one row, keeping the saved snapshot when the food is unchanged. */
  function readRow(row: HTMLElement): Food {
    const food: Food = {
      id: row.dataset.food!,
      name: row.querySelector<HTMLInputElement>("[data-name]")!.value.trim(),
      amount: row.querySelector<HTMLInputElement>("[data-amount]")!.valueAsNumber,
      unit: row.querySelector<HTMLSelectElement>("[data-unit]")!.value,
    };
    const profileId = row.dataset.profileId;
    if (profileId) food.profileId = profileId;

    const original = originals.find((item) => item.id === food.id);
    const unchanged =
      original !== undefined &&
      original.name === food.name &&
      original.amount === food.amount &&
      original.unit === food.unit &&
      validSnapshot(original.nutrition) &&
      (!profileId || original.nutrition.profileId === profileId);

    if (unchanged) {
      food.nutrition = { ...original.nutrition! };
    } else {
      const profile = findProfile(food, getProfiles());
      const snapshot = profile && createSnapshot(profile, food.amount, food.unit);
      if (snapshot) food.nutrition = snapshot;
    }
    return food;
  }

  function updatePreview(): void {
    const profiles = getProfiles();
    const foods = rows().map((row) => {
      const food = readRow(row);
      const profile = findProfile(food, profiles);

      row.querySelector<HTMLElement>("[data-source]")!.innerHTML = profile
        ? `<details><summary>${html(profile.name)} · valori per 100 ${profile.basis}</summary><p class="help">${html(profile.source)}</p><p class="help">${html(profile.note ?? "Valori inseriti dall’utente.")}</p></details>`
        : '<p class="help">Seleziona un alimento concreto. Questa voce non ha ancora una scheda associata.</p>';

      row.querySelector<HTMLElement>("[data-row-macros]")!.textContent = validSnapshot(food.nutrition)
        ? formatMacros(food.nutrition)
        : profile && food.unit !== profile.basis
          ? `Inserisci il peso in ${profile.basis}: la conversione da ${food.unit} non è definita.`
          : "Dati o quantità mancanti.";

      return food;
    });
    preview.innerHTML = renderMacros(foods, profiles, "Anteprima del pasto");
  }

  function addRow(food: Food): void {
    const profile = findProfile(food, getProfiles());
    const units = [...new Set([...UNITS, food.unit])];

    const row = document.createElement("div");
    row.className = "editor-food";
    row.dataset.food = food.id;
    if (profile) row.dataset.profileId = profile.id;
    row.innerHTML = `
      <label class="field">${it.searchFood}
        <input data-name autocomplete="off" required maxlength="160" value="${html(food.name)}" placeholder="Es. pollo, mela, broccoli">
      </label>
      <div data-results class="food-results" hidden></div>
      <div class="editor-grid">
        <label class="field">Quantità mangiata
          <input data-amount type="number" inputmode="decimal" step="any" min="0.01" required value="${food.amount}">
        </label>
        <label class="field">Unità
          <select data-unit>${units.map((unit) => `<option value="${html(unit)}" ${food.unit === unit ? "selected" : ""}>${html(unit)}</option>`).join("")}</select>
        </label>
      </div>
      <div data-source></div>
      <p class="help" data-row-macros></p>
      <button data-remove type="button" class="button secondary">Rimuovi alimento</button>`;
    container.appendChild(row);

    const input = row.querySelector<HTMLInputElement>("[data-name]")!;
    const results = row.querySelector<HTMLElement>("[data-results]")!;
    const amount = row.querySelector<HTMLInputElement>("[data-amount]")!;
    const unit = row.querySelector<HTMLSelectElement>("[data-unit]")!;

    const pick = (selected: Profile) => {
      input.value = selected.name;
      row.dataset.profileId = selected.id;
      if (unit.value !== selected.basis && !selected.portions[unit.value]) {
        // Never assume that two pieces mean two grams.
        unit.value = selected.basis;
        amount.value = "";
      }
      results.hidden = true;
      updatePreview();
      amount.focus();
    };

    const suggest = () => {
      const query = normalize(input.value);
      const matches = getProfiles()
        .filter(
          (item) =>
            !query ||
            normalize(item.name).includes(query) ||
            item.aliases?.some((alias) => normalize(alias).includes(query)),
        )
        .slice(0, MAX_SUGGESTIONS);

      results.innerHTML = matches.length
        ? matches
            .map(
              (item) =>
                `<button type="button" class="food-result" data-pick="${html(item.id)}"><strong>${html(item.name)}</strong><small>${format(item.kcal)} kcal / 100 ${item.basis}</small></button>`,
            )
            .join("")
        : '<p class="help">Nessun risultato. Crea un prodotto personale oppure registra la voce come incompleta.</p>';
      results.hidden = false;
    };

    // One delegated listener instead of one per suggestion on every keystroke.
    results.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-pick]");
      const selected = button && getProfiles().find((item) => item.id === button.dataset.pick);
      if (selected) pick(selected);
    });

    input.addEventListener("focus", suggest);
    input.addEventListener("input", () => {
      const exact = getProfiles().find((item) => normalize(item.name) === normalize(input.value));
      if (exact) row.dataset.profileId = exact.id;
      else delete row.dataset.profileId;
      suggest();
      updatePreview();
    });
    amount.addEventListener("input", updatePreview);
    unit.addEventListener("change", updatePreview);
    row.querySelector("[data-remove]")!.addEventListener("click", () => {
      row.remove();
      updatePreview();
    });
  }

  originals.forEach(addRow);
  updatePreview();

  dialog.querySelector("#add-food")!.addEventListener("click", () => {
    addRow(createFood("", 100));
    updatePreview();
    container.querySelector<HTMLInputElement>(".editor-food:last-child [data-name]")?.focus();
  });
  dialog
    .querySelector("#products")!
    .addEventListener("click", () => openProductEditor(getProfiles(), saveProfile, updatePreview));
  dialog.querySelector("#close-meal")!.addEventListener("click", close);
  dialog.querySelector("#cancel-meal")!.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  dialog.querySelector<HTMLFormElement>("#meal-form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const foods = rows().map(readRow);

    if (foods.some((food) => !food.name || !Number.isFinite(food.amount) || food.amount <= 0)) {
      alert("Controlla nomi e quantità.");
      return;
    }
    const missing = foods.filter((food) => !validSnapshot(food.nutrition)).length;
    if (
      missing &&
      !confirm(`${missing} alimenti non hanno macro calcolabili. Salvare comunque il pasto come incompleto?`)
    ) {
      return;
    }
    if (!foods.length && !confirm("Registrare questo pasto senza alimenti consumati?")) return;

    if (onSave(foods)) close();
  });

  dialog.showModal();
}
