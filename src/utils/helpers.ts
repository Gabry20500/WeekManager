import type { Food } from "../models/types";
export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
export function createFood(name: string, amount: number, unit = "g"): Food {
  return {
    id: createId(),
    name,
    amount,
    unit
  };
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}
export function isGymDay(date: string): boolean {
  return [1, 3, 5].includes(parseDate(date).getDay());
}
export function html(value: string): string {
  return value.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]!);
}
export function format(value: number): string {
  return value.toLocaleString("it-IT", {
    maximumFractionDigits: 1
  });
}
export function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
export function unitLabel(unit: string): string {
  return ({
    g: "g",
    ml: "ml",
    pezzi: "pezzi",
    fette: "fette",
    scatolette: "scatolette",
    cucchiai: "cucchiai",
    porzioni: "porzioni",
    tazze: "tazze"
  } as Record<string, string>)[unit] ?? unit;
}
