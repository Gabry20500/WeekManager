import { it } from "../locales/it";
/* Nutrition library and meal snapshots. No external dependencies. */
export type NutritionSnapshot = {
  profileId: string;
  profileName: string;
  source: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};
type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type Profile = Nutrients & {
  id: string;
  name: string;
  basis: 'g' | 'ml';
  source: string;
  portions: Record<string, number>;
};
export type FoodLike = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  nutrition?: NutritionSnapshot;
};
export type EntryLike = {
  mealId: string;
  foods: FoodLike[];
};
export const KEY = 'diario-alimentare:nutrition:v1';
export let profiles: Profile[] = [];
export let blocked = false;
export const escape = (s: string) => s.replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]!);
export const number = (value: number) => value.toLocaleString("it-IT", {
  maximumFractionDigits: 1
});
function record(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function nutrients(v: unknown): v is Nutrients {
  return record(v) && ['kcal', 'protein', 'carbs', 'fat'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && v[k] as number >= 0);
}
export function validProfile(v: unknown): v is Profile {
  if (!nutrients(v) || !record(v)) return false;
  return typeof v.id === 'string' && typeof v.name === 'string' && v.name.trim().length > 0 && typeof v.source === 'string' && (v.basis === 'g' || v.basis === 'ml') && record(v.portions) && Object.values(v.portions).every(n => typeof n === 'number' && Number.isFinite(n) && n > 0);
}
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validProfile)) throw new Error('Invalid archive');
    profiles = parsed;
  }
} catch {
  blocked = true;
}
export function saveProfiles(next: Profile[]): boolean {
  if (blocked) {
    alert(it.theNutritionArchiveCouldNot);
    return false;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    profiles = next;
    return true;
  } catch {
    alert(it.nutritionProfilesCouldNotBe);
    return false;
  }
}
export function download(value: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([value], {
    type: 'application/json'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function knownSnapshot(value: unknown): value is NutritionSnapshot {
  return nutrients(value) && record(value) && typeof value.profileId === 'string' && typeof value.profileName === 'string' && typeof value.source === 'string';
}
export function calculateNutrition(entries: EntryLike[]): {
  total: Nutrients;
  missing: number;
  known: number;
} {
  const total: Nutrients = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  };
  let missing = 0;
  let known = 0;
  for (const food of entries.flatMap(e => e.foods)) {
    if (!knownSnapshot(food.nutrition)) {
      missing++;
      continue;
    }
    known++;
    for (const key of ['kcal', 'protein', 'carbs', 'fat'] as const) total[key] += food.nutrition[key];
  }
  return {
    total,
    missing,
    known
  };
}
function macroHtml(result: ReturnType<typeof calculateNutrition>): string {
  return `<div class="macro-grid">${([['kcal', it.calories, 'kcal'], ['protein', it.protein, 'g'], ['carbs', it.carbs, 'g'], ['fat', it.fat, 'g']] as const).map(([key, label, unit]) => `<div class="macro"><span>${label}</span><strong>${result.known ? number(result.total[key]) : '—'}</strong><small>${unit}</small></div>`).join('')}</div>`;
}
export function snapshotFor(profile: Profile, amount: number, unit: string): NutritionSnapshot | undefined {
  const baseAmount = unit === profile.basis ? amount : profile.portions[unit] ? amount * profile.portions[unit]! : NaN;
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return undefined;
  const factor = baseAmount / 100;
  return {
    profileId: profile.id,
    profileName: profile.name,
    source: profile.source,
    kcal: profile.kcal * factor,
    protein: profile.protein * factor,
    carbs: profile.carbs * factor,
    fat: profile.fat * factor
  };
}
export function renderNutritionSummary(entries: EntryLike[]): string {
  const result = calculateNutrition(entries);
  const help = result.missing ? `${result.missing} ${it.loggedFoodSHaveNo}` : result.known ? it.calculatedOnlyFromLoggedFoods : it.noFoodsWithNutritionData;
  return `<section class="card" id="nutrition-summary">
    <div class="section-heading">
      <h2>${result.missing ? it.knownConsumedMacros : it.consumedMacros}</h2>
      <span class="badge ${result.missing ? 'subtle' : ''}">${result.missing ? it.incomplete : it.loggedFoods}</span>
    </div>
    ${macroHtml(result)}
    <p class="help">${help}</p>
    <button type="button" class="button secondary full" id="nutrition-library">${it.manageNutritionProfiles}</button>
  </section>`;
}
export function renderMealNutrition(entry: EntryLike): string {
  const result = calculateNutrition([entry]);
  if (!result.known) return `<p class="help">${it.nutritionDataIsMissingFor}</p>`;
  return `<p class="help">${result.missing ? it.knownSubtotal : it.mealTotal}:
    ${number(result.total.kcal)} kcal · P ${number(result.total.protein)} g · C ${number(result.total.carbs)} g · G ${number(result.total.fat)} g
    ${result.missing ? ` · ${result.missing} ${it.foodSMissingData}` : ''}</p>`;
}
