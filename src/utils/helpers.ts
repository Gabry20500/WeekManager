import type { Food, Nutrients } from "../models/types";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const GYM_WEEKDAYS = [1, 3, 5];

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createFood(name: string, amount: number, unit = "g"): Food {
  return { id: createId(), name, amount, unit };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Local calendar day as `YYYY-MM-DD`. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

/** Parses a `YYYY-MM-DD` key at noon, so DST changes never shift the day. */
export function parseDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function shiftDate(date: string, days: number): string {
  const next = parseDate(date);
  next.setDate(next.getDate() + days);
  return dateKey(next);
}

export function isGymDay(date: string): boolean {
  return GYM_WEEKDAYS.includes(parseDate(date).getDay());
}

/** Escapes text for safe interpolation into HTML content and attributes. */
export function html(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

export function format(value: number): string {
  return value.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

export function formatMacros(value: Nutrients): string {
  return `${format(value.kcal)} kcal · P ${format(value.protein)} g · C ${format(value.carbs)} g · G ${format(value.fat)} g`;
}

/** Accent- and case-insensitive form used for search. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
