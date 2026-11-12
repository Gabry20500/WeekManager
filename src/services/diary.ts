import type { Diary, Entry, Meal, MealPlan, Profile } from "../models/types";
import { totalNutrition } from "./nutrition";
import { mealsForDate, sameFoods } from "./plan";
import { shiftDate } from "../utils/helpers";

const RECENT_LIMIT = 30;

/** Profile ids of the foods logged most recently, newest first, without repeats. */
export function recentProfileIds(diary: Diary): string[] {
  const ids = new Set<string>();
  for (const date of Object.keys(diary).sort().reverse()) {
    for (const entry of diary[date] ?? []) {
      for (const food of entry.foods) {
        const id = food.profileId ?? food.nutrition?.profileId;
        if (id) ids.add(id);
      }
    }
    if (ids.size >= RECENT_LIMIT) break;
  }
  return [...ids].slice(0, RECENT_LIMIT);
}

export type DayCalories = {
  date: string;
  /** kcal of the logged meals; `undefined` when nothing was logged. */
  consumed: number | undefined;
  /** kcal of the plan for that weekday. */
  planned: number;
};

/**
 * Consumed and planned calories of the `days` days ending on `lastDate`.
 * The planned value comes from the current plan: past changes to the plan
 * are not kept.
 */
export function caloriesByDay(
  diary: Diary,
  plan: MealPlan,
  profiles: Profile[],
  lastDate: string,
  days: number,
): DayCalories[] {
  return Array.from({ length: days }, (_, index) => {
    const date = shiftDate(lastDate, index - days + 1);
    const entries = diary[date] ?? [];
    const logged = entries.flatMap((entry) => entry.foods);
    const planned = mealsForDate(plan, date).flatMap((meal) => meal.foods);
    return {
      date,
      consumed: entries.length ? totalNutrition(logged, profiles, false).total.kcal : undefined,
      planned: totalNutrition(planned, profiles, true).total.kcal,
    };
  });
}

export type MealStatus = "asPlanned" | "changed" | "missing";

/** How a planned meal was logged. Old entries without the flag are compared with the current plan. */
export function mealStatus(meal: Meal, entry: Entry | undefined): MealStatus {
  if (!entry) return "missing";
  const asPlanned = entry.asPlanned ?? sameFoods(entry.foods, meal.foods);
  return asPlanned ? "asPlanned" : "changed";
}

export type WeekAdherence = Record<MealStatus, number> & {
  /** Monday of the week. */
  start: string;
  /** Last day counted: Sunday, or `lastDate` for the current week. */
  end: string;
};

/** Monday on or before a date. */
function mondayOf(date: string): string {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return shiftDate(date, -((weekday + 6) % 7));
}

/**
 * For each of the last `weeks` weeks (Monday to Sunday, the current one up
 * to `lastDate`), how many planned meals were logged as planned, changed or
 * not logged. Meals without planned foods are not counted.
 */
export function adherenceByWeek(diary: Diary, plan: MealPlan, lastDate: string, weeks: number): WeekAdherence[] {
  const currentMonday = mondayOf(lastDate);
  return Array.from({ length: weeks }, (_, index) => {
    const start = shiftDate(currentMonday, (index - weeks + 1) * 7);
    const sunday = shiftDate(start, 6);
    const end = sunday < lastDate ? sunday : lastDate;
    const week: WeekAdherence = { start, end, asPlanned: 0, changed: 0, missing: 0 };

    for (let date = start; date <= end; date = shiftDate(date, 1)) {
      for (const meal of mealsForDate(plan, date)) {
        if (!meal.foods.length) continue;
        week[mealStatus(meal, (diary[date] ?? []).find((entry) => entry.mealId === meal.id))]++;
      }
    }
    return week;
  });
}
