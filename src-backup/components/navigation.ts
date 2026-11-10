import { it } from "../locales/it";
import type { Screen } from "../models/types";
export function renderNavigation(currentScreen: Screen): string {
  const items: {
    screen: Screen;
    icon: string;
    label: string;
  }[] = [{
    screen: "today",
    icon: "☀",
    label: it.today
  }, {
    screen: "shopping",
    icon: "▤",
    label: it.shopping
  }, {
    screen: "weight",
    icon: "↗",
    label: it.weight
  }];
  return `
    <nav
      class="bottom-nav"
      aria-label="${it.mainNavigation}"
    >
      ${items.map(item => `
            <button
              data-screen="${item.screen}"
              class="nav-item ${currentScreen === item.screen ? "selected" : ""}"
              ${currentScreen === item.screen ? 'aria-current="page"' : ""}
            >
              <span aria-hidden="true">${item.icon}</span>
              ${item.label}
            </button>
          `).join("")}
    </nav>
  `;
}
