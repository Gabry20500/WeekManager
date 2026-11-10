import { it } from "../locales/it";
import { escapeHtml } from "../utils/html";
export function renderShoppingScreen(): string {
  const exampleProducts = [["Pasta", "500 g"], ["Riso", "500 g"], ["Pane", it.toBeDefined], ["Mele", "1 kg"]];
  const productMarkup = exampleProducts.map(([name, amount]) => `
        <label class="shopping-row">
          <input type="checkbox">

          <span class="item-copy">
            <strong>${escapeHtml(name ?? "")}</strong>
            <small>${escapeHtml(amount ?? "")}</small>
          </span>
        </label>
      `).join("");
  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">${it.comingNext}</p>
        <h1>${it.shoppingAndPantry}</h1>

        <p class="muted">
          ${it.demonstrationDataChangesAreNot}
        </p>
      </div>
    </section>

    <div
      class="tabs"
      role="tablist"
      aria-label="${it.shoppingAndPantry}"
    >
      <button
        id="shopping-tab"
        class="active"
        role="tab"
        aria-selected="true"
        aria-controls="shopping-panel"
      >
        ${it.shoppingList}
      </button>

      <button
        id="stock-tab"
        role="tab"
        aria-selected="false"
        aria-controls="stock-panel"
      >
        ${it.pantry}
      </button>
    </div>

    <section
      id="shopping-panel"
      role="tabpanel"
      aria-labelledby="shopping-tab"
    >
      <article class="card">
        <h2>${it.exampleList}</h2>

        ${productMarkup}

        <p class="help">
          ${it.checkboxesResetWhenYouLeave}
        </p>
      </article>
    </section>

    <section
      id="stock-panel"
      role="tabpanel"
      aria-labelledby="stock-tab"
      hidden
    >
      <article class="card">
        <h2>${it.yogurtExample}</h2>
        <p class="stock-quantity">300 g</p>
        <p class="muted">${it.useByOctober}</p>
      </article>

      <article class="card">
        <h2>${it.meleExample}</h2>
        <p class="stock-quantity">850 g</p>
        <p class="muted">${it.noExpiryDateSet}</p>
      </article>
    </section>
  `;
}
