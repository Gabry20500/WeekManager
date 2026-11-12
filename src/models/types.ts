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
};

export type Diary = Record<string, Entry[]>;

export type Screen = "today" | "shopping" | "weight";

export type WeightEntry = {
  /** Day of the weigh-in, `YYYY-MM-DD`. At most one per day. */
  date: string;
  kg: number;
};

export type WeightLog = {
  /** Sorted by date. */
  entries: WeightEntry[];
  goalKg?: number;
};

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
  createdAt: string;
  updatedAt: string;
};
