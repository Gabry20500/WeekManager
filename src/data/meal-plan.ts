import type { Food, Meal, MealPlan } from "../models/types";
import { createFood } from "../utils/helpers";

const food = createFood;

/** Weekdays (0 = Sunday) that are gym days in the default plan. */
const DEFAULT_GYM_DAYS = [1, 3, 5];

/* Lunches and dinners, indexed by weekday: Sunday first, Saturday last. */

const lunches = (): Food[][] => [
  [food("Pasta (a crudo)", 120), food("Mozzarella", 125), food("Verdure", 200), food("Olio EVO", 15)],
  [food("Pasta (a crudo)", 120), food("Tonno al naturale", 2, "scatolette"), food("Verdure", 200), food("Olio EVO", 15)],
  [food("Pasta (a crudo)", 120), food("Carne (a crudo)", 150), food("Insalata", 80), food("Olio EVO", 15)],
  [food("Riso (a crudo)", 120), food("Legumi già cotti", 200), food("Verdure", 200), food("Olio EVO", 15)],
  [food("Riso (a crudo)", 120), food("Salmone (a crudo)", 120), food("Verdure", 200), food("Olio EVO", 15)],
  [food("Pasta (a crudo)", 120), food("Ricotta", 200), food("Verdure", 200), food("Olio EVO", 15)],
  [food("Pasta (a crudo)", 100), food("Legumi già cotti", 200), food("Grana", 10), food("Verdure", 200), food("Olio EVO", 15)],
];

const dinners = (): Food[][] => [
  [food("Uova", 2, "pezzi"), food("Grana", 15), food("Pane", 120), food("Verdure", 200), food("Olio EVO", 15), food("Mela", 1, "porzioni")],
  [food("Petto di pollo (a crudo)", 200), food("Patate (a crudo; sostituzione da definire)", 400), food("Pane", 80), food("Verdure", 200), food("Olio EVO", 20), food("Frutta", 1, "porzioni")],
  [food("Uova", 2, "pezzi"), food("Grana", 15), food("Frise (sostituzione con pane da definire)", 2, "pezzi"), food("Verdure", 200), food("Olio EVO", 20), food("Frutta", 1, "porzioni")],
  [food("Merluzzo (a crudo)", 250), food("Pane", 120), food("Verdure", 200), food("Olio EVO", 20), food("Frutta", 1, "porzioni")],
  [food("Fesa di tacchino (a crudo)", 200), food("Pane", 120), food("Verdure", 200), food("Olio EVO", 20), food("Frutta", 1, "porzioni")],
  [food("Legumi già cotti", 200), food("Pane", 120), food("Verdure", 200), food("Olio EVO", 20), food("Frutta", 1, "porzioni")],
  [],
];

function defaultDay(weekday: number): Meal[] {
  const gymDay = DEFAULT_GYM_DAYS.includes(weekday);
  return [
    {
      id: "breakfast",
      name: "Colazione",
      foods: [food("Latte parzialmente scremato", 250, "ml"), food("Riso soffiato", 50), food("Yogurt greco bianco 0%", 150), food("Caffè", 1, "tazze")],
    },
    { id: "morning", name: "Spuntino mattina", foods: [food("Frutta", 150), food("Mandorle", 20)] },
    { id: "lunch", name: "Pranzo", foods: lunches()[weekday] ?? [] },
    {
      id: "afternoon",
      name: "Spuntino pomeriggio",
      foods: gymDay
        ? [food("Pane", 2, "fette"), food("Marmellata", 2, "cucchiai")]
        : [food("Yogurt greco bianco 0%", 150), food("Frutta", 150)],
    },
    { id: "dinner", name: weekday === 6 ? "Cena libera" : "Cena", foods: dinners()[weekday] ?? [] },
    { id: "extras", name: "Extra fuori pasto", foods: [] },
  ];
}

/** The plan the app starts with; the user can then change it from the Plan screen. */
export function createDefaultPlan(): MealPlan {
  return {
    days: Array.from({ length: 7 }, (_, weekday) => defaultDay(weekday)),
    gymDays: [...DEFAULT_GYM_DAYS],
  };
}
