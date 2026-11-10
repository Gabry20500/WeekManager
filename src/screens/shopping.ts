import type { PantryLot, ShoppingItem, StorageLocation } from "../models/types";
import {
  LOCATION_LABELS,
  openConsumeForm,
  openPantryLotForm,
  openShoppingItemForm,
} from "../components/shopping-forms";
import { showToast } from "../components/toast";
import { createId, daysUntil, format, formatDate, html } from "../utils/helpers";

export type ShoppingView = "shopping" | "pantry";

export type ShoppingActions = {
  setTab(tab: ShoppingView): void;
  /** Current data, for actions that run after the screen was redrawn (undo). */
  getShopping(): ShoppingItem[];
  getPantry(): PantryLot[];
  saveShopping(items: ShoppingItem[]): boolean;
  savePantry(lots: PantryLot[]): boolean;
  rerender(): void;
};

/** Lots expiring within this many days are flagged. */
const EXPIRING_SOON_DAYS = 3;

type ExpiryStatus = "none" | "expired" | "soon" | "ok";

/* ---------------------------------------------------------------
   Expiry
   --------------------------------------------------------------- */

function expiryStatus(lot: PantryLot): ExpiryStatus {
  const days = lot.expiresAt ? daysUntil(lot.expiresAt) : undefined;
  if (days === undefined) return "none";
  if (days < 0) return "expired";
  return days <= EXPIRING_SOON_DAYS ? "soon" : "ok";
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function expiryBadge(lot: PantryLot): string {
  const days = lot.expiresAt ? daysUntil(lot.expiresAt) : undefined;
  if (!lot.expiresAt) return '<span class="badge subtle">Senza scadenza</span>';
  // Dates saved before the date picker existed may not be valid days.
  if (days === undefined) return `<span class="badge subtle">Scade: ${html(lot.expiresAt)}</span>`;

  if (days < 0) return `<span class="badge danger">Scaduto da ${plural(-days, "giorno", "giorni")}</span>`;
  if (days === 0) return '<span class="badge warning">Scade oggi</span>';
  if (days === 1) return '<span class="badge warning">Scade domani</span>';
  if (days <= EXPIRING_SOON_DAYS) return `<span class="badge warning">Scade tra ${days} giorni</span>`;
  return `<span class="badge success">Scade il ${formatDate(lot.expiresAt)}</span>`;
}

/** Earliest expiry first; lots without expiry last, by name. */
function sortPantry(lots: PantryLot[]): PantryLot[] {
  return [...lots].sort((a, b) => {
    if (!a.expiresAt && !b.expiresAt) return a.name.localeCompare(b.name, "it");
    if (!a.expiresAt) return 1;
    if (!b.expiresAt) return -1;
    return a.expiresAt.localeCompare(b.expiresAt);
  });
}

/* ---------------------------------------------------------------
   Rendering
   --------------------------------------------------------------- */

function renderShoppingItem(item: ShoppingItem): string {
  const name = html(item.name);
  return `
    <article class="card list-row ${item.checked ? "done" : ""}">
      <label class="check">
        <input type="checkbox" data-shopping-toggle="${item.id}" ${item.checked ? "checked" : ""} aria-label="${name}: acquistato">
        <span class="list-copy">
          <strong>${name}</strong>
          <small>${format(item.quantity)} ${html(item.unit)}${item.note ? ` · ${html(item.note)}` : ""}</small>
        </span>
      </label>
      <div class="actions">
        <button class="button small ${item.checked ? "primary" : "secondary"}" data-shopping-buy="${item.id}">Metti in dispensa</button>
        <button class="button small secondary" data-shopping-edit="${item.id}">Modifica</button>
        <button class="button small secondary" data-shopping-delete="${item.id}">Elimina</button>
      </div>
    </article>`;
}

function renderPantryLot(lot: PantryLot): string {
  const unit = html(lot.unit);
  const percent = Math.round((lot.quantityRemaining / lot.quantityInitial) * 100);
  const location = LOCATION_LABELS[lot.location as StorageLocation] ?? lot.location;
  const facts = [
    html(location),
    `acquistato il ${html(formatDate(lot.purchasedAt))}`,
    lot.openedAt ? `aperto il ${html(formatDate(lot.openedAt))}` : "",
    lot.note ? html(lot.note) : "",
  ].filter(Boolean);

  return `
    <article class="card compact-card">
      <div class="section-heading">
        <div>
          <h2>${html(lot.name)}</h2>
          <p class="muted">Restano ${format(lot.quantityRemaining)} ${unit} di ${format(lot.quantityInitial)} ${unit}</p>
        </div>
        ${expiryBadge(lot)}
      </div>
      <div class="meter" role="img" aria-label="Residuo ${percent}%"><span style="width: ${percent}%"></span></div>
      <p class="help">${facts.join(" · ")}</p>
      <div class="actions">
        <button class="button small primary" data-pantry-consume="${lot.id}">Consuma</button>
        <button class="button small secondary" data-pantry-edit="${lot.id}">Modifica</button>
        <button class="button small secondary" data-pantry-discard="${lot.id}">Scarta</button>
      </div>
    </article>`;
}

function renderShoppingList(shopping: ShoppingItem[]): string {
  // Items still to buy first; the original order is kept within each group.
  const ordered = [...shopping.filter((item) => !item.checked), ...shopping.filter((item) => item.checked)];
  const toBuy = shopping.filter((item) => !item.checked).length;
  const bought = shopping.length - toBuy;

  const summary = shopping.length
    ? `${plural(toBuy, "voce da comprare", "voci da comprare")}${bought ? ` · ${plural(bought, "acquistata", "acquistate")}` : ""}`
    : "Aggiungi i prodotti che vuoi comprare.";

  return `
    <section class="card">
      <div class="section-heading">
        <div><h2>Lista della spesa</h2><p class="muted">${summary}</p></div>
      </div>
      <div class="actions">
        <button class="button primary" id="shopping-add">Aggiungi voce</button>
        ${bought ? '<button class="button secondary" id="shopping-clear">Rimuovi acquistate</button>' : ""}
      </div>
    </section>
    ${ordered.map(renderShoppingItem).join("")}`;
}

function renderPantry(pantry: PantryLot[]): string {
  const active = sortPantry(pantry.filter((lot) => lot.quantityRemaining > 0));
  const expired = active.filter((lot) => expiryStatus(lot) === "expired").length;
  const soon = active.filter((lot) => expiryStatus(lot) === "soon").length;

  const alerts = [
    expired ? plural(expired, "lotto scaduto", "lotti scaduti") : "",
    soon ? `${soon} in scadenza entro ${EXPIRING_SOON_DAYS} giorni` : "",
  ].filter(Boolean);

  const summary = active.length
    ? `${plural(active.length, "lotto attivo", "lotti attivi")}, ordinati per scadenza.`
    : "Nessun lotto attivo registrato.";

  return `
    <section class="card">
      <div class="section-heading">
        <div><h2>Dispensa</h2><p class="muted">${summary}</p></div>
      </div>
      ${alerts.length ? `<p class="notice" role="status">${alerts.join(" · ")}</p>` : ""}
      <div class="actions"><button class="button primary" id="pantry-add">Aggiungi lotto</button></div>
    </section>
    ${active.map(renderPantryLot).join("")}`;
}

export function renderShoppingScreen(shopping: ShoppingItem[], pantry: PantryLot[], activeTab: ShoppingView): string {
  const tab = (view: ShoppingView, label: string) =>
    `<button class="${activeTab === view ? "active" : ""}" data-shopping-tab="${view}" role="tab" aria-selected="${activeTab === view}">${label}</button>`;

  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">SPESA E DISPENSA</p>
        <h1>Spesa e dispensa</h1>
        <p class="muted">Gestisci lista, lotti, quantità residue e scadenze.</p>
      </div>
    </section>
    <div class="tabs" role="tablist" aria-label="Spesa e dispensa">
      ${tab("shopping", "Lista della spesa")}
      ${tab("pantry", "Dispensa")}
    </div>
    ${activeTab === "shopping" ? renderShoppingList(shopping) : renderPantry(pantry)}`;
}

/* ---------------------------------------------------------------
   Events
   --------------------------------------------------------------- */

/** Binds a click handler to every `[data-<attribute>]` element, passing its value. */
function onClick(root: ParentNode, attribute: string, handler: (id: string) => void): void {
  root.querySelectorAll<HTMLElement>(`[data-${attribute}]`).forEach((element) => {
    element.addEventListener("click", () => handler(element.getAttribute(`data-${attribute}`) ?? ""));
  });
}

function bindShoppingList(
  root: ParentNode,
  shopping: ShoppingItem[],
  pantry: PantryLot[],
  actions: ShoppingActions,
): void {
  const commit = (next: ShoppingItem[]): boolean => {
    if (!actions.saveShopping(next)) return false;
    actions.rerender();
    return true;
  };

  root.querySelector("#shopping-add")?.addEventListener("click", () => {
    openShoppingItemForm(undefined, (values) =>
      commit([...shopping, { id: createId(), ...values, checked: false, createdAt: new Date().toISOString() }]),
    );
  });

  /** Removes items and offers to put them back. */
  const remove = (removed: ShoppingItem[], message: string) => {
    const ids = new Set(removed.map((item) => item.id));
    if (!commit(shopping.filter((item) => !ids.has(item.id)))) return;
    showToast(message, {
      actionLabel: "Annulla",
      onAction: () => {
        const current = actions.getShopping();
        const present = new Set(current.map((item) => item.id));
        if (actions.saveShopping([...current, ...removed.filter((item) => !present.has(item.id))])) {
          actions.rerender();
        }
      },
    });
  };

  root.querySelector("#shopping-clear")?.addEventListener("click", () => {
    const bought = shopping.filter((item) => item.checked);
    remove(bought, `${plural(bought.length, "voce rimossa", "voci rimosse")} dalla lista.`);
  });

  onClick(root, "shopping-toggle", (id) => {
    commit(shopping.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  });

  onClick(root, "shopping-edit", (id) => {
    const current = shopping.find((item) => item.id === id);
    if (!current) return;
    openShoppingItemForm(current, (values) =>
      commit(shopping.map((item) => (item.id === id ? { ...item, ...values } : item))),
    );
  });

  onClick(root, "shopping-delete", (id) => {
    const item = shopping.find((entry) => entry.id === id);
    if (item) remove([item], `“${item.name}” eliminato dalla lista.`);
  });

  // Buying an item turns it into a pantry lot and takes it off the list.
  onClick(root, "shopping-buy", (id) => {
    const item = shopping.find((entry) => entry.id === id);
    if (!item) return;
    openPantryLotForm(
      {
        title: "Metti in dispensa",
        submitLabel: "Aggiungi alla dispensa",
        lot: { name: item.name, quantityInitial: item.quantity, unit: item.unit, note: item.note },
      },
      (values) => {
        const now = new Date().toISOString();
        const lot: PantryLot = {
          id: createId(),
          ...values,
          foodProfileId: item.foodProfileId,
          createdAt: now,
          updatedAt: now,
        };
        if (!actions.savePantry([...pantry, lot])) return false;
        return commit(shopping.filter((entry) => entry.id !== id));
      },
    );
  });
}

function bindPantry(root: ParentNode, pantry: PantryLot[], actions: ShoppingActions): void {
  const commit = (next: PantryLot[]): boolean => {
    if (!actions.savePantry(next)) return false;
    actions.rerender();
    return true;
  };
  const update = (id: string, changes: Partial<PantryLot>): boolean => {
    const updatedAt = new Date().toISOString();
    return commit(pantry.map((lot) => (lot.id === id ? { ...lot, ...changes, updatedAt } : lot)));
  };

  root.querySelector("#pantry-add")?.addEventListener("click", () => {
    openPantryLotForm({ title: "Nuovo lotto", submitLabel: "Aggiungi alla dispensa" }, (values) => {
      const now = new Date().toISOString();
      return commit([...pantry, { id: createId(), ...values, createdAt: now, updatedAt: now }]);
    });
  });

  onClick(root, "pantry-consume", (id) => {
    const lot = pantry.find((entry) => entry.id === id);
    if (!lot) return;
    openConsumeForm(lot, (amount) =>
      update(id, { quantityRemaining: Number((lot.quantityRemaining - amount).toFixed(2)) }),
    );
  });

  onClick(root, "pantry-edit", (id) => {
    const lot = pantry.find((entry) => entry.id === id);
    if (!lot) return;
    openPantryLotForm({ title: "Modifica lotto", submitLabel: "Salva", lot, editing: true }, (values) =>
      update(id, values),
    );
  });

  onClick(root, "pantry-discard", (id) => {
    const lot = pantry.find((entry) => entry.id === id);
    if (!lot || !update(id, { quantityRemaining: 0 })) return;
    showToast(`“${lot.name}” scartato.`, {
      actionLabel: "Annulla",
      onAction: () => {
        const restored = actions
          .getPantry()
          .map((entry) => (entry.id === id ? { ...entry, quantityRemaining: lot.quantityRemaining } : entry));
        if (actions.savePantry(restored)) actions.rerender();
      },
    });
  });
}

export function bindShoppingScreen(
  root: ParentNode,
  shopping: ShoppingItem[],
  pantry: PantryLot[],
  activeTab: ShoppingView,
  actions: ShoppingActions,
): void {
  onClick(root, "shopping-tab", (tab) => {
    actions.setTab(tab as ShoppingView);
    actions.rerender();
  });

  if (activeTab === "shopping") bindShoppingList(root, shopping, pantry, actions);
  else bindPantry(root, pantry, actions);
}
