import type { WeightLog } from "../models/types";
import { it } from "../locales/it";
import { inputField, openFormDialog } from "../components/form-dialog";
import { showToast } from "../components/toast";
import { bindWeightChart, renderWeightChart } from "../components/weight-chart";
import {
  AVERAGE_DAYS,
  MAX_KG,
  MIN_KG,
  averageChange,
  lastDays,
  upsertWeight,
  withMovingAverage,
  type WeightPoint,
} from "../services/weight";
import { WEEKDAYS } from "../services/plan";
import { daysUntil, format, formatDate, html, isDateKey, todayKey } from "../utils/helpers";

/** Days shown in the chart; `"all"` for the whole history. */
export type WeightRange = "30" | "90" | "all";

export type WeightState = {
  weight: WeightLog;
  weightRange: WeightRange;
  weightShowAll: boolean;
};

export type WeightActions = {
  saveWeight(next: WeightLog): boolean;
  /** Current data, for actions that run after the screen was redrawn (undo). */
  getWeight(): WeightLog;
  setRange(range: WeightRange): void;
  setShowAll(showAll: boolean): void;
  rerender(): void;
};

const RANGES: readonly (readonly [WeightRange, string])[] = [
  ["30", "30 giorni"],
  ["90", "90 giorni"],
  ["all", "Tutto"],
];

const ROWS_SHOWN = 10;

/** Periods over which the change of the average is reported. */
const CHANGE_PERIODS: readonly (readonly [number, string])[] = [
  [14, "Ultime 2 settimane"],
  [30, "Ultimo mese"],
];

/** "oggi", "ieri" or "N giorni fa" for a past day. */
function daysAgo(date: string): string {
  const days = -(daysUntil(date) ?? 0);
  if (days <= 0) return "oggi";
  return days === 1 ? "ieri" : `${days} giorni fa`;
}
const KG_ATTRIBUTES = `type="number" inputmode="decimal" step="0.1" min="${MIN_KG}" max="${MAX_KG}"`;

function rangePoints(points: WeightPoint[], range: WeightRange): WeightPoint[] {
  return lastDays(points, range === "all" ? undefined : Number(range));
}

