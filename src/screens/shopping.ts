import type {
  PantryLot,
  Profile,
  ShoppingItem,
  ShoppingUnit,
  StorageLocation,
  ExpiryKind,
} from "../models/types";
import { html, format, unitLabel, dateKey } from "../utils/helpers";

export type ShoppingActions = {
  saveShopping(items: ShoppingItem[]): boolean;
  savePantry(lots: PantryLot[]): boolean;
  rerender(): void;
};

export type ShoppingView = "shopping" | "pantry";

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function shoppingUnitLabel(unit: string): string {
  const labels: Record<string, string> = {
    g: "g",
    ml: "ml",
    pezzi: "pezzi",
    porzioni: "porzioni",
    confezioni: "confezioni",
  };
  return labels[unit] ?? unitLabel(unit);
}

function expiryBadge(lot: PantryLot): string {
  if (!lot.expiresAt) {
    return '<span class="badge subtle">Nessuna scadenza</span>';
  }
  const today = new Date(`${dateKey(new Date())}T12:00:00`).getTime();
  const expiry = new Date(`${lot.expiresAt}T12:00:00`).getTime();
  const days = Math.floor((expiry - today) / 86400000);
  if (days < 0) return '<span class="badge danger">Scaduto</span>';
  if (days <= 3) return '<span class="badge warning">In scadenza</span>';
  return '<span class="badge success">Ok</span>';
}

function sortPantry(lots: PantryLot[]): PantryLot[] {
  return [...lots].sort((a, b) => {
    if (!a.expiresAt && !b.expiresAt) return a.name.localeCompare(b.name, "it");
    if (!a.expiresAt) return 1;
    if (!b.expiresAt) return -1;
    return a.expiresAt.localeCompare(b.expiresAt);
  });
}

