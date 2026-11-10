export type NutritionSnapshot = {
  profileId: string;
  profileName: string;
  source: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Profile = Nutrients & {
  id: string;
  name: string;
  basis: "g" | "ml";
  source: string;
  portions: Record<string, number>;
  aliases?: string[];
  category?: string;
  note?: string;
};

export type FoodLike = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  profileId?: string;
  nutrition?: NutritionSnapshot;
};

const EXCLUDED_NAMES = new Set(["caffe", "caffè"]);

function record(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function nutrients(v: unknown): v is Nutrients {
  return record(v) && ["kcal", "protein", "carbs", "fat"].every((k) => typeof v[k] === "number" && Number.isFinite(v[k]));
}

export function validSnapshot(value: unknown): value is NutritionSnapshot {
  return nutrients(value) && record(value) && typeof value.profileId === "string" && typeof value.profileName === "string" && typeof value.source === "string";
}

function normalizeName(value: string): string {
  return value
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(a|al|alla|allo|agli|alle|con|da|del|della|dello|dei|degli|delle|di|e|ed|in|il|lo|la|i|gli|le|per|su|tra|fra|gia|già|bianco|naturale|parzialmente|scremato|crudo|cotto|cotti|cotta|porzione|porzioni|pezzo|pezzi|fetta|fette|tazza|tazze|sostituzione|definire)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeName(value).split(" ").filter(Boolean);
}

function isExcludedFood(food: FoodLike): boolean {
  return EXCLUDED_NAMES.has(normalizeName(food.name));
}

function scoreNameMatch(foodName: string, profile: Profile): number {
  const foodNorm = normalizeName(foodName);
  const profileNorm = normalizeName(profile.name);
  if (!foodNorm || !profileNorm) return 0;
  if (foodNorm === profileNorm) return 100;
  if (foodNorm.includes(profileNorm) || profileNorm.includes(foodNorm)) return 80;

  const foodTokens = new Set(tokenize(foodName));
  const profileTokens = new Set(tokenize(profile.name));
  const aliases = (profile.aliases ?? []).flatMap((a) => tokenize(a));
  for (const alias of aliases) profileTokens.add(alias);

  let overlap = 0;
  for (const token of foodTokens) if (profileTokens.has(token)) overlap++;
  if (!overlap) return 0;

  const ratio = overlap / Math.max(foodTokens.size, profileTokens.size || 1);
  return Math.round(ratio * 60 + overlap * 5);
}

export function findProfile(food: FoodLike, available: Profile[]): Profile | undefined {
  if (food.profileId) {
    const direct = available.find((profile) => profile.id === food.profileId);
    if (direct) return direct;
  }

  const exact = available.find((profile) => normalizeName(profile.name) === normalizeName(food.name));
  if (exact) return exact;

  let best: Profile | undefined;
  let bestScore = 0;
  for (const profile of available) {
    const score = scoreNameMatch(food.name, profile);
    if (score > bestScore) {
      best = profile;
      bestScore = score;
    }
  }
  return bestScore >= 45 ? best : undefined;
}

export function createSnapshot(profile: Profile, amount: number, unit: string): NutritionSnapshot | undefined {
  const direct = unit === profile.basis ? amount : undefined;
  const converted = profile.portions?.[unit] ? amount * profile.portions[unit] : undefined;
  const baseAmount = direct ?? converted;
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return undefined;
  const factor = baseAmount / 100;
  return {
    profileId: profile.id,
    profileName: profile.name,
    source: profile.source,
    kcal: profile.kcal * factor,
    protein: profile.protein * factor,
    carbs: profile.carbs * factor,
    fat: profile.fat * factor,
  };
}

export function totalNutrition(foods: FoodLike[], available: Profile[], includeProfiles = true) {
  const total: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let missing = 0;
  let known = 0;
  let excluded = 0;
  const missingFoods: string[] = [];

  for (const food of foods) {
    if (isExcludedFood(food)) {
      excluded++;
      continue;
    }
    let snapshot = validSnapshot(food.nutrition) ? food.nutrition : undefined;
    if (!snapshot && includeProfiles) {
      const profile = findProfile(food, available);
      if (profile) snapshot = createSnapshot(profile, food.amount, food.unit);
    }
    if (!snapshot) {
      missing++;
      missingFoods.push(food.name);
      continue;
    }
    known++;
    total.kcal += snapshot.kcal;
    total.protein += snapshot.protein;
    total.carbs += snapshot.carbs;
    total.fat += snapshot.fat;
  }

  return { total, missing, known, excluded, missingFoods };
}

function format(v: number): string {
  return v.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function renderMacros(foods: FoodLike[], available: Profile[], title: string, includeProfiles = true): string {
  const result = totalNutrition(foods, available, includeProfiles);
  const badge = result.known ? (result.missing ? "Parziale" : "Calcolato") : "Da completare";
  const details = result.known
    ? `${result.missing ? "Valori parziali" : "Valori stimati"}: ${format(result.total.kcal)} kcal · P ${format(result.total.protein)} g · C ${format(result.total.carbs)} g · G ${format(result.total.fat)} g`
    : "Nessun macro calcolato.";
  const extras = [
    result.excluded ? `Esclusi ${result.excluded} alimento/i senza impatto macro.` : "",
    result.missingFoods.length ? `Mancano schede per: ${result.missingFoods.slice(0, 4).map(escapeHtml).join(", ")}${result.missingFoods.length > 4 ? "…" : ""}` : "",
  ].filter(Boolean).join(" ");

  return `<section class="card"><div class="section-heading"><h2>${escapeHtml(title)}</h2><span class="badge ${result.missing || !result.known ? "subtle" : ""}">${badge}</span></div><div class="macro-grid">${[
    ["kcal", "Calories", "kcal"],
    ["protein", "Protein", "g"],
    ["carbs", "Carbs", "g"],
    ["fat", "Fat", "g"],
  ].map(([key, label, unit]) => `<div class="macro"><span>${label}</span><strong>${result.known ? format(result.total[key as keyof Nutrients] as number) : "—"}</strong><small>${unit}</small></div>`).join("")}</div><p class="help">${details}${extras ? ` ${extras}` : ""}</p></section>`;
}
