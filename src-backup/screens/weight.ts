import { it } from "../locales/it";
import { getDateKey } from "../utils/date";
export function renderWeightScreen(): string {
  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">${it.comingNext}</p>
        <h1>${it.weight}</h1>
      </div>
    </section>

    <section class="card">
      <h2>${it.newWeighIn}</h2>

      <form id="weight-form">
        <label class="field">
          ${it.date}

          <input
            type="date"
            required
            value="${getDateKey(new Date())}"
          >
        </label>

        <label class="field">
          ${it.weightInKg}

          <input
            type="number"
            min="1"
            step="0.1"
            inputmode="decimal"
            required
            placeholder="${it.eG}"
          >
        </label>

        <label class="field">
          ${it.optionalNote}
          <textarea rows="2"></textarea>
        </label>

        <button
          class="button primary full"
          type="submit"
        >
          ${it.logWeight}
        </button>
      </form>

      <p class="help">
        ${it.demonstrationFormWeightIsNot}
      </p>
    </section>

    <section class="card">
      <h2>${it.progress}</h2>

      <div class="empty-chart">
        <h3>${it.yourChartWillAppearHere}</h3>
        <p>${it.noExampleWeightValuesHave}</p>
      </div>
    </section>
  `;
}