export function renderShoppingScreen(
  shopping: ShoppingItem[],
  pantry: PantryLot[],
  activeTab: ShoppingView,
): string {
  const shoppingMarkup = shopping.length
    ? shopping
        .map(
          (item) => `
            <article class="card compact-card">
              <div class="section-heading">
                <div>
                  <h2>${html(item.name)}</h2>
                  <p class="muted">${format(item.quantity)} ${html(shoppingUnitLabel(item.unit))}${item.note ? ` · ${html(item.note)}` : ""}</p>
                </div>
                <span class="badge ${item.checked ? "success" : "subtle"}">${item.checked ? "Acquistato" : "Da comprare"}</span>
              </div>
              <div class="actions">
                <button class="button secondary" data-shopping-toggle="${item.id}">${item.checked ? "Segna da comprare" : "Segna acquistato"}</button>
                <button class="button secondary" data-shopping-buy="${item.id}">Passa in dispensa</button>
                <button class="button secondary" data-shopping-edit="${item.id}">Modifica</button>
                <button class="button secondary" data-shopping-delete="${item.id}">Elimina</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<section class="card"><h2>Lista vuota</h2><p class="help">Aggiungi i prodotti che vuoi comprare.</p></section>`;

  const pantryMarkup = sortPantry(pantry)
    .filter((lot) => lot.quantityRemaining > 0)
    .map(
      (lot) => `
        <article class="card compact-card">
          <div class="section-heading">
            <div>
              <h2>${html(lot.name)}</h2>
              <p class="muted">Residuo: ${format(lot.quantityRemaining)} ${html(shoppingUnitLabel(lot.unit))} · Iniziale: ${format(lot.quantityInitial)} ${html(shoppingUnitLabel(lot.unit))}</p>
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
        </article>
      `,
    )
    .join("");

  const currentSection =
    activeTab === "shopping"
      ? `<section class="card"><div class="section-heading"><div><h2>Lista della spesa</h2><p class="muted">Aggiunta manuale e passaggio in dispensa.</p></div></div><div class="actions"><button class="button primary" id="shopping-add">Aggiungi voce</button></div></section>${shoppingMarkup}`
      : `<section class="card"><div class="section-heading"><div><h2>Dispensa</h2><p class="muted">Ogni acquisto resta un lotto separato.</p></div></div><div class="actions"><button class="button primary" id="pantry-add">Aggiungi lotto</button></div></section>${pantryMarkup || `<section class="card"><h2>Dispensa vuota</h2><p class="help">Nessun lotto attivo registrato.</p></section>`}`;

  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">SPESA E DISPENSA</p>
        <h1>Spesa e dispensa</h1>
        <p class="muted">Gestisci lista, lotti, quantità residue e scadenze.</p>
      </div>
    </section>

    <div class="tabs" role="tablist" aria-label="Spesa e dispensa">
      <button class="${activeTab === "shopping" ? "active" : ""}" data-shopping-tab="shopping" role="tab" aria-selected="${activeTab === "shopping"}">Lista della spesa</button>
      <button class="${activeTab === "pantry" ? "active" : ""}" data-shopping-tab="pantry" role="tab" aria-selected="${activeTab === "pantry"}">Dispensa</button>
    </div>

    ${currentSection}
  `;
}

export function bindShoppingScreen(
  root: ParentNode,
  shopping: ShoppingItem[],
  pantry: PantryLot[],
  profiles: Profile[],
  activeTab: ShoppingView,
  setActiveTab: (tab: ShoppingView) => void,
  actions: ShoppingActions,
): void {
  root.querySelectorAll<HTMLButtonElement>("[data-shopping-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.shoppingTab as ShoppingView;
      setActiveTab(next);
      actions.rerender();
    });
  });

  if (activeTab === "shopping") {
    root.querySelector<HTMLButtonElement>("#shopping-add")?.addEventListener("click", () => {
      const name = prompt("Nome prodotto")?.trim();
      if (!name) return;
      const quantity = Number(prompt("Quantità", "1"));
      if (!Number.isFinite(quantity) || quantity <= 0) return alert("Inserisci una quantità valida.");
      const unit = (prompt("Unità: g, ml, pezzi, porzioni, confezioni", "g") || "g") as ShoppingUnit;
      const note = prompt("Nota facoltativa")?.trim() || undefined;
      const next: ShoppingItem[] = [...shopping, { id: createId(), name, quantity, unit, note, checked: false, createdAt: new Date().toISOString() }];
      if (actions.saveShopping(next)) actions.rerender();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-shopping-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.shoppingToggle;
        const next = shopping.map((item) => item.id === id ? { ...item, checked: !item.checked } : item);
        if (actions.saveShopping(next)) actions.rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-shopping-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!confirm("Eliminare questa voce dalla lista della spesa?")) return;
        const id = button.dataset.shoppingDelete;
        const next = shopping.filter((item) => item.id !== id);
        if (actions.saveShopping(next)) actions.rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-shopping-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.shoppingEdit;
        const current = shopping.find((item) => item.id === id);
        if (!current) return;
        const name = prompt("Nome prodotto", current.name)?.trim();
        if (!name) return;
        const quantity = Number(prompt("Quantità", String(current.quantity)));
        if (!Number.isFinite(quantity) || quantity <= 0) return alert("Inserisci una quantità valida.");
        const unit = (prompt("Unità: g, ml, pezzi, porzioni, confezioni", current.unit) || current.unit) as ShoppingUnit;
        const note = prompt("Nota facoltativa", current.note || "")?.trim() || undefined;
        const next = shopping.map((item) => item.id === id ? { ...item, name, quantity, unit, note } : item);
        if (actions.saveShopping(next)) actions.rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-shopping-buy]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.shoppingBuy;
        const item = shopping.find((entry) => entry.id === id);
        if (!item) return;
        const purchasedAt = prompt("Data acquisto (YYYY-MM-DD)", dateKey(new Date())) || dateKey(new Date());
        const location = (prompt("Conservazione: dispensa, frigorifero, freezer", "dispensa") || "dispensa") as StorageLocation;
        const openedAt = prompt("Data apertura facoltativa (YYYY-MM-DD)")?.trim() || undefined;
        const expiresAt = prompt("Scadenza facoltativa (YYYY-MM-DD)")?.trim() || undefined;
        const expiryKind = expiresAt ? ((prompt("Tipo scadenza: use-by oppure best-before", "best-before") || "best-before") as ExpiryKind) : undefined;
        const nextPantry: PantryLot[] = [...pantry, { id: createId(), name: item.name, quantityInitial: item.quantity, quantityRemaining: item.quantity, unit: item.unit, note: item.note, foodProfileId: item.foodProfileId, location, purchasedAt, openedAt, expiresAt, expiryKind, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
        const nextShopping = shopping.map((entry) => entry.id === id ? { ...entry, checked: true } : entry);
        if (actions.savePantry(nextPantry) && actions.saveShopping(nextShopping)) {
          setActiveTab("pantry");
          actions.rerender();
        }
      });
    });
  }

  if (activeTab === "pantry") {
    root.querySelector<HTMLButtonElement>("#pantry-add")?.addEventListener("click", () => {
      const name = prompt("Nome prodotto")?.trim();
      if (!name) return;
      const quantityInitial = Number(prompt("Quantità iniziale", "1"));
      if (!Number.isFinite(quantityInitial) || quantityInitial <= 0) return alert("Inserisci una quantità valida.");
      const unit = (prompt("Unità: g, ml, pezzi, porzioni, confezioni", "g") || "g") as ShoppingUnit;
      const location = (prompt("Conservazione: dispensa, frigorifero, freezer", "dispensa") || "dispensa") as StorageLocation;
      const purchasedAt = prompt("Data acquisto (YYYY-MM-DD)", dateKey(new Date())) || dateKey(new Date());
      const openedAt = prompt("Data apertura facoltativa (YYYY-MM-DD)")?.trim() || undefined;
      const expiresAt = prompt("Scadenza facoltativa (YYYY-MM-DD)")?.trim() || undefined;
      const expiryKind = expiresAt ? ((prompt("Tipo scadenza: use-by oppure best-before", "best-before") || "best-before") as ExpiryKind) : undefined;
      const note = prompt("Nota facoltativa")?.trim() || undefined;
      const nextPantry: PantryLot[] = [...pantry, { id: createId(), name, quantityInitial, quantityRemaining: quantityInitial, unit, note, location, purchasedAt, openedAt, expiresAt, expiryKind, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
      if (actions.savePantry(nextPantry)) actions.rerender();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-pantry-consume]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.pantryConsume;
        const lot = pantry.find((entry) => entry.id === id);
        if (!lot) return;
        const amount = Number(prompt(`Quanto vuoi consumare? (${shoppingUnitLabel(lot.unit)})`, "0"));
        if (!Number.isFinite(amount) || amount <= 0) return alert("Inserisci una quantità valida.");
        if (amount > lot.quantityRemaining) return alert("La quantità supera il residuo disponibile.");
        const nextPantry = pantry.map((entry) => entry.id === id ? { ...entry, quantityRemaining: Number((entry.quantityRemaining - amount).toFixed(2)), updatedAt: new Date().toISOString() } : entry);
        if (actions.savePantry(nextPantry)) actions.rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-pantry-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.pantryEdit;
        const lot = pantry.find((entry) => entry.id === id);
        if (!lot) return;
        const quantityRemaining = Number(prompt("Quantità residua", String(lot.quantityRemaining)));
        if (!Number.isFinite(quantityRemaining) || quantityRemaining < 0 || quantityRemaining > lot.quantityInitial) return alert("Inserisci una quantità residua valida.");
        const location = (prompt("Conservazione: dispensa, frigorifero, freezer", lot.location) || lot.location) as StorageLocation;
        const openedAt = prompt("Data apertura facoltativa (YYYY-MM-DD)", lot.openedAt || "")?.trim() || undefined;
        const expiresAt = prompt("Scadenza facoltativa (YYYY-MM-DD)", lot.expiresAt || "")?.trim() || undefined;
        const expiryKind = expiresAt ? ((prompt("Tipo scadenza: use-by oppure best-before", lot.expiryKind || "best-before") || lot.expiryKind || "best-before") as ExpiryKind) : undefined;
        const nextPantry = pantry.map((entry) => entry.id === id ? { ...entry, quantityRemaining, location, openedAt, expiresAt, expiryKind, updatedAt: new Date().toISOString() } : entry);
        if (actions.savePantry(nextPantry)) actions.rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-pantry-discard]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.pantryDiscard;
        if (!confirm("Scartare questo lotto?")) return;
        const nextPantry = pantry.map((entry) => entry.id === id ? { ...entry, quantityRemaining: 0, updatedAt: new Date().toISOString() } : entry);
        if (actions.savePantry(nextPantry)) actions.rerender();
      });
    });
  }
}
