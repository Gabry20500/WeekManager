import { it } from "../locales/it";
import type { Food, Meal, Entry } from "../models/types";
import { escapeHtml, formatAmount } from "../utils/html";
import { getUnitLabel } from "../utils/units";
import { renderMealNutrition } from "../services/nutrition";
export function renderFoodList(foods: Food[]): string {
  if (foods.length === 0) {
    return `
      <li>
        ${it.noFoodsListedAddWhat}
      </li>
    `;
  }
  return foods.map(food => `
        <li>
          ${escapeHtml(food.name)}
          ·
          ${formatAmount(food.amount)}
          ${escapeHtml(getUnitLabel(food.unit))}
        </li>
      `).join("");
}
export function renderMealCard(meal: Meal, entries: Entry[]): string {
  const entry = entries.find(item => item.mealId === meal.id);
  const displayedFoods = entry ? entry.foods : meal.foods;
  return `
    <article class="card meal">
      <div class="section-heading">
        <h2>${escapeHtml(meal.name)}</h2>

        <span class="badge ${entry ? "" : "subtle"}">
          ${entry ? it.logged : it.planned}
        </span>
      </div>

      <ul class="food-list">
        ${renderFoodList(displayedFoods)}
      </ul>

      ${entry ? renderMealNutrition(entry) : ""}
      <div class="actions">
        <button
          class="button primary"
          data-edit="${meal.id}"
        >
          ${entry ? it.editEntry : it.logEditMeal}
        </button>

        ${entry ? `
              <button
                class="button secondary"
                data-reset="${meal.id}"
              >
                ${it.removeEntry}
              </button>
            ` : ""}
      </div>
    </article>
  `;
}
