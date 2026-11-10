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

export type ShoppingUnit = "g" | "ml" | "pezzi" | "porzioni" | "confezioni";

export type StorageLocation = "dispensa" | "frigorifero" | "freezer";

export type ExpiryKind = "use-by" | "best-before";

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
