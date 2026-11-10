import type { Diary, PantryLot, Profile, Screen, Meal, ShoppingItem } from "../models/types";
import { it } from "../locales/it";
import { dateKey, parseDate, html, format, clone, isGymDay, unitLabel } from "../utils/helpers";
import { getMealPlan } from "../data/meal-plan";
import { findProfile, renderMacros, totalNutrition } from "../services/nutrition";
import {
  loadDiary,
  loadProfiles,
  loadShopping,
  loadPantry,
  save,
  DIARY_KEY,
  PROFILE_KEY,
  SHOPPING_KEY,
  PANTRY_KEY,
  downloadJson,
  storageWarning,
  exportOriginalArchives,
  importBackup,
} from "../services/storage";
import { openMealEditor } from "../components/meal-editor";
import { openProductEditor } from "../components/product-editor";
import { bindShoppingScreen, renderShoppingScreen, type ShoppingView } from "../screens/shopping";

let diary: Diary = {};
let profiles: Profile[] = [];
let shopping: ShoppingItem[] = [];
let pantry: PantryLot[] = [];
let currentScreen: Screen = "today";
let shoppingTab: ShoppingView = "shopping";
let selectedDate = dateKey(new Date());
let app: HTMLDivElement;

function saveProfile(profile: Profile): boolean {
  const next = [...profiles.filter((item) => item.id !== profile.id), profile];
  if (!save(PROFILE_KEY, next)) return false;
  profiles = next;
  return true;
}

function saveShoppingList(next: ShoppingItem[]): boolean {
  if (!save(SHOPPING_KEY, next)) return false;
  shopping = next;
  return true;
}

function savePantryLots(next: PantryLot[]): boolean {
  if (!save(PANTRY_KEY, next)) return false;
  pantry = next;
  return true;
}

function dateNavigation(): string {
  const date = parseDate(selectedDate);
  return `<div class="date-controls"><button id="previous" aria-label="Giorno precedente">←</button><div class="date-label" aria-live="polite"><span class="date-weekday">${date.toLocaleDateString("it-IT", { weekday: "long" })}</span><strong class="date-full">${date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</strong></div><button id="next" aria-label="Giorno successivo">→</button><button id="go-today" class="today-icon ${selectedDate === dateKey(new Date()) ? "is-today" : ""}" aria-label="Torna a oggi" title="Torna a oggi">📅</button></div>`;
}

function mealCard(meal: Meal): string {
  const entry = (diary[selectedDate] ?? []).find((item) => item.mealId === meal.id);
  const foods = entry?.foods ?? meal.foods;
  const totals = totalNutrition(foods, profiles, Boolean(entry));
  return `<article class="card meal"><div class="section-heading"><h2>${html(meal.name)}</h2><span class="badge ${entry ? "" : "subtle"}">${entry ? "Registrato" : "Previsto"}</span></div><ul class="food-list">${foods.map((food) => {
    const profile = findProfile(food, profiles);
    return `<li>${html(food.name)} · ${format(food.amount)} ${html(unitLabel(food.unit))}${!profile && !food.nutrition ? " <small class=\"muted\">· scheda nutrizionale mancante</small>" : ""}</li>`;
  }).join("") || "<li>Nessun alimento: aggiungi ciò che hai mangiato.</li>"}</ul><p class="help">${totals.known ? `${totals.missing ? "Totale parziale" : "Stima"}: ${format(totals.total.kcal)} kcal · P ${format(totals.total.protein)} g · C ${format(totals.total.carbs)} g · G ${format(totals.total.fat)} g` : totals.excluded ? "Solo alimenti esclusi dal calcolo macro." : "Alimenti o quantità da specificare."}</p><div class="actions"><button class="button primary" data-edit="${meal.id}">${entry ? it.editMeal : it.logMeal}</button>${entry ? '<button class="button secondary" data-reset="' + meal.id + '">Annulla registrazione</button>' : ""}</div></article>`;
}

function todayScreen(): string {
  const plan = getMealPlan(selectedDate);
  const consumed = (diary[selectedDate] ?? []).flatMap((entry) => entry.foods);
  return `<section class="page-heading"><div><p class="eyebrow">DIARIO ALIMENTARE</p><h1>La tua giornata</h1><p class="muted">Le macro previste arrivano dal piano, non dalla dispensa.</p></div><span class="badge">${isGymDay(selectedDate) ? "Palestra" : "Riposo"}</span></section>${dateNavigation()}${renderMacros(plan.flatMap((meal) => meal.foods), profiles, "Macro previsti", true)}${renderMacros(consumed, profiles, "Macro consumati", false)}<button class="button secondary full" id="products">Archivio alimenti / prodotto personale</button><p class="help">Se vedi trattini nei macro previsti, manca la scheda nutrizionale di uno o più alimenti del piano oppure il nome non combacia con l’archivio.</p>${plan.map(mealCard).join("")}`;
}

