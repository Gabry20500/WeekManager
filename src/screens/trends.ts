import type { Diary, MealPlan, Profile } from "../models/types";
import {
  bindCaloriesChart,
  renderAdherence,
  renderCaloriesChart,
  renderCaloriesTable,
} from "../components/nutrition-charts";
import { adherenceByWeek, caloriesByDay } from "../services/diary";
import { format, todayKey } from "../utils/helpers";
import { bindWeightSection, renderWeightSection, type WeightActions, type WeightState } from "./weight";

export type TrendsTab = "weight" | "nutrition";
/** Days shown in the calories chart. */
export type CaloriesRange = "14" | "30";

export type TrendsState = WeightState & {
  diary: Diary;
  plan: MealPlan;
  profiles: Profile[];
  trendsTab: TrendsTab;
  caloriesRange: CaloriesRange;
};

export type TrendsActions = WeightActions & {
  setTab(tab: TrendsTab): void;
  setCaloriesRange(range: CaloriesRange): void;
};

const TABS: readonly (readonly [TrendsTab, string])[] = [
  ["weight", "Peso"],
  ["nutrition", "Alimentazione"],
];

const CALORIES_RANGES: readonly (readonly [CaloriesRange, string])[] = [
  ["14", "14 giorni"],
  ["30", "30 giorni"],
];

const ADHERENCE_WEEKS = 6;

function caloriesDays(state: TrendsState) {
  return caloriesByDay(state.diary, state.plan, state.profiles, todayKey(), Number(state.caloriesRange));
}

function renderNutrition(state: TrendsState): string {
  const days = caloriesDays(state);
  const logged = days.filter((day) => day.consumed !== undefined);
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

  const summary = logged.length
    ? `In media ${format(Math.round(average(logged.map((day) => day.consumed!))))} kcal al giorno nei ${logged.length} giorni registrati, contro ${format(Math.round(average(logged.map((day) => day.planned))))} previste.`
    : "Nessun pasto registrato nel periodo: il grafico mostra solo il previsto.";

  const filters = CALORIES_RANGES.map(
    ([range, label]) =>
      `<button class="${state.caloriesRange === range ? "active" : ""}" data-calories-range="${range}" aria-pressed="${state.caloriesRange === range}">${label}</button>`,
  ).join("");

  return `
    <div class="tabs" role="group" aria-label="Periodo del grafico delle calorie">${filters}</div>
    <section class="card">
      <div class="section-heading">
        <div><h2>Calorie al giorno</h2><p class="muted">${summary}</p></div>
      </div>
      ${renderCaloriesChart(days)}
      ${renderCaloriesTable(days)}
    </section>
    <section class="card">
      <div class="section-heading">
        <div><h2>Aderenza al piano</h2><p class="muted">Pasti previsti delle ultime ${ADHERENCE_WEEKS} settimane, da lunedì a domenica.</p></div>
      </div>
      ${renderAdherence(adherenceByWeek(state.diary, state.plan, todayKey(), ADHERENCE_WEEKS))}
      <p class="help">Il confronto usa il piano di oggi: se lo hai cambiato, i giorni passati sono valutati con il piano attuale.</p>
    </section>`;
}

export function renderTrendsScreen(state: TrendsState): string {
  const tabs = TABS.map(
    ([tab, label]) =>
      `<button class="${state.trendsTab === tab ? "active" : ""}" data-trends-tab="${tab}" aria-pressed="${state.trendsTab === tab}">${label}</button>`,
  ).join("");

  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">ANDAMENTO</p>
        <h1>${state.trendsTab === "weight" ? "Peso" : "Alimentazione"}</h1>
      </div>
    </section>
    <div class="tabs" role="group" aria-label="Sezione">${tabs}</div>
    ${state.trendsTab === "weight" ? renderWeightSection(state) : renderNutrition(state)}`;
}

export function bindTrendsScreen(root: ParentNode, state: TrendsState, actions: TrendsActions): void {
  root.querySelectorAll<HTMLButtonElement>("[data-trends-tab]").forEach((button) =>
    button.addEventListener("click", () => {
      actions.setTab(button.dataset.trendsTab as TrendsTab);
      actions.rerender();
    }),
  );

  if (state.trendsTab === "weight") {
    bindWeightSection(root, state, actions);
    return;
  }

  bindCaloriesChart(root, caloriesDays(state));
  root.querySelectorAll<HTMLButtonElement>("[data-calories-range]").forEach((button) =>
    button.addEventListener("click", () => {
      actions.setCaloriesRange(button.dataset.caloriesRange as CaloriesRange);
      actions.rerender();
    }),
  );
}
