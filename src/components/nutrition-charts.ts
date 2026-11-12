import type { DayCalories, WeekAdherence } from "../services/diary";
import { format, formatDate, parseDate } from "../utils/helpers";
import { axisTicks, bindReadout } from "./chart-readout";

/* Geometry, in viewBox units; sized for a phone like the weight chart. */
const WIDTH = 360;
const HEIGHT = 220;
const MARGIN = { top: 12, right: 8, bottom: 28, left: 38 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const KCAL_STEPS = [250, 500, 1000, 2000, 5000];
/** Share of each day's slot taken by its bar. */
const BAR_SHARE = 0.62;

const round = (value: number) => value.toFixed(1);
const kcal = (value: number) => `${format(Math.round(value))} kcal`;

function shortDate(date: string): string {
  return parseDate(date).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function caloriesLayout(days: DayCalories[]) {
  const max = Math.max(1, ...days.map((day) => Math.max(day.consumed ?? 0, day.planned)));
  const ticks = axisTicks(0, max, KCAL_STEPS);
  const top = ticks.at(-1)!;
  const slot = PLOT_WIDTH / days.length;
  return {
    ticks,
    slot,
    center: (index: number) => MARGIN.left + slot * (index + 0.5),
    y: (value: number) => MARGIN.top + (1 - value / top) * PLOT_HEIGHT,
  };
}

/**
 * Bar chart of the calories eaten each day, with the planned amount as a
 * tick across each bar. Days with nothing logged show only the tick.
 */
export function renderCaloriesChart(days: DayCalories[]): string {
  const { ticks, slot, center, y } = caloriesLayout(days);
  const bottom = HEIGHT - MARGIN.bottom;
  const barWidth = slot * BAR_SHARE;

  const grid = ticks
    .map(
      (tick) => `
        <line class="chart-grid" x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${round(y(tick))}" y2="${round(y(tick))}"/>
        <text class="chart-axis" x="${MARGIN.left - 6}" y="${round(y(tick) + 4)}" text-anchor="end">${format(tick)}</text>`,
    )
    .join("");

  const bars = days
    .map((day, index) => {
      const left = center(index) - barWidth / 2;
      const bar =
        day.consumed === undefined
          ? ""
          : `<rect class="chart-bar" x="${round(left)}" y="${round(y(day.consumed))}" width="${round(barWidth)}" height="${round(Math.max(1, bottom - y(day.consumed)))}" rx="2"/>`;
      const target = `<line class="chart-target" x1="${round(center(index) - slot * 0.46)}" x2="${round(center(index) + slot * 0.46)}" y1="${round(y(day.planned))}" y2="${round(y(day.planned))}"/>`;
      return bar + target;
    })
    .join("");

  const labelled = [0, Math.floor((days.length - 1) / 2), days.length - 1].filter(
    (index, position, all) => all.indexOf(index) === position,
  );
  const dates = labelled
    .map((index) => `<text class="chart-axis" x="${round(center(index))}" y="${HEIGHT - 8}" text-anchor="middle">${shortDate(days[index]!.date)}</text>`)
    .join("");

  const logged = days.filter((day) => day.consumed !== undefined).length;
  const label = `Calorie consumate e previste dal ${formatDate(days[0]!.date)} al ${formatDate(days.at(-1)!.date)}: ${logged} giorni registrati su ${days.length}. Usa le frecce per leggere i singoli giorni.`;

  return `
    <div class="chart" data-chart="calories">
      <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" tabindex="0" aria-label="${label}">
        ${grid}
        ${dates}
        <rect class="chart-highlight" data-highlight y="${MARGIN.top}" width="${round(slot)}" height="${PLOT_HEIGHT}" hidden/>
        ${bars}
        <rect x="${MARGIN.left}" y="0" width="${PLOT_WIDTH}" height="${HEIGHT}" fill="transparent"/>
      </svg>
      <div class="chart-tooltip" data-tooltip role="status" hidden></div>
      <ul class="chart-legend">
        <li><span class="legend-bar"></span>Consumate</li>
        <li><span class="legend-target"></span>Previste dal piano</li>
      </ul>
    </div>`;
}

export function bindCaloriesChart(root: ParentNode, days: DayCalories[]): void {
  const chart = root.querySelector<HTMLElement>("[data-chart='calories']");
  if (!chart || !days.length) return;

  const { slot, center } = caloriesLayout(days);
  const highlight = chart.querySelector<SVGRectElement>("[data-highlight]")!;

  bindReadout(chart, {
    count: days.length,
    width: WIDTH,
    x: center,
    content: (index) => {
      const day = days[index]!;
      return {
        title: formatDate(day.date),
        rows: [
          { key: "legend-bar", value: day.consumed === undefined ? "—" : kcal(day.consumed), label: "consumate" },
          { key: "legend-target", value: kcal(day.planned), label: "previste" },
        ],
      };
    },
    onSelect: (index) => {
      highlight.toggleAttribute("hidden", index === undefined);
      if (index !== undefined) highlight.setAttribute("x", round(center(index) - slot / 2));
    },
  });
}

/** The same data as the calories chart, as a table. */
export function renderCaloriesTable(days: DayCalories[]): string {
  const rows = [...days]
    .reverse()
    .map(
      (day) => `
        <tr>
          <th scope="row">${formatDate(day.date)}</th>
          <td>${day.consumed === undefined ? "—" : format(Math.round(day.consumed))}</td>
          <td>${format(Math.round(day.planned))}</td>
        </tr>`,
    )
    .join("");
  return `
    <details class="chart-data">
      <summary>Mostra i dati in tabella</summary>
      <table class="data-table">
        <thead><tr><th scope="col">Giorno</th><th scope="col">Consumate (kcal)</th><th scope="col">Previste (kcal)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

/**
 * One row per week: a bar split into meals logged as planned, logged with
 * changes and not logged, with the counts written out beside it.
 */
export function renderAdherence(weeks: WeekAdherence[]): string {
  const rows = weeks
    .map((week) => {
      const total = week.asPlanned + week.changed + week.missing;
      if (!total) return "";
      const share = (count: number) => `${(count / total) * 100}%`;
      const logged = Math.round(((week.asPlanned + week.changed) / total) * 100);
      const range = `${shortDate(week.start)} – ${shortDate(week.end)}`;
      return `
        <li class="adherence-week">
          <div class="progress-head"><span>${range}</span><strong>${logged}% registrati</strong></div>
          <div class="segments" role="img" aria-label="${range}: ${week.asPlanned} come previsto, ${week.changed} modificati, ${week.missing} non registrati">
            <span class="segment planned" style="width: ${share(week.asPlanned)}"></span>
            <span class="segment changed" style="width: ${share(week.changed)}"></span>
            <span class="segment missing" style="width: ${share(week.missing)}"></span>
          </div>
          <p class="help">${week.asPlanned} come previsto · ${week.changed} modificati · ${week.missing} non registrati</p>
        </li>`;
    })
    .join("");

  if (!rows) return '<p class="help">Ancora nessun pasto previsto nel periodo.</p>';

  return `
    <ul class="adherence">${rows}</ul>
    <ul class="chart-legend">
      <li><span class="legend-box planned"></span>Come previsto</li>
      <li><span class="legend-box changed"></span>Modificati</li>
      <li><span class="legend-box missing"></span>Non registrati</li>
    </ul>`;
}
