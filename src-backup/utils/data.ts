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
