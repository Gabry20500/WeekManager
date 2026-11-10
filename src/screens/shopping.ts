import type { ExpiryKind, PantryLot, ShoppingItem, ShoppingUnit, StorageLocation } from "../models/types";
import { createId, format, html, parseDate, todayKey } from "../utils/helpers";

export type ShoppingView = "shopping" | "pantry";

export type ShoppingActions = {
  setTab(tab: ShoppingView): void;
  saveShopping(items: ShoppingItem[]): boolean;
  savePantry(lots: PantryLot[]): boolean;
  rerender(): void;
};

const MS_PER_DAY = 86_400_000;
/** Lots expiring within this many days are flagged. */
const EXPIRING_SOON_DAYS = 3;

/* ---------------------------------------------------------------
   Rendering
   --------------------------------------------------------------- */

function expiryBadge(lot: PantryLot): string {
  if (!lot.expiresAt) return '<span class="badge subtle">Nessuna scadenza</span>';

  const today = parseDate(todayKey()).getTime();
  const days = Math.floor((parseDate(lot.expiresAt).getTime() - today) / MS_PER_DAY);
  if (days < 0) return '<span class="badge danger">Scaduto</span>';
  if (days <= EXPIRING_SOON_DAYS) return '<span class="badge warning">In scadenza</span>';
  return '<span class="badge success">Ok</span>';
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

function renderShoppingItem(item: ShoppingItem): string {
  return `
    <article class="card compact-card">
      <div class="section-heading">
        <div>
          <h2>${html(item.name)}</h2>
          <p class="muted">${format(item.quantity)} ${html(item.unit)}${item.note ? ` · ${html(item.note)}` : ""}</p>
        </div>
        <span class="badge ${item.checked ? "success" : "subtle"}">${item.checked ? "Acquistato" : "Da comprare"}</span>
      </div>
      <div class="actions">
        <button class="button secondary" data-shopping-toggle="${item.id}">${item.checked ? "Segna da comprare" : "Segna acquistato"}</button>
        <button class="button secondary" data-shopping-buy="${item.id}">Passa in dispensa</button>
        <button class="button secondary" data-shopping-edit="${item.id}">Modifica</button>
        <button class="button secondary" data-shopping-delete="${item.id}">Elimina</button>
      </div>
    </article>`;
}

function renderPantryLot(lot: PantryLot): string {
  const unit = html(lot.unit);
  return `
    <article class="card compact-card">
      <div class="section-heading">
        <div>
          <h2>${html(lot.name)}</h2>
          <p class="muted">Residuo: ${format(lot.quantityRemaining)} ${unit} · Iniziale: ${format(lot.quantityInitial)} ${unit}</p>
        </div>
        ${expiryBadge(lot)}
      </div>
      <dl class="details pantry-details">
        <div><dt>Conservazione</dt><dd>${html(lot.location)}</dd></div>
        <div><dt>Acquistato</dt><dd>${html(lot.purchasedAt)}</dd></div>
        <div><dt>Aperto</dt><dd>${html(lot.openedAt || "—")}</dd></div>
        <div><dt>Scadenza</dt><dd>${html(lot.expiresAt || "Nessuna")}</dd></div>
      </dl>
      <div class="actions">
        <button class="button secondary" data-pantry-consume="${lot.id}">Consuma</button>
        <button class="button secondary" data-pantry-edit="${lot.id}">Modifica</button>
        <button class="button secondary" data-pantry-discard="${lot.id}">Scarta</button>
      </div>
    </article>`;
}

function renderShoppingList(shopping: ShoppingItem[]): string {
  const items = shopping.length
    ? shopping.map(renderShoppingItem).join("")
    : '<section class="card"><h2>Lista vuota</h2><p class="help">Aggiungi i prodotti che vuoi comprare.</p></section>';

  return `
    <section class="card">
      <div class="section-heading">
        <div><h2>Lista della spesa</h2><p class="muted">Aggiunta manuale e passaggio in dispensa.</p></div>
      </div>
      <div class="actions"><button class="button primary" id="shopping-add">Aggiungi voce</button></div>
    </section>
    ${items}`;
}

function renderPantry(pantry: PantryLot[]): string {
  const lots = sortPantry(pantry.filter((lot) => lot.quantityRemaining > 0))
    .map(renderPantryLot)
    .join("");

  return `
    <section class="card">
      <div class="section-heading">
        <div><h2>Dispensa</h2><p class="muted">Ogni acquisto resta un lotto separato.</p></div>
      </div>
      <div class="actions"><button class="button primary" id="pantry-add">Aggiungi lotto</button></div>
    </section>
    ${lots || '<section class="card"><h2>Dispensa vuota</h2><p class="help">Nessun lotto attivo registrato.</p></section>'}`;
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
   Prompts
   --------------------------------------------------------------- */

function askOptional(label: string, current = ""): string | undefined {
  return prompt(label, current)?.trim() || undefined;
}

/** Asks for a number; alerts and returns `undefined` when it is not accepted. */
function askNumber(label: string, initial: string, accept: (value: number) => boolean, error: string): number | undefined {
  const value = Number(prompt(label, initial));
  if (Number.isFinite(value) && accept(value)) return value;
  alert(error);
  return undefined;
}

function askQuantity(label: string, initial: string): number | undefined {
  return askNumber(label, initial, (value) => value > 0, "Inserisci una quantità valida.");
}

function askUnit(current: ShoppingUnit = "g"): ShoppingUnit {
  return (prompt("Unità: g, ml, pezzi, porzioni, confezioni", current) || current) as ShoppingUnit;
}

function askLocation(current: StorageLocation = "dispensa"): StorageLocation {
  return (prompt("Conservazione: dispensa, frigorifero, freezer", current) || current) as StorageLocation;
}

function askPurchaseDate(): string {
  return prompt("Data acquisto (YYYY-MM-DD)", todayKey()) || todayKey();
}

function askOpenedAt(current?: string): string | undefined {
  return askOptional("Data apertura facoltativa (YYYY-MM-DD)", current);
}

function askExpiry(current?: PantryLot): Pick<PantryLot, "expiresAt" | "expiryKind"> {
  const expiresAt = askOptional("Scadenza facoltativa (YYYY-MM-DD)", current?.expiresAt);
  if (!expiresAt) return { expiresAt: undefined, expiryKind: undefined };

  const fallback = current?.expiryKind ?? "best-before";
  const expiryKind = (prompt("Tipo scadenza: use-by oppure best-before", fallback) || fallback) as ExpiryKind;
  return { expiresAt, expiryKind };
}

/* ---------------------------------------------------------------
   Events
   --------------------------------------------------------------- */

/** Binds a click handler to every `[data-<attribute>]` button, passing its value. */
function onClick(root: ParentNode, attribute: string, handler: (id: string) => void): void {
  root.querySelectorAll<HTMLButtonElement>(`[data-${attribute}]`).forEach((button) => {
    button.addEventListener("click", () => handler(button.getAttribute(`data-${attribute}`) ?? ""));
  });
}

function bindShoppingList(
  root: ParentNode,
  shopping: ShoppingItem[],
  pantry: PantryLot[],
  actions: ShoppingActions,
): void {
  const commit = (next: ShoppingItem[]) => {
    if (actions.saveShopping(next)) actions.rerender();
  };

  root.querySelector("#shopping-add")?.addEventListener("click", () => {
    const name = prompt("Nome prodotto")?.trim();
    if (!name) return;
    const quantity = askQuantity("Quantità", "1");
    if (quantity === undefined) return;
    const unit = askUnit();
    const note = askOptional("Nota facoltativa");
    const now = new Date().toISOString();
    commit([...shopping, { id: createId(), name, quantity, unit, note, checked: false, createdAt: now }]);
  });

  onClick(root, "shopping-toggle", (id) => {
    commit(shopping.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  });

  onClick(root, "shopping-delete", (id) => {
    if (!confirm("Eliminare questa voce dalla lista della spesa?")) return;
    commit(shopping.filter((item) => item.id !== id));
  });

  onClick(root, "shopping-edit", (id) => {
    const current = shopping.find((item) => item.id === id);
    if (!current) return;
    const name = prompt("Nome prodotto", current.name)?.trim();
    if (!name) return;
    const quantity = askQuantity("Quantità", String(current.quantity));
    if (quantity === undefined) return;
    const unit = askUnit(current.unit);
    const note = askOptional("Nota facoltativa", current.note);
    commit(shopping.map((item) => (item.id === id ? { ...item, name, quantity, unit, note } : item)));
  });

  onClick(root, "shopping-buy", (id) => {
    const item = shopping.find((entry) => entry.id === id);
    if (!item) return;
    const purchasedAt = askPurchaseDate();
    const location = askLocation();
    const openedAt = askOpenedAt();
    const expiry = askExpiry();
    const now = new Date().toISOString();

    const lot: PantryLot = {
      id: createId(),
      name: item.name,
      quantityInitial: item.quantity,
      quantityRemaining: item.quantity,
      unit: item.unit,
      note: item.note,
      foodProfileId: item.foodProfileId,
      location,
      purchasedAt,
      openedAt,
      ...expiry,
      createdAt: now,
      updatedAt: now,
    };
    const nextShopping = shopping.map((entry) => (entry.id === id ? { ...entry, checked: true } : entry));

    if (actions.savePantry([...pantry, lot]) && actions.saveShopping(nextShopping)) {
      actions.setTab("pantry");
      actions.rerender();
    }
  });
}

function bindPantry(root: ParentNode, pantry: PantryLot[], actions: ShoppingActions): void {
  const commit = (next: PantryLot[]) => {
    if (actions.savePantry(next)) actions.rerender();
  };
  const update = (id: string, changes: Partial<PantryLot>) => {
    const updatedAt = new Date().toISOString();
    commit(pantry.map((lot) => (lot.id === id ? { ...lot, ...changes, updatedAt } : lot)));
  };

  root.querySelector("#pantry-add")?.addEventListener("click", () => {
    const name = prompt("Nome prodotto")?.trim();
    if (!name) return;
    const quantity = askQuantity("Quantità iniziale", "1");
    if (quantity === undefined) return;
    const unit = askUnit();
    const location = askLocation();
    const purchasedAt = askPurchaseDate();
    const openedAt = askOpenedAt();
    const expiry = askExpiry();
    const note = askOptional("Nota facoltativa");
    const now = new Date().toISOString();

    commit([
      ...pantry,
      {
        id: createId(),
        name,
        quantityInitial: quantity,
        quantityRemaining: quantity,
        unit,
        note,
        location,
        purchasedAt,
        openedAt,
        ...expiry,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  onClick(root, "pantry-consume", (id) => {
    const lot = pantry.find((entry) => entry.id === id);
    if (!lot) return;
    const amount = askQuantity(`Quanto vuoi consumare? (${lot.unit})`, "0");
    if (amount === undefined) return;
    if (amount > lot.quantityRemaining) return alert("La quantità supera il residuo disponibile.");
    update(id, { quantityRemaining: Number((lot.quantityRemaining - amount).toFixed(2)) });
  });

  onClick(root, "pantry-edit", (id) => {
    const lot = pantry.find((entry) => entry.id === id);
    if (!lot) return;
    const quantityRemaining = askNumber(
      "Quantità residua",
      String(lot.quantityRemaining),
      (value) => value >= 0 && value <= lot.quantityInitial,
      "Inserisci una quantità residua valida.",
    );
    if (quantityRemaining === undefined) return;
    const location = askLocation(lot.location);
    const openedAt = askOpenedAt(lot.openedAt);
    update(id, { quantityRemaining, location, openedAt, ...askExpiry(lot) });
  });

  onClick(root, "pantry-discard", (id) => {
    if (!confirm("Scartare questo lotto?")) return;
    update(id, { quantityRemaining: 0 });
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