function weightPlaceholder(): string {
  return `<section class="page-heading"><div><p class="eyebrow">IN PREPARAZIONE</p><h1>Peso</h1></div></section><section class="card"><h2>Storico e grafico</h2><div class="empty-chart"><h3>Funzione non ancora attiva</h3><p>Le pesate e il grafico saranno aggiunti nel prossimo sviluppo.</p></div></section>`;
}

function render(): void {
  const screenMarkup = currentScreen === "today" ? todayScreen() : currentScreen === "shopping" ? renderShoppingScreen(shopping, pantry, shoppingTab) : weightPlaceholder();
  app.innerHTML = `<div class="app-shell"><header class="topbar"><span class="brand"><span class="brand-mark">D</span>${it.appTitle}</span></header><aside class="prototype">Diario, alimenti e spesa attivi · peso in preparazione</aside>${storageWarning ? `<p class="prototype" role="alert">${html(storageWarning)} <button id="export-original" class="button secondary">Esporta dati originali</button></p>` : ""}<main>${screenMarkup}</main><nav class="bottom-nav" aria-label="Navigazione principale">${([ ["today", "☀", it.today], ["shopping", "▤", it.shopping], ["weight", "↗", it.weight], ] as const).map(([screen, icon, label]) => `<button class="nav-item ${screen === currentScreen ? "selected" : ""}" data-screen="${screen}" ${screen === currentScreen ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon}</span>${label}</button>`).join("")}</nav></div>`;

  app.querySelectorAll<HTMLButtonElement>("[data-screen]").forEach((button) => button.addEventListener("click", () => { currentScreen = button.dataset.screen as Screen; render(); window.scrollTo(0, 0); }));
  const shift = (days: number) => { const date = parseDate(selectedDate); date.setDate(date.getDate() + days); selectedDate = dateKey(date); render(); };
  app.querySelector("#previous")?.addEventListener("click", () => shift(-1));
  app.querySelector("#next")?.addEventListener("click", () => shift(1));
  app.querySelector("#go-today")?.addEventListener("click", () => { selectedDate = dateKey(new Date()); render(); });

  if (currentScreen === "today") {
    app.querySelector("#products")?.addEventListener("click", () => openProductEditor(profiles, saveProfile, render));
    app.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => button.addEventListener("click", () => {
      const meal = getMealPlan(selectedDate).find((item) => item.id === button.dataset.edit);
      if (!meal) return;
      const date = selectedDate;
      const entry = (diary[date] ?? []).find((item) => item.mealId === meal.id);
      openMealEditor(meal, date, entry?.foods, () => profiles, saveProfile, (foods) => {
        const next = clone(diary);
        next[date] = [...(next[date] ?? []).filter((item) => item.mealId !== meal.id), { mealId: meal.id, foods }];
        if (!save(DIARY_KEY, next)) return false;
        diary = next;
        render();
        return true;
      });
    }));

    app.querySelectorAll<HTMLButtonElement>("[data-reset]").forEach((button) => button.addEventListener("click", () => {
      if (!confirm("Annullare la registrazione? Il menu previsto rimarrà disponibile.")) return;
      const next = clone(diary);
      next[selectedDate] = (next[selectedDate] ?? []).filter((item) => item.mealId !== button.dataset.reset);
      if (save(DIARY_KEY, next)) { diary = next; render(); }
    }));

    app.querySelector("#export-original")?.addEventListener("click", exportOriginalArchives);
  }

  if (currentScreen === "shopping") {
    bindShoppingScreen(app, shopping, pantry, profiles, shoppingTab, (tab) => { shoppingTab = tab; }, {
      saveShopping: saveShoppingList,
      savePantry: savePantryLots,
      rerender: render,
    });
  }
}

export function startApplication(): void {
  const element = document.querySelector<HTMLDivElement>("#app");
  if (!element) throw new Error("Missing #app element");
  app = element;
  diary = loadDiary();
  profiles = loadProfiles();
  shopping = loadShopping();
  pantry = loadPantry();
  render();
}
