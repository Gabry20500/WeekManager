import type { Diary, Meal, Profile } from "../models/types";
import { it } from "../locales/it";
import { getMealPlan } from "../data/meal-plan";
import { findProfile, totalNutrition } from "../services/nutrition";
import { renderMacros } from "../components/macro-summary";
import { openMealEditor } from "../components/meal-editor";
import { openProductEditor } from "../components/product-editor";
import { clone, format, formatMacros, html, isGymDay, parseDate, shiftDate, todayKey } from "../utils/helpers";

export type TodayState = {
  diary: Diary;
  profiles: Profile[];
  selectedDate: string;
};

export type TodayActions = {
  /** Changes the displayed day and redraws. */
  selectDate(date: string): void;
  saveDiary(next: Diary): boolean;
  saveProfile(profile: Profile): boolean;
  /** Always the current catalog, also after a profile is saved. */
  getProfiles(): Profile[];
  rerender(): void;
};

function renderDateNavigation(selectedDate: string): string {
  const date = parseDate(selectedDate);
  const weekday = date.toLocaleDateString("it-IT", { weekday: "long" });
  const full = date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const isToday = selectedDate === todayKey();

  return `
    <div class="date-controls">
      <button id="previous" aria-label="Giorno precedente">←</button>
      <div class="date-label" aria-live="polite">
        <span class="date-weekday">${weekday}</span>
        <strong class="date-full">${full}</strong>
      </div>
      <button id="next" aria-label="Giorno successivo">→</button>
      <button id="go-today" class="today-icon ${isToday ? "is-today" : ""}" aria-label="Torna a oggi" title="Torna a oggi">📅</button>
    </div>`;
}

function renderMealCard(meal: Meal, state: TodayState): string {
  const entry = (state.diary[state.selectedDate] ?? []).find((item) => item.mealId === meal.id);
  const foods = entry?.foods ?? meal.foods;
  // A logged meal counts only its saved snapshots; a planned one uses the catalog.
  const totals = totalNutrition(foods, state.profiles, !entry);

  const foodItems = foods
    .map((food) => {
      const hasNutrition = Boolean(food.nutrition) || Boolean(findProfile(food, state.profiles));
      const warning = hasNutrition ? "" : ' <small class="muted">· scheda nutrizionale mancante</small>';
      return `<li>${html(food.name)} · ${format(food.amount)} ${html(food.unit)}${warning}</li>`;
    })
    .join("");

  const summary = totals.known
    ? `${totals.missing ? "Totale parziale" : "Stima"}: ${formatMacros(totals.total)}`
    : totals.excluded
      ? "Solo alimenti esclusi dal calcolo macro."
      : "Alimenti o quantità da specificare.";

  return `
    <article class="card meal">
      <div class="section-heading">
        <h2>${html(meal.name)}</h2>
        <span class="badge ${entry ? "" : "subtle"}">${entry ? "Registrato" : "Previsto"}</span>
      </div>
      <ul class="food-list">${foodItems || "<li>Nessun alimento: aggiungi ciò che hai mangiato.</li>"}</ul>
      <p class="help">${summary}</p>
      <div class="actions">
        <button class="button primary" data-edit="${meal.id}">${entry ? it.editMeal : it.logMeal}</button>
        ${entry ? `<button class="button secondary" data-reset="${meal.id}">Annulla registrazione</button>` : ""}
      </div>
    </article>`;
}

export function renderTodayScreen(state: TodayState): string {
  const plan = getMealPlan(state.selectedDate);
  const planned = plan.flatMap((meal) => meal.foods);
  const consumed = (state.diary[state.selectedDate] ?? []).flatMap((entry) => entry.foods);

  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">DIARIO ALIMENTARE</p>
        <h1>La tua giornata</h1>
        <p class="muted">Le macro previste arrivano dal piano, non dalla dispensa.</p>
      </div>
      <span class="badge">${isGymDay(state.selectedDate) ? "Palestra" : "Riposo"}</span>
    </section>
    ${renderDateNavigation(state.selectedDate)}
    ${renderMacros(planned, state.profiles, "Macro previsti", true)}
    ${renderMacros(consumed, state.profiles, "Macro consumati", false)}
    <button class="button secondary full" id="products">Archivio alimenti / prodotto personale</button>
    <p class="help">Se vedi trattini nei macro previsti, manca la scheda nutrizionale di uno o più alimenti del piano oppure il nome non combacia con l’archivio.</p>
    ${plan.map((meal) => renderMealCard(meal, state)).join("")}`;
}

export function bindTodayScreen(root: ParentNode, state: TodayState, actions: TodayActions): void {
  const date = state.selectedDate;

  root.querySelector("#previous")?.addEventListener("click", () => actions.selectDate(shiftDate(date, -1)));
  root.querySelector("#next")?.addEventListener("click", () => actions.selectDate(shiftDate(date, 1)));
  root.querySelector("#go-today")?.addEventListener("click", () => actions.selectDate(todayKey()));

  root
    .querySelector("#products")
    ?.addEventListener("click", () => openProductEditor(actions.getProfiles(), actions.saveProfile, actions.rerender));

  root.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) =>
    button.addEventListener("click", () => {
      const meal = getMealPlan(date).find((item) => item.id === button.dataset.edit);
      if (!meal) return;
      const entry = (state.diary[date] ?? []).find((item) => item.mealId === meal.id);

      openMealEditor(meal, date, entry?.foods, actions.getProfiles, actions.saveProfile, (foods) => {
        const next = clone(state.diary);
        next[date] = [...(next[date] ?? []).filter((item) => item.mealId !== meal.id), { mealId: meal.id, foods }];
        if (!actions.saveDiary(next)) return false;
        actions.rerender();
        return true;
      });
    }),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-reset]").forEach((button) =>
    button.addEventListener("click", () => {
      if (!confirm("Annullare la registrazione? Il menu previsto rimarrà disponibile.")) return;
      const next = clone(state.diary);
      next[date] = (next[date] ?? []).filter((item) => item.mealId !== button.dataset.reset);
      if (actions.saveDiary(next)) actions.rerender();
    }),
  );
}
