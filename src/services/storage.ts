import type {
  Diary,
  Food,
  PantryLot,
  Profile,
  ShoppingItem,
} from "../models/types";
import { builtinProfiles } from "../data/food-catalog";
import { dateKey, parseDate } from "../utils/helpers";

export const DIARY_KEY = "diario-alimentare:diary:v1";
export const PROFILE_KEY = "diario-alimentare:nutrition:v1";
export const SHOPPING_KEY = "diario-alimentare:shopping:v1";
export const PANTRY_KEY = "diario-alimentare:pantry:v1";

export let storageWarning = "";

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validFood(value: unknown): value is Food {
  return (
    object(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.unit === "string" &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    value.amount > 0
  );
}

export function validDiary(value: unknown): value is Diary {
  return (
    object(value) &&
    Object.entries(value).every(
      ([key, entries]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(key) &&
        dateKey(parseDate(key)) === key &&
        Array.isArray(entries) &&
        entries.every(
          (entry) =>
            object(entry) &&
            typeof entry.mealId === "string" &&
            Array.isArray(entry.foods) &&
            entry.foods.every(validFood),
        ),
    )
  );
}

export function validProfile(value: unknown): value is Profile {
  return (
    object(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.source === "string" &&
    (value.aliases === undefined ||
      (Array.isArray(value.aliases) &&
        value.aliases.every((alias) => typeof alias === "string"))) &&
    (value.basis === "g" || value.basis === "ml") &&
    ["kcal", "protein", "carbs", "fat"].every(
      (key) =>
        typeof value[key] === "number" &&
        Number.isFinite(value[key]) &&
        (value[key] as number) >= 0,
    ) &&
    object(value.portions) &&
    Object.values(value.portions).every(
      (n) => typeof n === "number" && Number.isFinite(n) && n > 0,
    )
  );
}

function validShoppingItem(value: unknown): value is ShoppingItem {
  return (
    object(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.quantity === "number" &&
    Number.isFinite(value.quantity) &&
    value.quantity > 0 &&
    typeof value.unit === "string" &&
    typeof value.checked === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function validPantryLot(value: unknown): value is PantryLot {
  return (
    object(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.quantityInitial === "number" &&
    typeof value.quantityRemaining === "number" &&
    Number.isFinite(value.quantityInitial) &&
    Number.isFinite(value.quantityRemaining) &&
    value.quantityInitial > 0 &&
    value.quantityRemaining >= 0 &&
    value.quantityRemaining <= value.quantityInitial &&
    typeof value.unit === "string" &&
    typeof value.location === "string" &&
    typeof value.purchasedAt === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export function loadDiary(): Diary {
  try {
    const text = localStorage.getItem(DIARY_KEY);
    if (!text) return {};
    const parsed: unknown = JSON.parse(text);
    if (!validDiary(parsed)) throw new Error("Invalid diary");
    return parsed;
  } catch {
    storageWarning =
      "Il diario non è leggibile. Il salvataggio è bloccato per non sovrascrivere i dati.";
    return {};
  }
}

export function loadProfiles(): Profile[] {
  try {
    const text = localStorage.getItem(PROFILE_KEY);
    const parsed: unknown = text ? JSON.parse(text) : [];
    if (!Array.isArray(parsed) || !parsed.every(validProfile)) {
      throw new Error("Invalid profiles");
    }
    const ids = new Set(parsed.map((profile) => profile.id));
    return [...parsed, ...builtinProfiles.filter((profile) => !ids.has(profile.id))];
  } catch {
    storageWarning =
      "L’archivio nutrizionale non è leggibile. Il salvataggio è bloccato: conserva un backup dei dati originali.";
    return [...builtinProfiles];
  }
}

export function loadShopping(): ShoppingItem[] {
  try {
    const text = localStorage.getItem(SHOPPING_KEY);
    const parsed: unknown = text ? JSON.parse(text) : [];
    if (!Array.isArray(parsed) || !parsed.every(validShoppingItem)) {
      throw new Error("Invalid shopping list");
    }
    return parsed;
  } catch {
    storageWarning =
      "La lista della spesa non è leggibile. Il salvataggio è bloccato: esporta una copia dei dati attuali.";
    return [];
  }
}

export function loadPantry(): PantryLot[] {
  try {
    const text = localStorage.getItem(PANTRY_KEY);
    const parsed: unknown = text ? JSON.parse(text) : [];
    if (!Array.isArray(parsed) || !parsed.every(validPantryLot)) {
      throw new Error("Invalid pantry");
    }
    return parsed;
  } catch {
    storageWarning =
      "La dispensa non è leggibile. Il salvataggio è bloccato: esporta una copia dei dati attuali.";
    return [];
  }
}

export function save(key: string, value: unknown): boolean {
  if (storageWarning) {
    alert(storageWarning);
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    alert("Salvataggio non riuscito. Nessuna modifica è stata confermata.");
    return false;
  }
}

export function downloadJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportOriginalArchives(): void {
  try {
    downloadJson(
      {
        diaryRaw: localStorage.getItem(DIARY_KEY),
        profilesRaw: localStorage.getItem(PROFILE_KEY),
        shoppingRaw: localStorage.getItem(SHOPPING_KEY),
        pantryRaw: localStorage.getItem(PANTRY_KEY),
      },
      "archivi-originali.json",
    );
  } catch {
    alert("Impossibile esportare gli archivi originali.");
  }
}

export function importBackup(text: string): boolean {
  if (storageWarning) {
    alert(storageWarning);
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    alert("File JSON non valido.");
    return false;
  }

  let nextDiary: Diary | undefined;
  let nextProfiles: Profile[] | undefined;
  let nextShopping: ShoppingItem[] | undefined;
  let nextPantry: PantryLot[] | undefined;

  if (Array.isArray(parsed) && parsed.every(validProfile)) {
    nextProfiles = parsed;
  } else if (
    object(parsed) &&
    parsed.schemaVersion === 2 &&
    validDiary(parsed.diary) &&
    Array.isArray(parsed.profiles) &&
    parsed.profiles.every(validProfile) &&
    Array.isArray(parsed.shopping) &&
    parsed.shopping.every(validShoppingItem) &&
    Array.isArray(parsed.pantry) &&
    parsed.pantry.every(validPantryLot)
  ) {
    nextDiary = parsed.diary;
    nextProfiles = parsed.profiles;
    nextShopping = parsed.shopping;
    nextPantry = parsed.pantry;
  } else if (
    object(parsed) &&
    parsed.schemaVersion === 1 &&
    validDiary(parsed.diary) &&
    Array.isArray(parsed.profiles) &&
    parsed.profiles.every(validProfile)
  ) {
    nextDiary = parsed.diary;
    nextProfiles = parsed.profiles;
  } else if (validDiary(parsed)) {
    nextDiary = parsed;
  } else {
    alert("Formato del backup non riconosciuto. Nessun dato è stato modificato.");
    return false;
  }

  if (
    nextProfiles &&
    new Set(nextProfiles.map((profile) => profile.id)).size !== nextProfiles.length
  ) {
    alert("Il file contiene schede duplicate.");
    return false;
  }

  if (
    !confirm(
      "Importare questo backup sostituendo gli archivi contenuti nel file? Esporta prima una copia dei dati attuali.",
    )
  ) {
    return false;
  }

  let previousDiary: string | null;
  let previousProfiles: string | null;
  let previousShopping: string | null;
  let previousPantry: string | null;

  try {
    previousDiary = localStorage.getItem(DIARY_KEY);
    previousProfiles = localStorage.getItem(PROFILE_KEY);
    previousShopping = localStorage.getItem(SHOPPING_KEY);
    previousPantry = localStorage.getItem(PANTRY_KEY);
  } catch {
    alert("Impossibile leggere gli archivi attuali. Importazione annullata.");
    return false;
  }

  try {
    if (nextDiary) localStorage.setItem(DIARY_KEY, JSON.stringify(nextDiary));
    if (nextProfiles) localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfiles));
    if (nextShopping) localStorage.setItem(SHOPPING_KEY, JSON.stringify(nextShopping));
    if (nextPantry) localStorage.setItem(PANTRY_KEY, JSON.stringify(nextPantry));
    return true;
  } catch {
    try {
      if (previousDiary === null) localStorage.removeItem(DIARY_KEY);
      else localStorage.setItem(DIARY_KEY, previousDiary);

      if (previousProfiles === null) localStorage.removeItem(PROFILE_KEY);
      else localStorage.setItem(PROFILE_KEY, previousProfiles);

      if (previousShopping === null) localStorage.removeItem(SHOPPING_KEY);
      else localStorage.setItem(SHOPPING_KEY, previousShopping);

      if (previousPantry === null) localStorage.removeItem(PANTRY_KEY);
      else localStorage.setItem(PANTRY_KEY, previousPantry);

      alert("Importazione non riuscita. Gli archivi precedenti sono stati ripristinati.");
    } catch {
      alert("Importazione non riuscita e ripristino incompleto. Conserva il backup e non effettuare altre modifiche.");
    }
    return false;
  }
}
