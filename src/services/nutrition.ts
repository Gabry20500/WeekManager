import type { Food, Nutrients, NutritionSnapshot, Profile } from "../models/types";
import { isFiniteNumber, isRecord } from "../utils/helpers";

export const MACRO_KEYS = ["kcal", "protein", "carbs", "fat"] as const satisfies readonly (keyof Nutrients)[];

export type NutritionTotals = {
  total: Nutrients;
  /** Foods with usable nutrition data. */
  known: number;
  /** Foods without a snapshot or a matching profile. */
  missing: number;
  /** Foods deliberately left out of the calculation (e.g. coffee). */
  excluded: number;
  missingFoods: string[];
};

/** Minimum fuzzy score for a profile to be accepted as a match. */
const MATCH_THRESHOLD = 45;
const NORMALIZE_CACHE_LIMIT = 2000;

const EXCLUDED_NAMES = new Set(["caffe"]);

const STOP_WORDS =
  /\b(a|al|alla|allo|agli|alle|con|da|del|della|dello|dei|degli|delle|di|e|ed|in|il|lo|la|i|gli|le|per|su|tra|fra|gia|bianco|naturale|parzialmente|scremato|crudo|cotto|cotti|cotta|porzione|porzioni|pezzo|pezzi|fetta|fette|tazza|tazze|sostituzione|definire)\b/g;

const normalizeCache = new Map<string, string>();
const profileIndex = new WeakMap<Profile, { name: string; aliases: Set<string>; tokens: Set<string> }>();

/** Reduces a food name to its significant words, for matching against profiles. */
function normalizeName(value: string): string {
  const cached = normalizeCache.get(value);
  if (cached !== undefined) return cached;

  const normalized = value
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(STOP_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizeCache.size >= NORMALIZE_CACHE_LIMIT) normalizeCache.clear();
  normalizeCache.set(value, normalized);
  return normalized;
}

function tokenize(value: string): string[] {
  return normalizeName(value).split(" ").filter(Boolean);
}

/** Normalized name, aliases and name + alias tokens, computed once per profile object. */
function indexProfile(profile: Profile) {
  let entry = profileIndex.get(profile);
  if (!entry) {
    entry = {
      name: normalizeName(profile.name),
      aliases: new Set((profile.aliases ?? []).map(normalizeName).filter(Boolean)),
      tokens: new Set([profile.name, ...(profile.aliases ?? [])].flatMap(tokenize)),
    };
    profileIndex.set(profile, entry);
  }
  return entry;
}

function scoreNameMatch(foodName: string, profile: Profile): number {
  const foodNorm = normalizeName(foodName);
  const indexed = indexProfile(profile);
  if (!foodNorm || !indexed.name) return 0;
  if (foodNorm === indexed.name) return 100;
  if (foodNorm.includes(indexed.name) || indexed.name.includes(foodNorm)) return 80;

  const foodTokens = new Set(foodNorm.split(" "));
  let overlap = 0;
  for (const token of foodTokens) if (indexed.tokens.has(token)) overlap++;
  if (!overlap) return 0;

  const ratio = overlap / Math.max(foodTokens.size, indexed.tokens.size || 1);
  return Math.round(ratio * 60 + overlap * 5);
}

/**
 * Resolves the nutrition profile of a food: explicit link first, then exact
 * normalized name, then exact alias, then the best fuzzy match above the
 * threshold.
 */
export function findProfile(food: Food, available: Profile[]): Profile | undefined {
  if (food.profileId) {
    const direct = available.find((profile) => profile.id === food.profileId);
    if (direct) return direct;
  }

  const foodNorm = normalizeName(food.name);
  const exact = available.find((profile) => indexProfile(profile).name === foodNorm);
  if (exact) return exact;

  const alias = foodNorm ? available.find((profile) => indexProfile(profile).aliases.has(foodNorm)) : undefined;
  if (alias) return alias;

  let best: Profile | undefined;
  let bestScore = 0;
  for (const profile of available) {
    const score = scoreNameMatch(food.name, profile);
    if (score > bestScore) {
      best = profile;
      bestScore = score;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : undefined;
}

export function validSnapshot(value: unknown): value is NutritionSnapshot {
  return (
    isRecord(value) &&
    typeof value.profileId === "string" &&
    typeof value.profileName === "string" &&
    typeof value.source === "string" &&
    MACRO_KEYS.every((key) => isFiniteNumber(value[key]))
  );
}

/**
 * Nutrition of `amount` `unit` of a profile, or `undefined` when the unit
 * cannot be converted to the profile basis (g or ml).
 */
export function createSnapshot(profile: Profile, amount: number, unit: string): NutritionSnapshot | undefined {
  const basisPerUnit = unit === profile.basis ? 1 : profile.portions[unit];
  if (!basisPerUnit) return undefined;

  const baseAmount = amount * basisPerUnit;
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

/** Foods that are deliberately left out of macro totals (e.g. coffee). */
export function isExcludedFood(food: Food): boolean {
  return EXCLUDED_NAMES.has(normalizeName(food.name));
}

/**
 * Copy of a food linked to its catalog profile and carrying the nutrition
 * computed now. Returned unchanged when no profile or conversion is available.
 */
export function withSnapshot(food: Food, available: Profile[]): Food {
  const profile = findProfile(food, available);
  const nutrition = profile && createSnapshot(profile, food.amount, food.unit);
  return profile && nutrition ? { ...food, profileId: profile.id, nutrition } : { ...food };
}

/**
 * Sums the nutrition of a list of foods. Saved snapshots always win; with
 * `includeProfiles` foods without one are resolved against the catalog.
 */
export function totalNutrition(foods: Food[], available: Profile[], includeProfiles = true): NutritionTotals {
  const result: NutritionTotals = {
    total: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    known: 0,
    missing: 0,
    excluded: 0,
    missingFoods: [],
  };

  for (const food of foods) {
    if (isExcludedFood(food)) {
      result.excluded++;
      continue;
    }

    let snapshot = validSnapshot(food.nutrition) ? food.nutrition : undefined;
    if (!snapshot && includeProfiles) {
      const profile = findProfile(food, available);
      if (profile) snapshot = createSnapshot(profile, food.amount, food.unit);
    }

    if (!snapshot) {
      result.missing++;
      result.missingFoods.push(food.name);
      continue;
    }

    result.known++;
    for (const key of MACRO_KEYS) result.total[key] += snapshot[key];
  }

  return result;
}
