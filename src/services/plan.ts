import type { Food, Meal, MealPlan } from "../models/types";
import { clone, createId, parseDate } from "../utils/helpers";

/** Weekdays in the order they are shown: Monday first. Values are `Date.getDay()` numbers. */
export const WEEKDAYS: readonly (readonly [number, string, string])[] = [
  [1, "Lun", "Lunedì"],
  [2, "Mar", "Martedì"],
  [3, "Mer", "Mercoledì"],
  [4, "Gio", "Giovedì"],
  [5, "Ven", "Venerdì"],
  [6, "Sab", "Sabato"],
  [0, "Dom", "Domenica"],
];

export function weekdayOf(date: string): number {
  return parseDate(date).getDay();
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS.find(([value]) => value === weekday)?.[2] ?? "";
}

/** Meals planned for a calendar day. */
export function mealsForDate(plan: MealPlan, date: string): Meal[] {
  return plan.days[weekdayOf(date)] ?? [];
}

export function isGymDay(plan: MealPlan, date: string): boolean {
  return plan.gymDays.includes(weekdayOf(date));
}

/** Whether two lists hold the same foods in the same quantities, in any order. */
export function sameFoods(a: Food[], b: Food[]): boolean {
  const key = (food: Food) => `${food.name.trim().toLowerCase()}|${food.amount}|${food.unit}`;
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** Planned foods never carry a nutrition snapshot: their macros follow the catalog. */
export function asPlannedFood(food: Food): Food {
  const { nutrition: _nutrition, ...planned } = food;
  return planned;
}

/** Copy of a day's meals with fresh food ids, to paste onto another weekday. */
export function copyMeals(meals: Meal[]): Meal[] {
  return clone(meals).map((meal) => ({
    ...meal,
    foods: meal.foods.map((food) => ({ ...food, id: createId() })),
  }));
}

/** New plan with one meal of one weekday replaced. */
export function withMealFoods(plan: MealPlan, weekday: number, mealId: string, foods: Food[]): MealPlan {
  const next = clone(plan);
  next.days[weekday] = (next.days[weekday] ?? []).map((meal) =>
    meal.id === mealId ? { ...meal, foods: foods.map(asPlannedFood) } : meal,
  );
  return next;
}
