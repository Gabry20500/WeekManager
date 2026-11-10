import {
  EXPIRY_KINDS,
  SHOPPING_UNITS,
  STORAGE_LOCATIONS,
  type ExpiryKind,
  type PantryLot,
  type ShoppingItem,
  type ShoppingUnit,
  type StorageLocation,
} from "../models/types";
import { format, html, isDateKey, todayKey } from "../utils/helpers";
import { inputField, openFormDialog, selectField } from "./form-dialog";

export type ShoppingItemValues = Pick<ShoppingItem, "name" | "quantity" | "unit" | "note">;

export type PantryLotValues = Pick<
  PantryLot,
  | "name"
  | "quantityInitial"
  | "quantityRemaining"
  | "unit"
  | "note"
  | "location"
  | "purchasedAt"
  | "openedAt"
  | "expiresAt"
  | "expiryKind"
>;

export const LOCATION_LABELS: Record<StorageLocation, string> = {
  dispensa: "Dispensa",
  frigorifero: "Frigorifero",
  freezer: "Freezer",
};

const EXPIRY_KIND_LABELS: Record<ExpiryKind, string> = {
  "best-before": "Preferibilmente entro (qualità)",
  "use-by": "Da consumare entro (sicurezza)",
};

const UNIT_OPTIONS = SHOPPING_UNITS.map((unit) => [unit, unit] as const);
const LOCATION_OPTIONS = STORAGE_LOCATIONS.map((location) => [location, LOCATION_LABELS[location]] as const);
const EXPIRY_KIND_OPTIONS = EXPIRY_KINDS.map((kind) => [kind, EXPIRY_KIND_LABELS[kind]] as const);

const NAME_ATTRIBUTES = 'required maxlength="160" autocomplete="off"';
const QUANTITY_ATTRIBUTES = 'type="number" inputmode="decimal" step="any" min="0.01" required';

function text(data: FormData, name: string): string {
  return String(data.get(name) ?? "").trim();
}

function optionalText(data: FormData, name: string): string | undefined {
  return text(data, name) || undefined;
}

/** A date input value, or `""` when the stored text is not a valid day. */
function dateValue(value: string | undefined): string {
  return value && isDateKey(value) ? value : "";
}

/** Add or edit one entry of the shopping list. */
export function openShoppingItemForm(
  item: ShoppingItem | undefined,
  onSave: (values: ShoppingItemValues) => boolean,
): void {
  openFormDialog({
    title: item ? "Modifica voce" : "Nuova voce",
    submitLabel: item ? "Salva" : "Aggiungi alla lista",
    fields: `
      ${inputField("Prodotto", "name", item?.name ?? "", `${NAME_ATTRIBUTES} placeholder="Es. latte, pane, uova"`)}
      <div class="editor-grid">
        ${inputField("Quantità", "quantity", String(item?.quantity ?? 1), QUANTITY_ATTRIBUTES)}
        ${selectField("Unità", "unit", UNIT_OPTIONS, item?.unit ?? "pezzi")}
      </div>
      ${inputField("Nota (facoltativa)", "note", item?.note ?? "", 'maxlength="200" placeholder="Es. marca, offerta"')}`,
    onReady: (form) => form.querySelector<HTMLInputElement>('[name="name"]')?.focus(),
    onSubmit: (data) => {
      const quantity = Number(data.get("quantity"));
      if (!text(data, "name") || !Number.isFinite(quantity) || quantity <= 0) return "Controlla nome e quantità.";
      return onSave({
        name: text(data, "name"),
        quantity,
        unit: text(data, "unit") as ShoppingUnit,
        note: optionalText(data, "note"),
      });
    },
  });
}

/**
 * Add or edit a pantry lot. `lot` prefills the form; with `editing` the
 * remaining quantity can be changed separately from the initial one.
 */
