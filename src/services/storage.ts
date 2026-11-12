import type { Diary, Food, PantryLot, Profile, ShoppingItem, WeightEntry, WeightLog } from "../models/types";
import { builtinProfiles, isBuiltinProfile } from "../data/food-catalog";
import { MACRO_KEYS } from "./nutrition";
import { showToast } from "../components/toast";
import { isDateKey, isFiniteNumber, isRecord } from "../utils/helpers";

function showError(message: string): void {
  showToast(message, { kind: "error" });
}

export const DIARY_KEY = "diario-alimentare:diary:v1";
export const PROFILE_KEY = "diario-alimentare:nutrition:v1";
export const SHOPPING_KEY = "diario-alimentare:shopping:v1";
export const PANTRY_KEY = "diario-alimentare:pantry:v1";
export const WEIGHT_KEY = "diario-alimentare:weight:v1";

const ARCHIVE_KEYS = [DIARY_KEY, PROFILE_KEY, SHOPPING_KEY, PANTRY_KEY, WEIGHT_KEY] as const;
type ArchiveKey = (typeof ARCHIVE_KEYS)[number];

/**
 * Set when an archive cannot be read. While it is set every save is refused,
 * so unreadable data is never overwritten.
 */
let storageWarning = "";

export function getStorageWarning(): string {
  return storageWarning;
}

/* ---------------------------------------------------------------
   Validation
   --------------------------------------------------------------- */

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function listOf<T>(validate: (value: unknown) => value is T) {
  return (value: unknown): value is T[] => Array.isArray(value) && value.every(validate);
}

function validFood(value: unknown): value is Food {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.unit === "string" &&
    isPositiveNumber(value.amount)
  );
}

export function validDiary(value: unknown): value is Diary {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, entries]) =>
        isDateKey(key) &&
        Array.isArray(entries) &&
        entries.every(
          (entry) =>
            isRecord(entry) &&
            typeof entry.mealId === "string" &&
            Array.isArray(entry.foods) &&
            entry.foods.every(validFood),
        ),
    )
  );
}

export function validProfile(value: unknown): value is Profile {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.source === "string" &&
    (value.aliases === undefined ||
      (Array.isArray(value.aliases) && value.aliases.every((alias) => typeof alias === "string"))) &&
    (value.basis === "g" || value.basis === "ml") &&
    MACRO_KEYS.every((key) => isFiniteNumber(value[key]) && value[key] >= 0) &&
    isRecord(value.portions) &&
    Object.values(value.portions).every(isPositiveNumber)
  );
}

