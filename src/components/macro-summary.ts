import type { Food, Profile } from "../models/types";
import { MACRO_KEYS, totalNutrition } from "../services/nutrition";
import { format, formatMacros, html } from "../utils/helpers";

const MACRO_LABELS = {
  kcal: ["Calories", "kcal"],
  protein: ["Protein", "g"],
  carbs: ["Carbs", "g"],
  fat: ["Fat", "g"],
} as const;

const MAX_MISSING_LISTED = 4;

/** Card with the four macro totals of a list of foods. */
export function renderMacros(foods: Food[], profiles: Profile[], title: string, includeProfiles = true): string {
  const result = totalNutrition(foods, profiles, includeProfiles);
  const complete = result.known > 0 && result.missing === 0;
  const badge = result.known ? (result.missing ? "Parziale" : "Calcolato") : "Da completare";

  const details = result.known
    ? `${result.missing ? "Valori parziali" : "Valori stimati"}: ${formatMacros(result.total)}`
    : "Nessun macro calcolato.";

  const notes = [
    result.excluded ? `Esclusi ${result.excluded} alimento/i senza impatto macro.` : "",
    result.missingFoods.length
      ? `Mancano schede per: ${result.missingFoods.slice(0, MAX_MISSING_LISTED).map(html).join(", ")}${result.missingFoods.length > MAX_MISSING_LISTED ? "…" : ""}`
      : "",
  ].filter(Boolean);

  const cells = MACRO_KEYS.map((key) => {
    const [label, unit] = MACRO_LABELS[key];
    return `<div class="macro"><span>${label}</span><strong>${result.known ? format(result.total[key]) : "—"}</strong><small>${unit}</small></div>`;
  }).join("");

  return `
    <section class="card">
      <div class="section-heading">
        <h2>${html(title)}</h2>
        <span class="badge ${complete ? "" : "subtle"}">${badge}</span>
      </div>
      <div class="macro-grid">${cells}</div>
      <p class="help">${[details, ...notes].join(" ")}</p>
    </section>`;
}