export function openPantryLotForm(
  options: { title: string; submitLabel: string; lot?: Partial<PantryLot>; editing?: boolean },
  onSave: (values: PantryLotValues) => boolean,
): void {
  const { lot, editing = false } = options;
  const initial = lot?.quantityInitial ?? 1;

  openFormDialog({
    title: options.title,
    submitLabel: options.submitLabel,
    fields: `
      ${inputField("Prodotto", "name", lot?.name ?? "", NAME_ATTRIBUTES)}
      <div class="editor-grid">
        ${inputField(editing ? "Quantità iniziale" : "Quantità", "quantityInitial", String(initial), QUANTITY_ATTRIBUTES)}
        ${selectField("Unità", "unit", UNIT_OPTIONS, lot?.unit ?? "g")}
      </div>
      ${editing ? inputField("Quantità residua", "quantityRemaining", String(lot?.quantityRemaining ?? initial), 'type="number" inputmode="decimal" step="any" min="0" required') : ""}
      ${selectField("Conservazione", "location", LOCATION_OPTIONS, lot?.location ?? "dispensa")}
      <div class="editor-grid">
        ${inputField("Acquistato il", "purchasedAt", dateValue(lot?.purchasedAt) || todayKey(), 'type="date" required')}
        ${inputField("Aperto il (facoltativo)", "openedAt", dateValue(lot?.openedAt), 'type="date"')}
      </div>
      ${inputField("Scadenza (facoltativa)", "expiresAt", dateValue(lot?.expiresAt), 'type="date"')}
      <div data-expiry-kind>
        ${selectField("Tipo di scadenza", "expiryKind", EXPIRY_KIND_OPTIONS, lot?.expiryKind ?? "best-before")}
      </div>
      ${inputField("Nota (facoltativa)", "note", lot?.note ?? "", 'maxlength="200"')}`,
    onReady: (form) => {
      // The kind of expiry only matters once a date is set.
      const expiresAt = form.querySelector<HTMLInputElement>('[name="expiresAt"]')!;
      const kind = form.querySelector<HTMLElement>("[data-expiry-kind]")!;
      const sync = () => {
        kind.hidden = !expiresAt.value;
      };
      expiresAt.addEventListener("input", sync);
      sync();
    },
    onSubmit: (data) => {
      const quantityInitial = Number(data.get("quantityInitial"));
      const quantityRemaining = editing ? Number(data.get("quantityRemaining")) : quantityInitial;
      const expiresAt = optionalText(data, "expiresAt");

      if (!text(data, "name") || !Number.isFinite(quantityInitial) || quantityInitial <= 0) {
        return "Controlla nome e quantità.";
      }
      if (!Number.isFinite(quantityRemaining) || quantityRemaining < 0) return "Controlla la quantità residua.";
      if (quantityRemaining > quantityInitial) return "Il residuo non può superare la quantità iniziale.";
      if (!isDateKey(text(data, "purchasedAt"))) return "Indica la data di acquisto.";

      return onSave({
        name: text(data, "name"),
        quantityInitial,
        quantityRemaining,
        unit: text(data, "unit") as ShoppingUnit,
        note: optionalText(data, "note"),
        location: text(data, "location") as StorageLocation,
        purchasedAt: text(data, "purchasedAt"),
        openedAt: optionalText(data, "openedAt"),
        expiresAt,
        expiryKind: expiresAt ? (text(data, "expiryKind") as ExpiryKind) : undefined,
      });
    },
  });
}

/** Asks how much of a lot was used. */
export function openConsumeForm(lot: PantryLot, onSave: (amount: number) => boolean): void {
  openFormDialog({
    title: `Consuma ${lot.name}`,
    submitLabel: "Registra consumo",
    fields: `
      <p class="help">Disponibile: ${format(lot.quantityRemaining)} ${html(lot.unit)}</p>
      ${inputField(`Quantità consumata (${lot.unit})`, "amount", "", `type="number" inputmode="decimal" step="any" min="0.01" max="${lot.quantityRemaining}" required`)}
      <button type="button" class="button secondary full" data-all>Ho finito tutto</button>`,
    onReady: (form) => {
      const amount = form.querySelector<HTMLInputElement>('[name="amount"]')!;
      form.querySelector("[data-all]")!.addEventListener("click", () => {
        amount.value = String(lot.quantityRemaining);
        form.requestSubmit();
      });
      amount.focus();
    },
    onSubmit: (data) => {
      const amount = Number(data.get("amount"));
      if (!Number.isFinite(amount) || amount <= 0) return "Inserisci una quantità valida.";
      if (amount > lot.quantityRemaining) return "La quantità supera il residuo disponibile.";
      return onSave(amount);
    },
  });
}
