import type { Meal, Food, Profile } from "../models/types";
import { html, createFood, clone, unitLabel, format, normalize } from "../utils/helpers";
import { findProfile, createSnapshot, validSnapshot, renderMacros } from "../services/nutrition";
import { openProductEditor } from "./product-editor";
import { it } from "../locales/it";
export function openMealEditor(meal: Meal, date: string, previous: Food[] | undefined, getProfiles: () => Profile[], saveProfile: (profile: Profile) => boolean, onSave: (foods: Food[]) => boolean): void {
  const originals = clone(previous ?? meal.foods);
  const dialog = document.createElement("dialog");
  dialog.id = "meal-editor";
  dialog.setAttribute("aria-label", "Modifica pasto");
  document.body.appendChild(dialog);
  dialog.innerHTML = `<div class="section-heading"><h2>${html(meal.name)}</h2><button class="button secondary" id="close-meal" type="button">Chiudi</button></div><p class="help">${html(date)} · Cerca il prodotto e inserisci il peso mangiato. Crudo e cotto non sono intercambiabili. Per uova, fette e scatolette usa il peso reale senza scarti.</p><button class="button secondary full" id="products" type="button">Nuovo prodotto / modifica scheda</button><form id="meal-form"><div id="food-rows"></div><button type="button" class="button secondary full" id="add-food">${it.addFood}</button><div id="draft-macros"></div><div class="actions editor-actions"><button type="submit" class="button primary">${it.confirm}</button><button type="button" class="button secondary" id="cancel-meal">${it.cancel}</button></div></form>`;
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  const container = dialog.querySelector<HTMLElement>('#food-rows')!;
  function readRows(): Food[] {
    return Array.from(container.querySelectorAll<HTMLElement>('[data-food]')).map(row => {
      const name = row.querySelector<HTMLInputElement>('[data-name]')!.value.trim();
      const amount = row.querySelector<HTMLInputElement>('[data-amount]')!.valueAsNumber;
      const unit = row.querySelector<HTMLSelectElement>('[data-unit]')!.value;
      const id = row.dataset.food!;
      const item: Food = {
        id,
        name,
        amount,
        unit
      };
      const original = originals.find(food => food.id === id);
      const profileId = row.dataset.profileId;
      if (profileId) item.profileId = profileId;
      const profile = findProfile(item, getProfiles());
      if (original && original.name === name && original.amount === amount && original.unit === unit && validSnapshot(original.nutrition) && (!profileId || original.nutrition.profileId === profileId)) {
        item.nutrition = {
          ...original.nutrition
        };
      } else if (profile) {
        const snapshot = createSnapshot(profile, amount, unit);
        if (snapshot) item.nutrition = snapshot;
      }
      return item;
    });
  }
  function updatePreview(): void {
    const foods = readRows();
    dialog.querySelector('#draft-macros')!.innerHTML = renderMacros(foods, getProfiles(), 'Anteprima del pasto');
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-food]'));
    foods.forEach((food, index) => {
      const row = rows[index];
      if (!row) return;
      const profile = findProfile(food, getProfiles());
      const source = row.querySelector<HTMLElement>('[data-source]')!;
      source.innerHTML = profile ? `<details><summary>${html(profile.name)} · valori per 100 ${profile.basis}</summary><p class="help">${html(profile.source)}</p><p class="help">${html(profile.note ?? 'Valori inseriti dall’utente.')}</p></details>` : '<p class="help">Seleziona un alimento concreto. Questa voce non ha ancora una scheda associata.</p>';
      const info = row.querySelector<HTMLElement>('[data-row-macros]')!;
      info.textContent = validSnapshot(food.nutrition) ? `${format(food.nutrition.kcal)} kcal · P ${format(food.nutrition.protein)} g · C ${format(food.nutrition.carbs)} g · G ${format(food.nutrition.fat)} g` : profile && food.unit !== profile.basis ? `Inserisci il peso in ${profile.basis}: la conversione da ${unitLabel(food.unit)} non è definita.` : 'Dati o quantità mancanti.';
    });
  }
  function addRow(food: Food): void {
    const profile = findProfile(food, getProfiles());
    const row = document.createElement('div');
    row.className = 'editor-food';
    row.dataset.food = food.id;
    if (profile) row.dataset.profileId = profile.id;
    const units = [...new Set(['g', 'ml', 'pezzi', 'fette', 'scatolette', 'cucchiai', 'porzioni', 'tazze', food.unit])];
    row.innerHTML = `<label class="field">${it.searchFood}<input data-name autocomplete="off" required maxlength="160" value="${html(food.name)}" placeholder="Es. pollo, mela, broccoli"></label><div data-results class="food-results" hidden></div><div class="editor-grid"><label class="field">Quantità mangiata<input data-amount type="number" inputmode="decimal" step="any" min="0.01" required value="${food.amount}"></label><label class="field">Unità<select data-unit>${units.map(unit => `<option value="${html(unit)}" ${food.unit === unit ? 'selected' : ''}>${html(unitLabel(unit))}</option>`).join('')}</select></label></div><div data-source></div><p class="help" data-row-macros></p><button data-remove type="button" class="button secondary">Rimuovi alimento</button>`;
    container.appendChild(row);
    const input = row.querySelector<HTMLInputElement>('[data-name]')!;
    const results = row.querySelector<HTMLElement>('[data-results]')!;
    const amount = row.querySelector<HTMLInputElement>('[data-amount]')!;
    const unit = row.querySelector<HTMLSelectElement>('[data-unit]')!;
    const suggest = () => {
      const query = normalize(input.value);
      const matches = getProfiles().filter(item => !query || normalize(item.name).includes(query) || item.aliases?.some(alias => normalize(alias).includes(query))).slice(0, 10);
      results.innerHTML = matches.length ? matches.map(item => `<button type="button" class="food-result" data-pick="${html(item.id)}"><strong>${html(item.name)}</strong><small>${format(item.kcal)} kcal / 100 ${item.basis}</small></button>`).join('') : '<p class="help">Nessun risultato. Crea un prodotto personale oppure registra la voce come incompleta.</p>';
      results.hidden = false;
      results.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(button => button.addEventListener('click', () => {
        const selected = getProfiles().find(item => item.id === button.dataset.pick);
        if (!selected) return;
        input.value = selected.name;
        row.dataset.profileId = selected.id;
        if (unit.value !== selected.basis && !selected.portions[unit.value]) {
          // Never assume that two pieces mean two grams.
          unit.value = selected.basis;
          amount.value = '';
        }
        results.hidden = true;
        updatePreview();
        amount.focus();
      }));
    };
    input.addEventListener('focus', suggest);
    input.addEventListener('input', () => {
      delete row.dataset.profileId;
      const exact = getProfiles().find(item => normalize(item.name) === normalize(input.value));
      if (exact) row.dataset.profileId = exact.id;
      suggest();
      updatePreview();
    });
    amount.addEventListener('input', updatePreview);
    unit.addEventListener('change', updatePreview);
    row.querySelector('[data-remove]')?.addEventListener('click', () => {
      row.remove();
      updatePreview();
    });
  }
  originals.forEach(addRow);
  updatePreview();
  dialog.querySelector('#add-food')?.addEventListener('click', () => {
    addRow(createFood('', 100));
    updatePreview();
    const inputs = container.querySelectorAll<HTMLInputElement>('[data-name]');
    inputs.item(inputs.length - 1)?.focus();
  });
  dialog.querySelector('#products')?.addEventListener('click', () => openProductEditor(getProfiles(), saveProfile, updatePreview));
  dialog.querySelector('#close-meal')?.addEventListener('click', close);
  dialog.querySelector('#cancel-meal')?.addEventListener('click', close);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.querySelector<HTMLFormElement>('#meal-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const foods = readRows();
    if (foods.some(food => !food.name || !Number.isFinite(food.amount) || food.amount <= 0)) {
      alert('Controlla nomi e quantità.');
      return;
    }
    const missing = foods.filter(food => !validSnapshot(food.nutrition)).length;
    if (missing && !confirm(`${missing} alimenti non hanno macro calcolabili. Salvare comunque il pasto come incompleto?`)) return;
    if (!foods.length && !confirm('Registrare questo pasto senza alimenti consumati?')) return;
    if (onSave(foods)) close();
  });
  dialog.showModal();
}
