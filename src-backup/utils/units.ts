import { it } from "../locales/it";
export const FOOD_UNITS = ["g", "ml", "pezzi", "fette", "scatolette", "cucchiai", "porzioni", "tazze"];
const UNIT_LABELS: Record<string, string> = {
  g: "g",
  ml: "ml",
  pezzi: it.pieces,
  fette: it.slices,
  scatolette: it.cans,
  cucchiai: it.tablespoons,
  porzioni: it.servings,
  tazze: it.cups
};
export function getUnitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit;
}
