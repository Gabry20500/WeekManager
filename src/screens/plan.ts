import type { Meal, MealPlan, Profile } from "../models/types";
import { createDefaultPlan } from "../data/meal-plan";
import { openFormDialog } from "../components/form-dialog";
import { renderMacros } from "../components/macro-summary";
import { openMealEditor } from "../components/meal-editor";
import { showToast } from "../components/toast";
import { findProfile, isExcludedFood, totalNutrition } from "../services/nutrition";
import { WEEKDAYS, copyMeals, weekdayName, withMealFoods } from "../services/plan";
import { clone, format, formatMacrosHtml, html } from "../utils/helpers";

export type PlanState = {
  plan: MealPlan;
  profiles: Profile[];
  /** Weekday being edited, as a `Date.getDay()` number. */
  planWeekday: number;
};

export type PlanActions = {
  savePlan(next: MealPlan): boolean;
  /** Current plan, for actions that run after the screen was redrawn (undo). */
  getPlan(): MealPlan;
  setWeekday(weekday: number): void;
  saveProfile(profile: Profile): boolean;
  getProfiles(): Profile[];
  rerender(): void;
};

function renderWeekdays(state: PlanState): string {
  const buttons = WEEKDAYS.map(([weekday, short, long]) => {
    const selected = weekday === state.planWeekday;
    const gym = state.plan.gymDays.includes(weekday);
    return `<button class="${selected ? "active" : ""}" data-plan-weekday="${weekday}" aria-pressed="${selected}" aria-label="${long}${gym ? ", giorno di palestra" : ""}">${short}${gym ? '<span class="gym-mark" aria-hidden="true"></span>' : ""}</button>`;
  }).join("");
  return `<div class="tabs seven" role="group" aria-label="Giorno della settimana">${buttons}</div>`;
}

function renderMealCard(meal: Meal, profiles: Profile[]): string {
  const totals = totalNutrition(meal.foods, profiles, true);
  const foods = meal.foods
    .map((food) => {
      const known = isExcludedFood(food) || Boolean(findProfile(food, profiles));
      const warning = known ? "" : ' <small class="muted">· scheda nutrizionale mancante</small>';
      return `<li>${html(food.name)} · ${format(food.amount)} ${html(food.unit)}${warning}</li>`;
    })
    .join("");

  const summary = totals.known
    ? `${totals.missing ? "Totale parziale" : "Stima"}: ${formatMacrosHtml(totals.total)}`
    : meal.foods.length
      ? "Macro non calcolabili per questi alimenti."
      : "Nessun alimento previsto: registrerai liberamente ciò che mangi.";

  return `
    <article class="card meal">
      <div class="section-heading">
        <h2>${html(meal.name)}</h2>
      </div>
      ${foods ? `<ul class="food-list">${foods}</ul>` : ""}
      <p class="help">${summary}</p>
      <div class="actions">
        <button class="button secondary" data-plan-edit="${meal.id}">${meal.foods.length ? "Modifica" : "Aggiungi alimenti"}</button>
      </div>
    </article>`;
}

export function renderPlanScreen(state: PlanState): string {
  const meals = state.plan.days[state.planWeekday] ?? [];
  const gym = state.plan.gymDays.includes(state.planWeekday);
  const day = weekdayName(state.planWeekday);

  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">PIANO ALIMENTARE</p>
        <h1>Il tuo piano</h1>
        <p class="muted">Quello che prevedi di mangiare in ogni giorno della settimana.</p>
      </div>
    </section>
    ${renderWeekdays(state)}
    <section class="card">
      <div class="section-heading">
        <h2>${day}</h2>
        <label class="check compact"><input type="checkbox" id="plan-gym" ${gym ? "checked" : ""}> Giorno di palestra</label>
      </div>
      <div class="actions">
        <button class="button small secondary" id="plan-copy">Copia su altri giorni…</button>
        <button class="button small secondary" id="plan-reset">Ripristina piano iniziale</button>
      </div>
    </section>
    ${renderMacros(meals.flatMap((meal) => meal.foods), state.profiles, `Totale previsto · ${day}`)}
    ${meals.map((meal) => renderMealCard(meal, state.profiles)).join("")}`;
}

export function bindPlanScreen(root: ParentNode, state: PlanState, actions: PlanActions): void {
  const weekday = state.planWeekday;
  const day = weekdayName(weekday);

  const commit = (next: MealPlan): boolean => {
    if (!actions.savePlan(next)) return false;
    actions.rerender();
    return true;
  };

  /** Saves a change and offers to go back to the plan as it was before. */
  const commitWithUndo = (next: MealPlan, message: string): boolean => {
    const previous = clone(state.plan);
    if (!commit(next)) return false;
    showToast(message, { actionLabel: "Annulla", onAction: () => commit(previous) });
    return true;
  };

  root.querySelectorAll<HTMLButtonElement>("[data-plan-weekday]").forEach((button) =>
    button.addEventListener("click", () => {
      actions.setWeekday(Number(button.dataset.planWeekday));
      actions.rerender();
    }),
  );

  root.querySelector<HTMLInputElement>("#plan-gym")?.addEventListener("change", (event) => {
    const checked = (event.target as HTMLInputElement).checked;
    const gymDays = state.plan.gymDays.filter((value) => value !== weekday);
    commit({ ...state.plan, gymDays: checked ? [...gymDays, weekday].sort() : gymDays });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-plan-edit]").forEach((button) =>
    button.addEventListener("click", () => {
      const meal = (state.plan.days[weekday] ?? []).find((item) => item.id === button.dataset.planEdit);
      if (!meal) return;
      openMealEditor(
        meal,
        { subtitle: `${day} · piano`, planning: true },
        undefined,
        actions.getProfiles,
        actions.saveProfile,
        (foods) => commit(withMealFoods(actions.getPlan(), weekday, meal.id, foods)),
      );
    }),
  );

  root.querySelector("#plan-copy")?.addEventListener("click", () => {
    const options = WEEKDAYS.filter(([value]) => value !== weekday)
      .map(
        ([value, , long]) =>
          `<label class="check"><input type="checkbox" name="target" value="${value}"> ${long}</label>`,
      )
      .join("");

    openFormDialog({
      title: `Copia ${day}`,
      submitLabel: "Copia",
      fields: `<p class="help">I pasti di ${day.toLowerCase()} sostituiranno quelli dei giorni scelti.</p>${options}`,
      onSubmit: (data) => {
        const targets = data.getAll("target").map(Number);
        if (!targets.length) return "Scegli almeno un giorno.";
        const next = clone(actions.getPlan());
        for (const target of targets) next.days[target] = copyMeals(next.days[weekday] ?? []);
        return commitWithUndo(next, `${day} copiato su ${targets.length === 1 ? "un giorno" : `${targets.length} giorni`}.`);
      },
    });
  });

  root.querySelector("#plan-reset")?.addEventListener("click", () => {
    commitWithUndo(createDefaultPlan(), "Piano iniziale ripristinato.");
  });
}
