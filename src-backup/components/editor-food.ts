import { it } from "../locales/it";
import type { Food } from "../models/types";
import { FOOD_UNITS, getUnitLabel } from "../utils/units";
import { escapeHtml } from "../utils/html";
export function renderUnitOptions(selectedUnit: string): string {
  const units = FOOD_UNITS.includes(selectedUnit) ? FOOD_UNITS : [...FOOD_UNITS, selectedUnit];
  return units.map(unit => `
        <option
          value="${escapeHtml(unit)}"
          ${unit === selectedUnit ? "selected" : ""}
        >
          ${escapeHtml(getUnitLabel(unit))}
        </option>
      `).join("");
}
export function renderEditorFood(food: Food): string {
  return `
    <div
      class="editor-food"
      data-food="${escapeHtml(food.id)}"
    >
      <label class="field">
        ${it.food}

        <input
          data-key="name"
          value="${escapeHtml(food.name)}"
          required
          maxlength="160"
        >
      </label>

      <div class="editor-grid">
        <label class="field">
          ${it.amount}

          <input
            data-key="amount"
            type="number"
            min="0.01"
            step="any"
            inputmode="decimal"
            value="${food.amount}"
            required
          >
        </label>

        <label class="field">
          ${it.unit}

          <select data-key="unit">
            ${renderUnitOptions(food.unit)}
          </select>
        </label>
      </div>

      <button
        type="button"
        class="button secondary"
        data-remove="${escapeHtml(food.id)}"
      >
        ${it.removeFood}
      </button>
    </div>
  `;
}