function validShoppingItem(value: unknown): value is ShoppingItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isPositiveNumber(value.quantity) &&
    typeof value.unit === "string" &&
    typeof value.checked === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function validPantryLot(value: unknown): value is PantryLot {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isPositiveNumber(value.quantityInitial) &&
    isFiniteNumber(value.quantityRemaining) &&
    value.quantityRemaining >= 0 &&
    value.quantityRemaining <= value.quantityInitial &&
    typeof value.unit === "string" &&
    typeof value.location === "string" &&
    typeof value.purchasedAt === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

const validProfiles = listOf(validProfile);
const validShopping = listOf(validShoppingItem);
const validPantry = listOf(validPantryLot);

function validWeightEntry(value: unknown): value is WeightEntry {
  return isRecord(value) && typeof value.date === "string" && isDateKey(value.date) && isPositiveNumber(value.kg);
}

function validWeightLog(value: unknown): value is WeightLog {
  return (
    isRecord(value) &&
    Array.isArray(value.entries) &&
    value.entries.every(validWeightEntry) &&
    (value.goalKg === undefined || isPositiveNumber(value.goalKg))
  );
}

/* ---------------------------------------------------------------
   Loading and saving
   --------------------------------------------------------------- */

/** Reads one archive; on unreadable data returns `empty` and locks saving. */
function loadArchive<T>(key: ArchiveKey, validate: (value: unknown) => value is T, empty: T, warning: string): T {
  try {
    const text = localStorage.getItem(key);
    if (!text) return empty;
    const parsed: unknown = JSON.parse(text);
    if (!validate(parsed)) throw new Error(`Invalid archive: ${key}`);
    return parsed;
  } catch {
    storageWarning = warning;
    return empty;
  }
}

export function loadDiary(): Diary {
  return loadArchive(
    DIARY_KEY,
    validDiary,
    {},
    "Il diario non è leggibile. Il salvataggio è bloccato per non sovrascrivere i dati.",
  );
}

/**
 * Personal profiles first, then the built-in catalog. Built-in profiles are
 * always taken from the app, so catalog updates reach existing users; copies
 * of them found in older archives are ignored.
 */
export function loadProfiles(): Profile[] {
  const stored = loadArchive(
    PROFILE_KEY,
    validProfiles,
    [],
    "L’archivio nutrizionale non è leggibile. Il salvataggio è bloccato: conserva un backup dei dati originali.",
  );
  return [...stored.filter((profile) => !isBuiltinProfile(profile)), ...builtinProfiles];
}

export function loadShopping(): ShoppingItem[] {
  return loadArchive(
    SHOPPING_KEY,
    validShopping,
    [],
    "La lista della spesa non è leggibile. Il salvataggio è bloccato: esporta una copia dei dati attuali.",
  );
}

export function loadPantry(): PantryLot[] {
  return loadArchive(
    PANTRY_KEY,
    validPantry,
    [],
    "La dispensa non è leggibile. Il salvataggio è bloccato: esporta una copia dei dati attuali.",
  );
}

export function loadWeight(): WeightLog {
  const log = loadArchive(
    WEIGHT_KEY,
    validWeightLog,
    { entries: [] },
    "Le pesate non sono leggibili. Il salvataggio è bloccato: esporta una copia dei dati attuali.",
  );
  return { ...log, entries: [...log.entries].sort((a, b) => a.date.localeCompare(b.date)) };
}

/** Persists one archive. Returns `false` (after telling the user) on failure. */
export function save(key: ArchiveKey, value: unknown): boolean {
  if (storageWarning) {
    showError(storageWarning);
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    showError("Salvataggio non riuscito. Nessuna modifica è stata confermata.");
    return false;
  }
}

/* ---------------------------------------------------------------
   Export and import
   --------------------------------------------------------------- */

export function downloadJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads the archives exactly as stored, even when they are unreadable. */
export function exportOriginalArchives(): void {
  try {
    downloadJson(
      {
        diaryRaw: localStorage.getItem(DIARY_KEY),
        profilesRaw: localStorage.getItem(PROFILE_KEY),
        shoppingRaw: localStorage.getItem(SHOPPING_KEY),
        pantryRaw: localStorage.getItem(PANTRY_KEY),
        weightRaw: localStorage.getItem(WEIGHT_KEY),
      },
      "archivi-originali.json",
    );
  } catch {
    showError("Impossibile esportare gli archivi originali.");
  }
}

/** Everything the app stores, in the format `importBackup` reads back. */
export function createBackup() {
  return {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    diary: loadDiary(),
    profiles: loadProfiles().filter((profile) => !isBuiltinProfile(profile)),
    shopping: loadShopping(),
    pantry: loadPantry(),
    weight: loadWeight(),
  };
}

type BackupContent = Partial<Record<ArchiveKey, unknown>>;

/** Recognizes every supported backup format; `undefined` when none matches. */
function readBackup(parsed: unknown): BackupContent | undefined {
  if (validProfiles(parsed)) return { [PROFILE_KEY]: parsed };

  if (isRecord(parsed) && validDiary(parsed.diary) && validProfiles(parsed.profiles)) {
    const base = { [DIARY_KEY]: parsed.diary, [PROFILE_KEY]: parsed.profiles };
    if (parsed.schemaVersion === 1) return base;
    if (validShopping(parsed.shopping) && validPantry(parsed.pantry)) {
      const lists = { ...base, [SHOPPING_KEY]: parsed.shopping, [PANTRY_KEY]: parsed.pantry };
      if (parsed.schemaVersion === 2) return lists;
      if (parsed.schemaVersion === 3 && validWeightLog(parsed.weight)) return { ...lists, [WEIGHT_KEY]: parsed.weight };
    }
  }

  if (validDiary(parsed)) return { [DIARY_KEY]: parsed };
  return undefined;
}

/**
 * Replaces the archives contained in a backup file. The write is all or
 * nothing: on failure the previous archives are restored.
 */
export function importBackup(text: string): boolean {
  if (storageWarning) {
    showError(storageWarning);
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    showError("File JSON non valido.");
    return false;
  }

  const backup = readBackup(parsed);
  if (!backup) {
    showError("Formato del backup non riconosciuto. Nessun dato è stato modificato.");
    return false;
  }

  const profiles = backup[PROFILE_KEY] as Profile[] | undefined;
  if (profiles && new Set(profiles.map((profile) => profile.id)).size !== profiles.length) {
    showError("Il file contiene schede duplicate.");
    return false;
  }

  if (
    !confirm(
      "Importare questo backup sostituendo gli archivi contenuti nel file? Esporta prima una copia dei dati attuali.",
    )
  ) {
    return false;
  }

  let previous: [ArchiveKey, string | null][];
  try {
    previous = ARCHIVE_KEYS.map((key) => [key, localStorage.getItem(key)]);
  } catch {
    showError("Impossibile leggere gli archivi attuali. Importazione annullata.");
    return false;
  }

  try {
    for (const key of ARCHIVE_KEYS) {
      if (backup[key] !== undefined) localStorage.setItem(key, JSON.stringify(backup[key]));
    }
    return true;
  } catch {
    try {
      for (const [key, value] of previous) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      showError("Importazione non riuscita. Gli archivi precedenti sono stati ripristinati.");
    } catch {
      showError(
        "Importazione non riuscita e ripristino incompleto. Conserva il backup e non effettuare altre modifiche.",
      );
    }
    return false;
  }
}
