import type { Food, Entry, Diary } from "../models/types";
import { getDateKey, parseDate } from "../utils/date";
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = parseDate(value);
  return !Number.isNaN(date.getTime()) && getDateKey(date) === value;
}
export function isFood(value: unknown): value is Food {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === "string" && typeof value.name === "string" && typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount > 0 && typeof value.unit === "string";
}
export function isEntry(value: unknown): value is Entry {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.mealId === "string" && Array.isArray(value.foods) && value.foods.every(isFood);
}
export function isDiary(value: unknown): value is Diary {
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).every(([date, entries]) => {
    return isValidDateKey(date) && Array.isArray(entries) && entries.every(isEntry);
  });
}
