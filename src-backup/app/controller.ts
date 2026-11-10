import { it } from "../locales/it";
import type { Screen, Diary, MealEditor, Food, Entry } from "../models/types";
import { getDateKey, parseDate } from "../utils/date";
import { escapeHtml } from "../utils/html";
import { clone, createFood, createId } from "../utils/data";
import { isDiary } from "../services/validation";
import { getMealPlan } from "../data/meal-plan";
import { renderTodayScreen } from "../screens/today";
import { renderShoppingScreen } from "../screens/shopping";
import { renderWeightScreen } from "../screens/weight";
import { renderNavigation } from "../components/navigation";
import { renderEditorFood } from "../components/editor-food";
import { attachEditorNutrition, captureNutrition, openLibrary } from "../components/nutrition-editor";
const STORAGE_KEY = "diario-alimentare:diary:v1";
let currentScreen: Screen = "today";
let selectedDate = getDateKey(new Date());
let diary: Diary = {};
let storageWarning = "";
let mealEditor: MealEditor | null = null;
let app: HTMLDivElement;
function loadDiary(): void {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) {
      return;
    }
    const parsedData: unknown = JSON.parse(savedData);
    if (!isDiary(parsedData)) {
      throw new Error("Invalid diary format.");
    }
    diary = parsedData;
  } catch {
    storageWarning = it.storedDataCouldNotBe2 + it.toAvoidOverwritingTheExisting;
  }
}
function saveDiary(nextDiary: Diary): boolean {
  if (storageWarning) {
    window.alert(storageWarning);
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDiary));
    diary = nextDiary;
    return true;
  } catch {
    window.alert(it.theDiaryCouldNotBe);
    return false;
  }
}
function exportDiary(): void {
  try {
    // Preserve the original archive if loading failed.
    const contents = storageWarning ? localStorage.getItem(STORAGE_KEY) : JSON.stringify(diary, null, 2);
    if (contents === null) {
      window.alert(it.noStoredArchiveIsAvailable);
      return;
    }
    const blob = new Blob([contents], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `food-diary-${getDateKey(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  } catch {
    window.alert(it.theBackupCouldNotBe);
  }
}
function render(): void {
  let screenMarkup: string;
  switch (currentScreen) {
    case "shopping":
      screenMarkup = renderShoppingScreen();
      break;
    case "weight":
      screenMarkup = renderWeightScreen();
      break;
    default:
      screenMarkup = renderTodayScreen(selectedDate, diary[selectedDate] ?? []);
      break;
  }
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <span class="brand">
          <span class="brand-mark">D</span>
          ${it.foodDiary2}
        </span>
      </header>

      <aside class="prototype">
        ${it.diarySavedLocallyMacrosShopping}
      </aside>

      ${storageWarning ? `
            <p class="prototype" role="alert">
              ${escapeHtml(storageWarning)}
            </p>
          ` : ""}

      <main>
        ${screenMarkup}
      </main>

      ${renderNavigation(currentScreen)}

      <dialog
        id="meal-editor"
        aria-label="${it.editMeal}"
      ></dialog>
    </div>
  `;
  bindNavigationEvents();
  bindTodayEvents();
  bindShoppingEvents();
  bindWeightEvents();
  if (currentScreen === "today") {
    bindNutritionLibrary();
  }
}
function bindNavigationEvents(): void {
  const buttons = app.querySelectorAll<HTMLButtonElement>("[data-screen]");
  buttons.forEach(button => {
    button.addEventListener("click", () => {
      currentScreen = button.dataset.screen as Screen;
      render();
      window.scrollTo(0, 0);
    });
  });
}
function shiftSelectedDate(days: number): void {
  const date = parseDate(selectedDate);
  date.setDate(date.getDate() + days);
  selectedDate = getDateKey(date);
  render();
}
function bindTodayEvents(): void {
  app.querySelector("#previous")?.addEventListener("click", () => {
    shiftSelectedDate(-1);
  });
  app.querySelector("#next")?.addEventListener("click", () => {
    shiftSelectedDate(1);
  });
  app.querySelector("#go-today")?.addEventListener("click", () => {
    selectedDate = getDateKey(new Date());
    render();
  });
  app.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const mealId = button.dataset.edit;
      if (mealId) {
        openMealEditor(mealId);
      }
    });
  });
  app.querySelectorAll<HTMLButtonElement>("[data-reset]").forEach(button => {
    button.addEventListener("click", () => {
      const mealId = button.dataset.reset;
      if (mealId) {
        removeMealEntry(mealId);
      }
    });
  });
  app.querySelector("#export")?.addEventListener("click", exportDiary);
}
function removeMealEntry(mealId: string): void {
  const confirmed = window.confirm(it.removeTheConsumedFoodEntry2 + it.thePlannedMenuWillRemain);
  if (!confirmed) {
    return;
  }
  const nextDiary = clone(diary);
  nextDiary[selectedDate] = (nextDiary[selectedDate] ?? []).filter(entry => entry.mealId !== mealId);
  if (saveDiary(nextDiary)) {
    render();
  }
}
function bindShoppingEvents(): void {
  const shoppingTab = app.querySelector<HTMLButtonElement>("#shopping-tab");
  const stockTab = app.querySelector<HTMLButtonElement>("#stock-tab");
  const shoppingPanel = app.querySelector<HTMLElement>("#shopping-panel");
  const stockPanel = app.querySelector<HTMLElement>("#stock-panel");
  function selectPantry(showPantry: boolean): void {
    shoppingTab?.classList.toggle("active", !showPantry);
    stockTab?.classList.toggle("active", showPantry);
    shoppingTab?.setAttribute("aria-selected", String(!showPantry));
    stockTab?.setAttribute("aria-selected", String(showPantry));
    if (shoppingPanel) {
      shoppingPanel.hidden = showPantry;
    }
    if (stockPanel) {
      stockPanel.hidden = !showPantry;
    }
  }
  shoppingTab?.addEventListener("click", () => {
    selectPantry(false);
  });
  stockTab?.addEventListener("click", () => {
    selectPantry(true);
  });
}
function bindWeightEvents(): void {
  app.querySelector<HTMLFormElement>("#weight-form")?.addEventListener("submit", event => {
    event.preventDefault();
    window.alert(it.weightSavingWillBeAdded);
  });
}
function openMealEditor(mealId: string): void {
  const meal = getMealPlan(selectedDate).find(item => item.id === mealId);
  if (!meal) {
    return;
  }
  const existingEntry = (diary[selectedDate] ?? []).find(entry => entry.mealId === mealId);
  mealEditor = {
    date: selectedDate,
    meal,
    foods: clone(existingEntry ? existingEntry.foods : meal.foods)
  };
  renderMealEditor();
  const dialog = app.querySelector<HTMLDialogElement>("#meal-editor");
  if (dialog) {
    dialog.oncancel = () => {
      mealEditor = null;
    };
    dialog.showModal();
  }
}
function renderMealEditor(): void {
  if (!mealEditor) {
    return;
  }
  const dialog = app.querySelector<HTMLDialogElement>("#meal-editor");
  if (!dialog) {
    return;
  }
  dialog.innerHTML = `
    <h2>${escapeHtml(mealEditor.meal.name)}</h2>

    <p class="help">
      ${escapeHtml(mealEditor.date)} · ${it.enterTheAmountsYouActually}
    </p>

    <form id="meal-form">
      <div>
        ${mealEditor.foods.map(renderEditorFood).join("")}
      </div>

      <button
        type="button"
        id="add-food"
        class="button secondary full"
      >
        ${it.addFoodExtra}
      </button>

      <div class="actions editor-actions">
        <button
          type="submit"
          class="button primary"
        >
          ${it.confirmConsumedFoods}
        </button>

        <button
          type="button"
          id="cancel-edit"
          class="button secondary"
        >
          ${it.cancel}
        </button>
      </div>
    </form>
  `;
  bindMealEditorEvents(dialog);
  attachEditorNutrition(dialog, mealEditor.foods);
}
function readEditorFoods(dialog: HTMLDialogElement): {
  foods: Food[];
  valid: boolean;
} {
  const foods: Food[] = [];
  let valid = true;
  const rows = dialog.querySelectorAll<HTMLElement>("[data-food]");
  rows.forEach(row => {
    const nameInput = row.querySelector<HTMLInputElement>('[data-key="name"]');
    const amountInput = row.querySelector<HTMLInputElement>('[data-key="amount"]');
    const unitSelect = row.querySelector<HTMLSelectElement>('[data-key="unit"]');
    if (!nameInput || !amountInput || !unitSelect) {
      valid = false;
      return;
    }
    const name = nameInput.value.trim();
    const amount = amountInput.valueAsNumber;
    const unit = unitSelect.value;
    if (!name || !Number.isFinite(amount) || amount < 0.01) {
      valid = false;
    }
    foods.push({
      id: row.dataset.food ?? createId(),
      name,
      amount,
      unit
    });
  });
  return {
    foods,
    valid
  };
}
function synchronizeEditor(dialog: HTMLDialogElement): boolean {
  if (!mealEditor) {
    return false;
  }
  const result = readEditorFoods(dialog);
  if (!result.valid) {
    return false;
  }
  const captured = captureNutrition(dialog, result.foods, mealEditor.foods);
  if (!captured) {
    return false;
  }
  mealEditor.foods = captured;
  return true;
}
function confirmMealEntry(dialog: HTMLDialogElement): void {
  if (!synchronizeEditor(dialog) || !mealEditor) {
    window.alert(it.enterANameAndAn);
    return;
  }
  if (mealEditor.foods.length === 0) {
    const confirmed = window.confirm(it.confirmThisMealWithNo);
    if (!confirmed) {
      return;
    }
  }
  const editor = mealEditor;
  const nextDiary = clone(diary);
  const existingEntries = nextDiary[editor.date] ?? [];
  const updatedEntry: Entry = {
    mealId: editor.meal.id,
    foods: clone(editor.foods)
  };
  nextDiary[editor.date] = [...existingEntries.filter(entry => entry.mealId !== editor.meal.id), updatedEntry];
  if (saveDiary(nextDiary)) {
    mealEditor = null;
    dialog.close();
    render();
  }
}
function bindMealEditorEvents(dialog: HTMLDialogElement): void {
  dialog.querySelector("#add-food")?.addEventListener("click", () => {
    if (!mealEditor) return;
    const form = dialog.querySelector<HTMLFormElement>("#meal-form");
    if (form && !form.reportValidity()) return;
    if (!synchronizeEditor(dialog)) return;
    mealEditor.foods.push(createFood("", 100));
    renderMealEditor();
    const inputs = dialog.querySelectorAll<HTMLInputElement>('[data-key="name"]');
    inputs.item(inputs.length - 1)?.focus();
  });
  dialog.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      // Remove only this draft row. Other input values remain untouched.
      button.closest<HTMLElement>("[data-food]")?.remove();
    });
  });
  dialog.querySelector("#cancel-edit")?.addEventListener("click", () => {
    mealEditor = null;
    dialog.close();
  });
  dialog.querySelector<HTMLFormElement>("#meal-form")?.addEventListener("submit", event => {
    event.preventDefault();
    confirmMealEntry(dialog);
  });
}
function bindNutritionLibrary(): void {
  app.querySelector("#nutrition-library")?.addEventListener("click", () => openLibrary());
}
export function startApplication(): void {
  const element = document.querySelector<HTMLDivElement>("#app");
  if (!element) throw new Error("The #app element was not found.");
  app = element;
  loadDiary();
  render();
}
