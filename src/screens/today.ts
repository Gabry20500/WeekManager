import type { Diary, Food, Meal, MealPlan, Profile, WeightLog } from "../models/types";
import { it } from "../locales/it";
import { findProfile, isExcludedFood, totalNutrition, withSnapshot } from "../services/nutrition";
import { isGymDay, mealsWithLogged, sameFoods, weekdayOf } from "../services/plan";
import { recentProfileIds } from "../services/diary";
import { renderDayProgress } from "../components/macro-summary";
import { openMealEditor } from "../components/meal-editor";
import { openProductEditor } from "../components/product-editor";
import { icon } from "../components/icons";
import { showToast } from "../components/toast";
import { restoreFocus, setFocusTarget } from "../utils/focus";
import { clone, format, formatDate, formatMacrosHtml, html, parseDate, shiftDate, todayKey } from "../utils/helpers";

export type TodayState = {
  diary: Diary;
  plan: MealPlan;
  weight: WeightLog;
  profiles: Profile[];
  selectedDate: string;
};

/** Planned meals of the selected day, plus any logged meal no longer in the plan. */
function dayMeals(state: TodayState, date: string) {
  return mealsWithLogged(state.plan, date, state.diary[date] ?? []);
}

/** Reminder shown today on a chosen weigh day, until the weight is logged. */
function renderWeighReminder(state: TodayState): string {
  const today = todayKey();
  const due =
    state.selectedDate === today &&
    (state.weight.weighDays ?? []).includes(weekdayOf(today)) &&
    !state.weight.entries.some((entry) => entry.date === today);
  if (!due) return "";
  return `<p class="notice with-action" role="status"><span>Oggi è giorno di pesata.</span><button class="button small secondary" id="go-weight">Registra il peso</button></p>`;
}

export type TodayActions = {
  /** Opens the weight section of the Trends screen. */
  openWeight(): void;
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
      <button id="previous" aria-label="Giorno precedente">${icon("previous")}</button>
      <div class="date-label" aria-live="polite">
        <span class="date-weekday">${weekday}</span>
        <strong class="date-full">${full}</strong>
      </div>
      <button id="next" aria-label="Giorno successivo">${icon("next")}</button>
      <button id="go-today" class="today-icon ${isToday ? "is-today" : ""}" aria-label="Torna a oggi" title="Torna a oggi">${icon("calendar")}</button>
    </div>`;
}

function renderMealActions(mealId: string, logged: boolean, hasFoods: boolean): string {
  if (logged) {
    return `
      <button class="button secondary" data-edit="${mealId}">${it.editMeal}</button>
      <button class="button secondary" data-reset="${mealId}">${it.undoMeal}</button>`;
  }
  if (!hasFoods) return `<button class="button primary" data-edit="${mealId}">${it.logMeal}</button>`;
  return `
    <button class="button primary" data-as-planned="${mealId}">${it.asPlanned}</button>
    <button class="button secondary" data-edit="${mealId}">${it.changeMeal}</button>`;
}

function renderMealCard(meal: Meal, state: TodayState): string {
  const entry = (state.diary[state.selectedDate] ?? []).find((item) => item.mealId === meal.id);
  const foods = entry?.foods ?? meal.foods;
  // A logged meal counts only its saved snapshots; a planned one uses the catalog.
  const totals = totalNutrition(foods, state.profiles, !entry);

  const foodItems = foods
    .map((food) => {
      const hasNutrition =
        isExcludedFood(food) || Boolean(food.nutrition) || Boolean(findProfile(food, state.profiles));
      const warning = hasNutrition ? "" : ' <small class="muted">· scheda nutrizionale mancante</small>';
      return `<li>${html(food.name)} · ${format(food.amount)} ${html(food.unit)}${warning}</li>`;
    })
    .join("");

  const summary = totals.known
    ? `${totals.missing ? "Totale parziale" : "Stima"}: ${formatMacrosHtml(totals.total)}`
    : totals.excluded
      ? "Solo alimenti esclusi dal calcolo macro."
      : "Alimenti o quantità da specificare.";

  return `
    <article class="card meal">
      <div class="section-heading">
        <h2>${html(meal.name)}</h2>
        <span class="badge ${entry ? "success" : "subtle"}">${entry ? "Registrato" : "Previsto"}</span>
      </div>
      <ul class="food-list">${foodItems || "<li>Nessun alimento: aggiungi ciò che hai mangiato.</li>"}</ul>
      <p class="help">${summary}</p>
      <div class="actions">${renderMealActions(meal.id, Boolean(entry), foods.length > 0)}</div>
    </article>`;
}

export function renderTodayScreen(state: TodayState): string {
  const plan = dayMeals(state, state.selectedDate);
  const planned = plan.flatMap((meal) => meal.foods);
  const consumed = (state.diary[state.selectedDate] ?? []).flatMap((entry) => entry.foods);

  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">DIARIO ALIMENTARE</p>
        <h1>La tua giornata</h1>
        <p class="muted">Registra i pasti: il previsto arriva dal tuo piano.</p>
      </div>
      <span class="badge">${isGymDay(state.plan, state.selectedDate) ? "Palestra" : "Riposo"}</span>
    </section>
    ${renderDateNavigation(state.selectedDate)}
    ${renderWeighReminder(state)}
    ${renderDayProgress(planned, consumed, state.profiles)}
    ${plan.map((meal) => renderMealCard(meal, state)).join("")}
    <button class="button secondary full" id="products">Archivio alimenti / prodotto personale</button>`;
}

