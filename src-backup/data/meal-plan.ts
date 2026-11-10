import { it } from "../locales/it";
import type { Food, Meal } from "../models/types";
import { createFood } from "../utils/data";
import { parseDate, isGymDay } from "../utils/date";
export function getMealPlan(date: string): Meal[] {
  const weekday = parseDate(date).getDay();

  // Array order: Sunday, Monday, Tuesday, Wednesday,
  // Thursday, Friday, Saturday.
  const lunches: Food[][] = [[createFood("Pasta (a crudo)", 120), createFood("Mozzarella", 125), createFood("Verdure", 200), createFood("Olio EVO", 15)], [createFood("Pasta (a crudo)", 120), createFood("Tonno al naturale", 2, "scatolette"), createFood("Verdure", 200), createFood("Olio EVO", 15)], [createFood("Pasta (a crudo)", 120), createFood("Carne (a crudo)", 150), createFood("Insalata", 80), createFood("Olio EVO", 15)], [createFood("Riso (a crudo)", 120), createFood("Legumi già cotti", 200), createFood("Verdure", 200), createFood("Olio EVO", 15)], [createFood("Riso (a crudo)", 120), createFood("Salmone (a crudo)", 120), createFood("Verdure", 200), createFood("Olio EVO", 15)], [createFood("Pasta (a crudo)", 120), createFood("Ricotta", 200), createFood("Verdure", 200), createFood("Olio EVO", 15)], [createFood("Pasta (a crudo)", 100), createFood("Legumi già cotti", 200), createFood("Grana", 10), createFood("Verdure", 200), createFood("Olio EVO", 15)]];
  const dinners: Food[][] = [[createFood("Uova", 2, "pezzi"), createFood("Grana", 15), createFood("Pane", 120), createFood("Verdure", 200), createFood("Olio EVO", 15), createFood("Mela", 1, "porzioni")], [createFood("Petto di pollo (a crudo)", 200), createFood("Patate (a crudo; sostituzione da definire)", 400), createFood("Pane", 80), createFood("Verdure", 200), createFood("Olio EVO", 20), createFood("Frutta", 1, "porzioni")], [createFood("Uova", 2, "pezzi"), createFood("Grana", 15), createFood("Frise (sostituzione con pane da definire)", 2, "pezzi"), createFood("Verdure", 200), createFood("Olio EVO", 20), createFood("Frutta", 1, "porzioni")], [createFood("Merluzzo (a crudo)", 250), createFood("Pane", 120), createFood("Verdure", 200), createFood("Olio EVO", 20), createFood("Frutta", 1, "porzioni")], [createFood("Fesa di tacchino (a crudo)", 200), createFood("Pane", 120), createFood("Verdure", 200), createFood("Olio EVO", 20), createFood("Frutta", 1, "porzioni")], [createFood("Legumi già cotti", 200), createFood("Pane", 120), createFood("Verdure", 200), createFood("Olio EVO", 20), createFood("Frutta", 1, "porzioni")], []];
  const afternoonFoods = isGymDay(date) ? [createFood("Pane", 2, "fette"), createFood("Marmellata", 2, "cucchiai")] : [createFood("Yogurt greco bianco 0%", 150), createFood("Frutta", 150)];
  return [{
    id: "breakfast",
    name: it.breakfast,
    foods: [createFood("Latte parzialmente scremato", 250, "ml"), createFood("Riso soffiato", 50), createFood("Yogurt greco bianco 0%", 150), createFood("Caffè", 1, "tazze")]
  }, {
    id: "morning",
    name: it.morningSnack,
    foods: [createFood("Frutta", 150), createFood("Mandorle", 20)]
  }, {
    id: "lunch",
    name: it.lunch,
    foods: lunches[weekday] ?? []
  }, {
    id: "afternoon",
    name: it.afternoonSnack,
    foods: afternoonFoods
  }, {
    id: "dinner",
    name: weekday === 6 ? it.freeChoiceDinner : it.dinner,
    foods: dinners[weekday] ?? []
  }, {
    id: "extras",
    name: it.extrasOutsideMeals,
    foods: []
  }];
}