/** Signed change in kg, e.g. "−0,4 kg". */
function formatChange(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${format(Math.abs(rounded))} kg`;
}

/** "lun, gio" for the chosen weigh days, in week order. */
function weighDaysLabel(weighDays: number[] | undefined): string {
  return WEEKDAYS.filter(([weekday]) => weighDays?.includes(weekday))
    .map(([, short]) => short.toLowerCase())
    .join(", ");
}

function renderWeighDays(weighDays: number[] | undefined): string {
  const label = weighDaysLabel(weighDays);
  return `
    <section class="card">
      <div class="section-heading">
        <div>
          <h2>Giorni di pesata</h2>
          <p class="muted">${label ? `Promemoria nella schermata Oggi: ${label}.` : "Scegli i giorni in cui vuoi pesarti: te lo ricorderò nella schermata Oggi."}</p>
        </div>
      </div>
      <div class="actions"><button class="button small secondary" id="weight-days">${label ? "Cambia giorni" : "Scegli i giorni"}</button></div>
    </section>`;
}

function renderSummary(points: WeightPoint[], goalKg: number | undefined): string {
  const latest = points.at(-1);
  if (!latest) {
    return `
      <section class="card">
        <h2>Nessuna pesata</h2>
        <p class="help">Registra il peso qui sotto: un paio di volte a settimana, negli stessi giorni e nelle stesse condizioni (al mattino, a digiuno). Dopo due o tre pesate vedrai l’andamento.</p>
      </section>`;
  }

  const changes = CHANGE_PERIODS.map(([days, label]) => {
      const change = averageChange(points, days);
      return `<div><dt>${label}</dt><dd>${change === undefined ? "—" : formatChange(change)}</dd></div>`;
    })
    .join("");

  const goal =
    goalKg === undefined
      ? ""
      : `<div><dt>Obiettivo ${format(goalKg)} kg</dt><dd>${
          Math.abs(latest.average - goalKg) < 0.05 ? "raggiunto" : `mancano ${format(Math.abs(Math.round((goalKg - latest.average) * 10) / 10))} kg`
        }</dd></div>`;

  return `
    <section class="card">
      <p class="muted">Media degli ultimi ${AVERAGE_DAYS} giorni</p>
      <p class="hero-number">${format(latest.average)} <small>kg</small></p>
      <p class="help">Ultima pesata: ${format(latest.kg)} kg, ${daysAgo(latest.date)}</p>
      <dl class="details">${changes}${goal}</dl>
      <div class="actions">
        <button class="button small secondary" id="weight-goal">${goalKg === undefined ? "Imposta obiettivo" : "Modifica obiettivo"}</button>
      </div>
    </section>`;
}

function renderForm(points: WeightPoint[]): string {
  const latest = points.at(-1);
  return `
    <section class="card">
      <h2>Registra pesata</h2>
      <form id="weight-form">
        <div class="editor-grid">
          <label class="field">Data<input id="weight-date" name="date" type="date" required max="${todayKey()}" value="${todayKey()}"></label>
          <label class="field">Peso (kg)<input id="weight-kg" name="kg" ${KG_ATTRIBUTES} required placeholder="${latest ? format(latest.kg) : "Es. 72,5"}"></label>
        </div>
        <button type="submit" class="button primary full" id="weight-save">Salva pesata</button>
      </form>
      <p class="help">Bastano due pesate a settimana, negli stessi giorni e alla stessa ora. Salvando di nuovo la stessa data, il valore viene sostituito.</p>
    </section>`;
}

function renderChartCard(points: WeightPoint[], state: WeightState): string {
  if (!points.length) return "";
  const visible = rangePoints(points, state.weightRange);

  const filters = RANGES.map(
    ([range, label]) =>
      `<button class="${state.weightRange === range ? "active" : ""}" data-weight-range="${range}" aria-pressed="${state.weightRange === range}">${label}</button>`,
  ).join("");

  return `
    <div class="tabs three" role="group" aria-label="Periodo del grafico">${filters}</div>
    <section class="card">
      <div class="section-heading">
        <div><h2>Andamento</h2><p class="muted">La linea è la media a ${AVERAGE_DAYS} giorni, i punti le singole pesate.</p></div>
      </div>
      ${renderWeightChart(visible, state.weight.goalKg)}
    </section>`;
}

function renderTable(points: WeightPoint[], showAll: boolean): string {
  if (!points.length) return "";
  const newestFirst = [...points].reverse();
  const rows = (showAll ? newestFirst : newestFirst.slice(0, ROWS_SHOWN))
    .map(
      (point) => `
        <tr>
          <th scope="row">${html(formatDate(point.date))}</th>
          <td>${format(point.kg)}</td>
          <td>${format(point.average)}</td>
          <td><button class="button small secondary" data-weight-delete="${point.date}" aria-label="Elimina la pesata del ${html(formatDate(point.date))}">Elimina</button></td>
        </tr>`,
    )
    .join("");

  const toggle =
    points.length > ROWS_SHOWN
      ? `<button class="button secondary full" id="weight-toggle">${showAll ? "Mostra solo le ultime" : `Mostra tutte (${points.length})`}</button>`
      : "";

  return `
    <section class="card">
      <h2>Pesate</h2>
      <table class="data-table">
        <thead><tr><th scope="col">Data</th><th scope="col">Peso (kg)</th><th scope="col">Media ${AVERAGE_DAYS} gg</th><th scope="col"><span class="sr-only">Azioni</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${toggle}
    </section>`;
}

/** The weight part of the Trends screen: summary, form, chart and table. */
export function renderWeightSection(state: WeightState): string {
  const points = withMovingAverage(state.weight.entries);
  return `
    ${renderSummary(points, state.weight.goalKg)}
    ${renderWeighDays(state.weight.weighDays)}
    ${renderForm(points)}
    ${renderChartCard(points, state)}
    ${renderTable(points, state.weightShowAll)}`;
}

export function bindWeightSection(root: ParentNode, state: WeightState, actions: WeightActions): void {
  const points = withMovingAverage(state.weight.entries);
  bindWeightChart(root, rangePoints(points, state.weightRange), state.weight.goalKg);

  const commit = (next: WeightLog): boolean => {
    if (!actions.saveWeight(next)) return false;
    actions.rerender();
    return true;
  };

  root.querySelector<HTMLFormElement>("#weight-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const date = String(data.get("date") ?? "");
    const kg = Math.round(Number(data.get("kg")) * 10) / 10;

    if (!isDateKey(date) || date > todayKey()) return showToast("Controlla la data.", { kind: "error" });
    if (!Number.isFinite(kg) || kg < MIN_KG || kg > MAX_KG) return showToast("Controlla il peso.", { kind: "error" });

    const replaced = state.weight.entries.some((entry) => entry.date === date);
    const entries = upsertWeight(state.weight.entries, { date, kg });
    if (commit({ ...state.weight, entries })) showToast(replaced ? it.weightUpdated : it.weightSaved);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-weight-delete]").forEach((button) =>
    button.addEventListener("click", () => {
      const removed = state.weight.entries.find((entry) => entry.date === button.dataset.weightDelete);
      if (!removed) return;
      if (!commit({ ...state.weight, entries: state.weight.entries.filter((entry) => entry !== removed) })) return;

      showToast(`Pesata del ${formatDate(removed.date)} eliminata.`, {
        actionLabel: "Annulla",
        onAction: () => {
          // Put it back, unless that day was weighed again meanwhile.
          const current = actions.getWeight();
          if (current.entries.some((entry) => entry.date === removed.date)) return;
          commit({ ...current, entries: upsertWeight(current.entries, removed) });
        },
      });
    }),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-weight-range]").forEach((button) =>
    button.addEventListener("click", () => {
      actions.setRange(button.dataset.weightRange as WeightRange);
      actions.rerender();
    }),
  );

  root.querySelector("#weight-toggle")?.addEventListener("click", () => {
    actions.setShowAll(!state.weightShowAll);
    actions.rerender();
  });

  root.querySelector("#weight-days")?.addEventListener("click", () => {
    const chosen = state.weight.weighDays ?? [];
    const options = WEEKDAYS.map(
      ([weekday, , long]) =>
        `<label class="check"><input type="checkbox" name="day" value="${weekday}" ${chosen.includes(weekday) ? "checked" : ""}> ${long}</label>`,
    ).join("");
    openFormDialog({
      title: "Giorni di pesata",
      submitLabel: "Salva",
      fields: `<p class="help">Nei giorni scelti, la schermata Oggi ti ricorda di pesarti finché non registri il peso. Nessun giorno: nessun promemoria.</p>${options}`,
      onSubmit: (data) => commit({ ...actions.getWeight(), weighDays: data.getAll("day").map(Number).sort() }),
    });
  });

  root.querySelector("#weight-goal")?.addEventListener("click", () => {
    const current = state.weight.goalKg;
    openFormDialog({
      title: "Obiettivo di peso",
      submitLabel: "Salva",
      fields: `
        ${inputField("Peso obiettivo (kg)", "goal", current === undefined ? "" : String(current), KG_ATTRIBUTES)}
        <p class="help">Lascia vuoto per togliere l’obiettivo.</p>`,
      onSubmit: (data) => {
        const text = String(data.get("goal") ?? "").trim();
        if (!text) {
          const { goalKg: _removed, ...rest } = actions.getWeight();
          return commit(rest);
        }
        const goalKg = Math.round(Number(text) * 10) / 10;
        if (!Number.isFinite(goalKg) || goalKg < MIN_KG || goalKg > MAX_KG) return "Controlla il peso.";
        return commit({ ...actions.getWeight(), goalKg });
      },
    });
  });
}