export function bindTodayScreen(root: ParentNode, state: TodayState, actions: TodayActions): void {
  const date = state.selectedDate;

  root.querySelector("#previous")?.addEventListener("click", () => actions.selectDate(shiftDate(date, -1)));
  root.querySelector("#next")?.addEventListener("click", () => actions.selectDate(shiftDate(date, 1)));
  root.querySelector("#go-today")?.addEventListener("click", () => actions.selectDate(todayKey()));

  root.querySelector("#go-weight")?.addEventListener("click", actions.openWeight);

  root
    .querySelector("#products")
    ?.addEventListener("click", () => openProductEditor(actions.getProfiles(), actions.saveProfile, actions.rerender));

  // The buttons of a meal change with its state: keep the focus on that meal.
  const focusMeal = (mealId: string) => {
    setFocusTarget(`[data-edit="${mealId}"]`);
    restoreFocus();
  };

  const saveMeal = (mealId: string, foods: Food[], asPlanned: boolean): boolean => {
    const next = clone(state.diary);
    next[date] = [...(next[date] ?? []).filter((item) => item.mealId !== mealId), { mealId, foods, asPlanned }];
    if (!actions.saveDiary(next)) return false;
    actions.rerender();
    focusMeal(mealId);
    return true;
  };

  // Logs the planned foods as eaten, with the nutrition computed now.
  root.querySelectorAll<HTMLButtonElement>("[data-as-planned]").forEach((button) =>
    button.addEventListener("click", () => {
      const meal = dayMeals(state, date).find((item) => item.id === button.dataset.asPlanned);
      if (meal) saveMeal(meal.id, meal.foods.map((food) => withSnapshot(food, actions.getProfiles())), true);
    }),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) =>
    button.addEventListener("click", () => {
      const meal = dayMeals(state, date).find((item) => item.id === button.dataset.edit);
      if (!meal) return;
      const entry = (state.diary[date] ?? []).find((item) => item.mealId === meal.id);

      openMealEditor(
        meal,
        { subtitle: formatDate(date), recent: recentProfileIds(state.diary) },
        entry?.foods,
        actions.getProfiles,
        actions.saveProfile,
        (foods) => saveMeal(meal.id, foods, meal.foods.length > 0 && sameFoods(foods, meal.foods)),
      );
    }),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-reset]").forEach((button) =>
    button.addEventListener("click", () => {
      const mealId = button.dataset.reset;
      const removed = (state.diary[date] ?? []).find((item) => item.mealId === mealId);
      if (!removed) return;

      const next = clone(state.diary);
      next[date] = (next[date] ?? []).filter((item) => item.mealId !== mealId);
      if (!actions.saveDiary(next)) return;
      actions.rerender();
      focusMeal(removed.mealId);

      showToast("Registrazione annullata.", {
        actionLabel: "Ripristina",
        onAction: () => {
          // Put the entry back, unless the meal was logged again meanwhile.
          const current = clone(state.diary);
          const entries = current[date] ?? [];
          if (entries.some((item) => item.mealId === removed.mealId)) return;
          current[date] = [...entries, removed];
          if (actions.saveDiary(current)) actions.rerender();
        },
      });
    }),
  );
}
