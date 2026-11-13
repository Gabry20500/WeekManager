export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type NutritionSnapshot = Nutrients & {
  profileId: string;
  profileName: string;
  source: string;
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

export type Food = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  profileId?: string;
  nutrition?: NutritionSnapshot;
};

export type Meal = {
  id: string;
  name: string;
  foods: Food[];
};

export type Entry = {
  mealId: string;
  foods: Food[];
  /** Logged exactly as the plan said. Missing in entries saved by older versions. */
  asPlanned?: boolean;
};

export type MealPlan = {
  /** Meals of each weekday, indexed by `Date.getDay()`: 0 is Sunday. */
  days: Meal[][];
  /** Weekdays (`Date.getDay()` numbers) that are gym days. */
  gymDays: number[];
};

export type Diary = Record<string, Entry[]>;

export type Screen = "today" | "plan" | "shopping" | "weight";

export type WeightEntry = {
  /** Day of the weigh-in, `YYYY-MM-DD`. At most one per day. */
  date: string;
  kg: number;
};

export type WeightLog = {
  /** Sorted by date. */
  entries: WeightEntry[];
  goalKg?: number;
  /** Weekdays (`Date.getDay()` numbers) chosen for weighing in; drives the reminder. */
  weighDays?: number[];
};

/** Units a food amount can be given in, besides the profile basis (g or ml). */
export const PORTION_UNITS = ["pezzi", "fette", "scatolette", "cucchiai", "porzioni", "tazze"] as const;
export type PortionUnit = (typeof PORTION_UNITS)[number];

export const SHOPPING_UNITS = ["g", "ml", "pezzi", "porzioni", "confezioni"] as const;
export type ShoppingUnit = (typeof SHOPPING_UNITS)[number];

export const STORAGE_LOCATIONS = ["dispensa", "frigorifero", "freezer"] as const;
export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

export const EXPIRY_KINDS = ["best-before", "use-by"] as const;
export type ExpiryKind = (typeof EXPIRY_KINDS)[number];

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: number;
  unit: ShoppingUnit;
  note?: string;
  foodProfileId?: string;
  checked: boolean;
  createdAt: string;
};

export type PantryLot = {
  id: string;
  name: string;
  quantityInitial: number;
  quantityRemaining: number;
  unit: ShoppingUnit;
  note?: string;
  foodProfileId?: string;
  location: StorageLocation;
  purchasedAt: string;
  openedAt?: string;
  expiresAt?: string;
  expiryKind?: ExpiryKind;
  /** Quantity thrown away when the lot was discarded, as opposed to eaten. */
  discarded?: number;
  createdAt: string;
  updatedAt: string;
};
