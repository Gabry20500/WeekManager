import type { Diary, PantryLot, Profile, Screen, ShoppingItem, WeightLog } from "../models/types";
import { it } from "../locales/it";
import { isBuiltinProfile } from "../data/food-catalog";
import { openDataDialog } from "../components/data-dialog";
import { rememberFocus, restoreFocus, setFocusTarget, trackFocus } from "../utils/focus";
import { html, todayKey } from "../utils/helpers";
import {
  DIARY_KEY,
  PANTRY_KEY,
  PROFILE_KEY,
  SHOPPING_KEY,
  WEIGHT_KEY,
  exportOriginalArchives,
  getStorageWarning,
  loadDiary,
  loadPantry,
  loadProfiles,
  loadShopping,
  loadWeight,
  save,
} from "../services/storage";
import { bindShoppingScreen, renderShoppingScreen, type ShoppingView } from "../screens/shopping";
import { bindTodayScreen, renderTodayScreen } from "../screens/today";
import { bindWeightScreen, renderWeightScreen, type WeightRange } from "../screens/weight";

type AppState = {
  diary: Diary;
  profiles: Profile[];
  shopping: ShoppingItem[];
  pantry: PantryLot[];
  weight: WeightLog;
  weightRange: WeightRange;
  weightShowAll: boolean;
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

function loadData(): Pick<AppState, "diary" | "profiles" | "shopping" | "pantry" | "weight"> {
  return {
    diary: loadDiary(),
    profiles: loadProfiles(),
    shopping: loadShopping(),
    pantry: loadPantry(),
    weight: loadWeight(),
  };
}

/* Each setter updates the in-memory state only after the save succeeded. */

function saveDiary(next: Diary): boolean {
  if (!save(DIARY_KEY, next)) return false;
  state.diary = next;
  return true;
}

function saveProfile(profile: Profile): boolean {
  const next = [...state.profiles.filter((item) => item.id !== profile.id), profile];
  // Only personal profiles are stored; the built-in catalog ships with the app.
  if (!save(PROFILE_KEY, next.filter((item) => !isBuiltinProfile(item)))) return false;
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

function saveWeight(next: WeightLog): boolean {
  if (!save(WEIGHT_KEY, next)) return false;
  state.weight = next;
  return true;
}

function renderScreen(): string {
  switch (state.screen) {
    case "today":
      return renderTodayScreen(state);
    case "shopping":
      return renderShoppingScreen(state.shopping, state.pantry, state.shoppingTab);
    case "weight":
      return renderWeightScreen(state);
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
  rememberFocus();
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <span class="brand"><span class="brand-mark" aria-hidden="true">D</span>${it.appTitle}</span>
        <button class="button small secondary" id="open-data">${it.backup}</button>
      </header>
      ${renderStorageWarning()}
      <main>${renderScreen()}</main>
      <nav class="bottom-nav" aria-label="Navigazione principale">${renderNavigation()}</nav>
    </div>`;

  // The heading is the fallback focus target when a control disappears.
  app.querySelector("h1")?.setAttribute("tabindex", "-1");
  document.title = `${NAV_ITEMS.find((item) => item.screen === state.screen)?.label} – ${it.appTitle}`;

  app.querySelectorAll<HTMLButtonElement>("[data-screen]").forEach((button) =>
    button.addEventListener("click", () => {
      state.screen = button.dataset.screen as Screen;
      render();
      // A new screen starts from its heading.
      setFocusTarget("h1");
      restoreFocus();
      window.scrollTo(0, 0);
    }),
  );
  app.querySelector("#export-original")?.addEventListener("click", exportOriginalArchives);
  app.querySelector("#open-data")?.addEventListener("click", () =>
    openDataDialog(() => {
      Object.assign(state, loadData());
      render();
    }),
  );

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
      getShopping: () => state.shopping,
      getPantry: () => state.pantry,
      saveShopping,
      savePantry,
      rerender: render,
    });
  }

  if (state.screen === "weight") {
    bindWeightScreen(app, state, {
      saveWeight,
      getWeight: () => state.weight,
      setRange: (range) => {
        state.weightRange = range;
      },
      setShowAll: (showAll) => {
        state.weightShowAll = showAll;
      },
      rerender: render,
    });
  }

  restoreFocus();
}

export function startApplication(): void {
  const element = document.querySelector<HTMLDivElement>("#app");
  if (!element) throw new Error("Missing #app element");
  app = element;
  trackFocus(app);
  state = {
    ...loadData(),
    screen: "today",
    shoppingTab: "shopping",
    weightRange: "90",
    weightShowAll: false,
    selectedDate: todayKey(),
  };
  render();
}
