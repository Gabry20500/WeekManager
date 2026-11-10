import type { NutritionSnapshot } from "../services/nutrition";
export type Screen = "today" | "shopping" | "weight";
export type Food = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  nutrition?: NutritionSnapshot;
};
export type Meal = {
  id: string;
  name: string;
  foods: Food[];
};
export type Entry = {
  mealId: string;
  foods: Food[];
};
export type Diary = Record<string, Entry[]>;
export type MealEditor = {
  date: string;
  meal: Meal;
  foods: Food[];
};
