import { it } from "../locales/it";
import type { Entry } from "../models/types";
import { getMealPlan } from "../data/meal-plan";
import { isGymDay } from "../utils/date";
import { renderDateNavigation } from "../components/date-navigation";
import { renderMealCard } from "../components/meal-card";
import { renderNutritionSummary } from "../services/nutrition";
export function renderTodayScreen(selectedDate: string, entries: Entry[]): string {
  const meals = getMealPlan(selectedDate);
  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">${it.foodDiary}</p>
        <h1>${it.yourDay}</h1>

        <p class="muted">
          ${it.plannedMealsAndConsumedFoods}
        </p>
      </div>

      <span class="badge">
        ${isGymDay(selectedDate) ? it.gymDay : it.restDay}
      </span>
    </section>

    ${renderDateNavigation(selectedDate)}

    ${renderNutritionSummary(entries)}

    <p class="help">
      ${it.lunchesUsePastaOrRice}
    </p>

    ${meals.map(meal => renderMealCard(meal, entries)).join("")}

    <section class="card">
      <h2>${it.diaryBackup}</h2>

      <p class="help">
        ${it.entriesAreStoredInThis}
      </p>

      <button
        class="button secondary"
        id="export"
      >
        ${it.exportJson}
      </button>
    </section>
  `;
}
