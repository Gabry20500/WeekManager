import type { Food, Profile } from "../models/types";
import { MACRO_KEYS, totalNutrition } from "../services/nutrition";
import { format, formatMacros, html } from "../utils/helpers";

const MACRO_LABELS = {
  kcal: ["Calorie", "kcal"],
  protein: ["Proteine", "g"],
  carbs: ["Carboidrati", "g"],
  fat: ["Grassi", "g"],
} as const;

const MAX_MISSING_LISTED = 4;

function listMissing(names: string[]): string {
  const unique = [...new Set(names)];
  return `${unique.slice(0, MAX_MISSING_LISTED).map(html).join(", ")}${unique.length > MAX_MISSING_LISTED ? "…" : ""}`;
}

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
    result.missingFoods.length ? `Mancano schede per: ${listMissing(result.missingFoods)}` : "",
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

/**
 * Card comparing what was eaten with the plan of the day: one progress bar
 * per macro. Eaten foods count only their saved nutrition; planned ones are
 * resolved against the catalog.
 */
export function renderDayProgress(planned: Food[], consumed: Food[], profiles: Profile[]): string {
  const plan = totalNutrition(planned, profiles, true);
  const eaten = totalNutrition(consumed, profiles, false);
  const hasPlan = plan.known > 0;

  const rows = MACRO_KEYS.map((key) => {
    const [label, unit] = MACRO_LABELS[key];
    const target = plan.total[key];
    const ratio = hasPlan && target > 0 ? eaten.total[key] / target : 0;
    const percent = Math.min(100, Math.round(ratio * 100));
    const amounts = hasPlan
      ? `${format(eaten.total[key])} / ${format(target)} ${unit}`
      : `${format(eaten.total[key])} ${unit}`;

    return `
      <div class="progress-row">
        <div class="progress-head"><span>${label}</span><strong>${amounts}</strong></div>
        <div class="meter ${ratio > 1 ? "over" : ""}" role="img" aria-label="${label}: ${Math.round(ratio * 100)}% del previsto"><span style="width: ${percent}%"></span></div>
      </div>`;
  }).join("");

  const kcalPercent = hasPlan && plan.total.kcal > 0 ? Math.round((eaten.total.kcal / plan.total.kcal) * 100) : 0;
  const notes = [
    hasPlan ? "" : "Il piano di oggi non ha macro calcolabili.",
    plan.missingFoods.length ? `Previsto parziale, mancano schede per: ${listMissing(plan.missingFoods)}` : "",
    eaten.missing ? `${eaten.missing} alimento/i registrati senza macro non sono contati.` : "",
  ].filter(Boolean);

  return `
    <section class="card">
      <div class="section-heading">
        <div><h2>Macro di oggi</h2><p class="muted">Consumato rispetto al previsto</p></div>
        <span class="badge ${eaten.known ? "" : "subtle"}">${hasPlan ? `${kcalPercent}%` : "—"}</span>
      </div>
      <div class="progress-list">${rows}</div>
      ${notes.length ? `<p class="help">${notes.join(" ")}</p>` : ""}
    </section>`;
}
