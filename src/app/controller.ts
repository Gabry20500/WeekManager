import type { Diary, PantryLot, Profile, Screen, ShoppingItem } from "../models/types";
import { it } from "../locales/it";
import { html, todayKey } from "../utils/helpers";
import {
  DIARY_KEY,
  PANTRY_KEY,
  PROFILE_KEY,
  SHOPPING_KEY,
  exportOriginalArchives,
  getStorageWarning,
  loadDiary,
  loadPantry,
  loadProfiles,
  loadShopping,
  save,
} from "../services/storage";
import { bindShoppingScreen, renderShoppingScreen, type ShoppingView } from "../screens/shopping";
import { bindTodayScreen, renderTodayScreen } from "../screens/today";
import { renderWeightScreen } from "../screens/weight";

type AppState = {
  diary: Diary;
  profiles: Profile[];
  shopping: ShoppingItem[];
  pantry: PantryLot[];
  screen: Screen;
  shoppingTab: ShoppingView;
  selectedDate: string;
};

const NAV_ITEMS: readonly { screen: Screen; icon: string; label: string }[] = [
  { screen: "today", icon: "☀", label: it.today },
  { screen: "shopping", icon: "▤", label: it.shopping },
  { screen: "weight", icon: "↗", label: it.weight },
];

let app: HTMLDivElement;
let state: AppState;

/* Each setter updates the in-memory state only after the save succeeded. */

function saveDiary(next: Diary): boolean {
  if (!save(DIARY_KEY, next)) return false;
  state.diary = next;
  return true;
}

function saveProfile(profile: Profile): boolean {
  const next = [...state.profiles.filter((item) => item.id !== profile.id), profile];
  if (!save(PROFILE_KEY, next)) return false;
  state.profiles = next;
  return true;
}

function saveShopping(next: ShoppingItem[]): boolean {
  if (!save(SHOPPING_KEY, next)) return false;
  state.shopping = next;
  return true;
}

function savePantry(next: PantryLot[]): boolean {
  if (!save(PANTRY_KEY, next)) return false;
  state.pantry = next;
  return true;
}

function renderScreen(): string {
  switch (state.screen) {
    case "today":
      return renderTodayScreen(state);
    case "shopping":
      return renderShoppingScreen(state.shopping, state.pantry, state.shoppingTab);
    case "weight":
      return renderWeightScreen();
  }
}

function renderNavigation(): string {
  return NAV_ITEMS.map(({ screen, icon, label }) => {
    const selected = screen === state.screen;
    return `<button class="nav-item ${selected ? "selected" : ""}" data-screen="${screen}" ${selected ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon}</span>${label}</button>`;
  }).join("");
}

function renderStorageWarning(): string {
  const warning = getStorageWarning();
  if (!warning) return "";
  return `<p class="prototype" role="alert">${html(warning)} <button id="export-original" class="button secondary">Esporta dati originali</button></p>`;
}

function render(): void {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar"><span class="brand"><span class="brand-mark">D</span>${it.appTitle}</span></header>
      <aside class="prototype">Diario, alimenti e spesa attivi · peso in preparazione</aside>
      ${renderStorageWarning()}
      <main>${renderScreen()}</main>
      <nav class="bottom-nav" aria-label="Navigazione principale">${renderNavigation()}</nav>
    </div>`;

  app.querySelectorAll<HTMLButtonElement>("[data-screen]").forEach((button) =>
    button.addEventListener("click", () => {
      state.screen = button.dataset.screen as Screen;
      render();
      window.scrollTo(0, 0);
    }),
  );
  app.querySelector("#export-original")?.addEventListener("click", exportOriginalArchives);

  if (state.screen === "today") {
    bindTodayScreen(app, state, {
      selectDate: (date) => {
        state.selectedDate = date;
        render();
      },
      saveDiary,
      saveProfile,
      getProfiles: () => state.profiles,
      rerender: render,
    });
  }

  if (state.screen === "shopping") {
    bindShoppingScreen(app, state.shopping, state.pantry, state.shoppingTab, {
      setTab: (tab) => {
        state.shoppingTab = tab;
      },
      saveShopping,
      savePantry,
      rerender: render,
    });
  }
}

export function startApplication(): void {
  const element = document.querySelector<HTMLDivElement>("#app");
  if (!element) throw new Error("Missing #app element");
  app = element;
  state = {
    diary: loadDiary(),
    profiles: loadProfiles(),
    shopping: loadShopping(),
    pantry: loadPantry(),
    screen: "today",
    shoppingTab: "shopping",
    selectedDate: todayKey(),
  };
  render();
}
