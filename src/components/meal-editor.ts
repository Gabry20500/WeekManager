import { PORTION_UNITS, type Food, type Meal, type Profile } from "../models/types";
import { it } from "../locales/it";
import { createSnapshot, findProfile, validSnapshot } from "../services/nutrition";
import { restoreFocus } from "../utils/focus";
import { clone, createFood, format, formatMacrosHtml, html, normalize } from "../utils/helpers";
import { renderMacros } from "./macro-summary";
import { openProductEditor } from "./product-editor";
import { releaseToasts, showToast } from "./toast";

export type MealEditorContext = {
  /** Shown under the title, e.g. the date or the weekday being planned. */
  subtitle: string;
  /** Editing the plan rather than logging what was eaten. */
  planning?: boolean;
  /** Profile ids of recently eaten foods, most recent first: suggested before the others. */
  recent?: string[];
};

const UNITS: string[] = ["g", "ml", ...PORTION_UNITS];
const MAX_SUGGESTIONS = 10;

/**
 * Modal editor for the foods of one meal. `onSave` receives the foods with
 * their nutrition snapshot and returns whether they were persisted.
 */
export function openMealEditor(
  meal: Meal,
  context: MealEditorContext,
  previous: Food[] | undefined,
  getProfiles: () => Profile[],
  saveProfile: (profile: Profile) => boolean,
  onSave: (foods: Food[]) => boolean,
): void {
  const originals = clone(previous ?? meal.foods);
  const recentRank = new Map((context.recent ?? []).map((id, index) => [id, index]));
  const amountLabel = context.planning ? "Quantità prevista" : "Quantità mangiata";

  const dialog = document.createElement("dialog");
  dialog.id = "meal-editor";
  dialog.setAttribute("aria-label", `${meal.name}, ${context.subtitle}`);
  dialog.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>${html(meal.name)}</h2>
        <p class="muted">${html(context.subtitle)}</p>
      </div>
      <button class="button secondary" id="close-meal" type="button">Chiudi</button>
    </div>
    <details class="editor-tips">
      <summary>Come inserire le quantità</summary>
      <p class="help">Cerca il prodotto e inserisci il peso. Crudo e cotto non sono intercambiabili. Per uova, fette e scatolette puoi usare i pezzi se la scheda ha la conversione, altrimenti il peso reale senza scarti.</p>
    </details>
    <form id="meal-form">
      <div id="food-rows"></div>
      <div class="actions">
        <button type="button" class="button secondary" id="add-food">${it.addFood}</button>
        <button type="button" class="button secondary" id="products">Schede prodotti</button>
      </div>
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
    releaseToasts(dialog);
    dialog.close();
    dialog.remove();
    restoreFocus();
  };

  /** Hides the suggestion list that is currently open, if any. */
  let closeSuggestions: (() => void) | undefined;

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

  /** One line under each food: its macros, expandable to the profile details. */
  function renderRowInfo(food: Food, profile: Profile | undefined): string {
    if (!profile) return '<p class="help">Nessuna scheda associata: scegli un alimento dall’elenco.</p>';

    const macros = validSnapshot(food.nutrition)
      ? formatMacrosHtml(food.nutrition)
      : food.unit !== profile.basis && !profile.portions[food.unit]
        ? `Usa ${profile.basis}: la conversione da ${html(food.unit)} non è definita.`
        : "Quantità mancante.";

    return `
      <details>
        <summary>${macros}</summary>
        <p class="help">${html(profile.name)} · valori per 100 ${profile.basis}</p>
        <p class="help">${html(profile.source)}</p>
        <p class="help">${html(profile.note ?? "Valori inseriti dall’utente.")}</p>
      </details>`;
  }

  function updatePreview(): void {
    const profiles = getProfiles();
    const foods = rows().map((row) => {
      const food = readRow(row);
      const info = row.querySelector<HTMLElement>("[data-info]")!;
      // Keep an expanded detail open while the user keeps typing.
      const open = info.querySelector("details")?.open ?? false;
      info.innerHTML = renderRowInfo(food, findProfile(food, profiles));
      if (open) info.querySelector("details")?.setAttribute("open", "");
      return food;
    });
    preview.innerHTML = renderMacros(foods, profiles, "Totale del pasto");
  }

  function addRow(food: Food): void {
    const profile = findProfile(food, getProfiles());
    const units = [...new Set([...UNITS, food.unit])];
    const resultsId = `results-${food.id}`;

    const row = document.createElement("div");
    row.className = "editor-food";
    row.dataset.food = food.id;
    if (profile) row.dataset.profileId = profile.id;
    row.innerHTML = `
      <div class="editor-line">
        <input data-name autocomplete="off" required maxlength="160" value="${html(food.name)}" placeholder="Cerca alimento"
          aria-label="${it.searchFood}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${resultsId}">
        <button data-remove type="button" class="icon-button" aria-label="Rimuovi alimento">×</button>
      </div>
      <div data-results class="food-results" id="${resultsId}" role="listbox" aria-label="Alimenti trovati" hidden></div>
      <span class="sr-only" role="status" data-results-status></span>
      <div class="editor-line">
        <input data-amount type="number" inputmode="decimal" step="any" min="0.01" required value="${food.amount}" placeholder="Quantità" aria-label="${amountLabel}">
        <select data-unit aria-label="Unità">${units.map((unit) => `<option value="${html(unit)}" ${food.unit === unit ? "selected" : ""}>${html(unit)}</option>`).join("")}</select>
      </div>
      <div data-info class="editor-info"></div>`;
    container.appendChild(row);

    const input = row.querySelector<HTMLInputElement>("[data-name]")!;
    const results = row.querySelector<HTMLElement>("[data-results]")!;
    const amount = row.querySelector<HTMLInputElement>("[data-amount]")!;
    const unit = row.querySelector<HTMLSelectElement>("[data-unit]")!;
    const status = row.querySelector<HTMLElement>("[data-results-status]")!;
    /** Index of the suggestion highlighted with the arrow keys, or -1. */
    let active = -1;

    const options = () => Array.from(results.querySelectorAll<HTMLElement>('[role="option"]'));

    const highlight = (index: number) => {
      active = index;
      options().forEach((option, position) => option.setAttribute("aria-selected", String(position === index)));
      const current = options()[index];
      if (current) {
        input.setAttribute("aria-activedescendant", current.id);
        current.scrollIntoView({ block: "nearest" });
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    };

    const hideResults = () => {
      results.hidden = true;
      input.setAttribute("aria-expanded", "false");
      highlight(-1);
      if (closeSuggestions === hideResults) closeSuggestions = undefined;
    };

    const pick = (selected: Profile) => {
      input.value = selected.name;
      row.dataset.profileId = selected.id;
      if (unit.value !== selected.basis && !selected.portions[unit.value]) {
        // Never assume that two pieces mean two grams.
        unit.value = selected.basis;
        amount.value = "";
      }
      hideResults();
      updatePreview();
      amount.focus();
    };

    const suggest = () => {
      const query = normalize(input.value);
      const rank = (item: Profile) => recentRank.get(item.id) ?? Number.MAX_SAFE_INTEGER;
      const matches = getProfiles()
        .filter(
          (item) =>
            !query ||
            normalize(item.name).includes(query) ||
            item.aliases?.some((alias) => normalize(alias).includes(query)),
        )
        // Recently eaten foods first; the sort is stable, so the rest keeps its order.
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, MAX_SUGGESTIONS);

      results.innerHTML = matches.length
        ? matches
            .map(
              (item, index) =>
                `<button type="button" class="food-result" role="option" aria-selected="false" tabindex="-1" id="${resultsId}-${index}" data-pick="${html(item.id)}"><strong>${html(item.name)}</strong><small>${recentRank.has(item.id) ? "recente · " : ""}${format(item.kcal)} kcal / 100 ${item.basis}</small></button>`,
            )
            .join("")
        : '<p class="help">Nessun risultato. Crea un prodotto personale da “Schede prodotti” oppure lascia la voce senza scheda.</p>';
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
      highlight(-1);
      status.textContent = matches.length
        ? `${matches.length} ${matches.length === 1 ? "risultato" : "risultati"}. Usa le frecce per scegliere.`
        : "Nessun risultato.";
      closeSuggestions = hideResults;
    };

    // Keep the focus in the field while a suggestion is being clicked.
    results.addEventListener("mousedown", (event) => event.preventDefault());

    // One delegated listener instead of one per suggestion on every keystroke.
    results.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-pick]");
      const selected = button && getProfiles().find((item) => item.id === button.dataset.pick);
      if (selected) pick(selected);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (results.hidden) suggest();
        const count = options().length;
        if (!count) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        highlight(active < 0 ? (step > 0 ? 0 : count - 1) : (active + step + count) % count);
      } else if (event.key === "Enter" && !results.hidden && active >= 0) {
        // Choose the highlighted suggestion instead of submitting the meal.
        event.preventDefault();
        options()[active]?.click();
      }
    });
    input.addEventListener("blur", (event) => {
      if (!results.contains(event.relatedTarget as Node | null)) hideResults();
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
    // Esc closes the open suggestion list first, then the editor.
    if (closeSuggestions) closeSuggestions();
    else close();
  });

  dialog.querySelector<HTMLFormElement>("#meal-form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const foods = rows().map(readRow);

    if (foods.some((food) => !food.name || !Number.isFinite(food.amount) || food.amount <= 0)) {
      showToast("Controlla nomi e quantità.", { kind: "error" });
      return;
    }
    const missing = foods.filter((food) => !validSnapshot(food.nutrition)).length;
    if (
      missing &&
      !confirm(`${missing} alimenti non hanno macro calcolabili. Salvare comunque il pasto come incompleto?`)
    ) {
      return;
    }
    // An empty planned meal is normal (a free meal); an empty logged one is worth a check.
    if (!foods.length && !context.planning && !confirm("Registrare questo pasto senza alimenti consumati?")) return;

    if (onSave(foods)) close();
  });

  dialog.showModal();
}
