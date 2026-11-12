import { AVERAGE_DAYS, type WeightPoint } from "../services/weight";
import { axisTicks, bindReadout } from "./chart-readout";
import { format, formatDate, parseDate } from "../utils/helpers";

/*
 * Geometry, in viewBox units. The SVG scales to the width of its container,
 * so the viewBox is sized for a phone: text stays readable there.
 */
const WIDTH = 360;
const HEIGHT = 230;
const MARGIN = { top: 14, right: 46, bottom: 28, left: 34 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

const MS_PER_DAY = 86_400_000;
const TICK_STEPS = [0.5, 1, 2, 5, 10, 20, 50];

type Layout = {
  x(point: WeightPoint): number;
  y(kg: number): number;
  ticks: number[];
  /** Whether the goal is close enough to the data to be drawn. */
  showGoal: boolean;
};

function dayNumber(date: string): number {
  return Math.round(parseDate(date).getTime() / MS_PER_DAY);
}

function shortDate(date: string): string {
  return parseDate(date).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function layout(points: WeightPoint[], goalKg: number | undefined): Layout {
  const values = points.flatMap((point) => [point.kg, point.average]);
  let min = Math.min(...values);
  let max = Math.max(...values);

  // A distant goal would flatten the curve: draw it only when it is nearby.
  const reach = Math.max(2, max - min);
  const showGoal = goalKg !== undefined && goalKg >= min - reach && goalKg <= max + reach;
  if (showGoal) {
    min = Math.min(min, goalKg);
    max = Math.max(max, goalKg);
  }

  const ticks = axisTicks(min, max, TICK_STEPS);
  const low = ticks[0]!;
  const high = ticks.at(-1)!;

  const firstDay = dayNumber(points[0]!.date);
  const days = dayNumber(points.at(-1)!.date) - firstDay;

  return {
    x: (point) => MARGIN.left + (days ? ((dayNumber(point.date) - firstDay) / days) * PLOT_WIDTH : PLOT_WIDTH / 2),
    y: (kg) => MARGIN.top + (1 - (kg - low) / (high - low)) * PLOT_HEIGHT,
    ticks,
    showGoal,
  };
}

const round = (value: number) => value.toFixed(1);

/**
 * Line chart of the weight over time: single weigh-ins as muted dots, the
 * moving average as the line that carries the trend. Needs at least one point.
 */
export function renderWeightChart(points: WeightPoint[], goalKg: number | undefined): string {
  const { x, y, ticks, showGoal } = layout(points, goalKg);
  const first = points[0]!;
  const last = points.at(-1)!;
  const right = WIDTH - MARGIN.right;

  const grid = ticks
    .map(
      (tick) => `
        <line class="chart-grid" x1="${MARGIN.left}" x2="${right}" y1="${round(y(tick))}" y2="${round(y(tick))}"/>
        <text class="chart-axis" x="${MARGIN.left - 6}" y="${round(y(tick) + 4)}" text-anchor="end">${format(tick)}</text>`,
    )
    .join("");

  const dates = [first, ...(points.length > 2 ? [points[Math.floor(points.length / 2)]!] : []), ...(points.length > 1 ? [last] : [])];
  const dateLabels = dates
    .map((point, index) => {
      const anchor = index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle";
      return `<text class="chart-axis" x="${round(x(point))}" y="${HEIGHT - 8}" text-anchor="${points.length === 1 ? "middle" : anchor}">${shortDate(point.date)}</text>`;
    })
    .join("");

  const goal =
    showGoal && goalKg !== undefined
      ? `<line class="chart-goal" x1="${MARGIN.left}" x2="${right}" y1="${round(y(goalKg))}" y2="${round(y(goalKg))}"/>
         <text class="chart-axis" x="${right - 4}" y="${round(y(goalKg) - 5)}" text-anchor="end">Obiettivo</text>`
      : "";

  const dots = points
    .map((point) => `<circle class="chart-dot" cx="${round(x(point))}" cy="${round(y(point.kg))}" r="3.5"/>`)
    .join("");
  const line = points.map((point, index) => `${index ? "L" : "M"}${round(x(point))} ${round(y(point.average))}`).join(" ");

  const label = `Peso dal ${formatDate(first.date)} al ${formatDate(last.date)}. Media a ${AVERAGE_DAYS} giorni da ${format(first.average)} a ${format(last.average)} kg. Usa le frecce per leggere le singole pesate.`;

  return `
    <div class="chart" data-chart="weight">
      <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" tabindex="0" aria-label="${label}">
        ${grid}
        ${dateLabels}
        ${goal}
        ${dots}
        <path class="chart-line" d="${line}"/>
        <circle class="chart-end" cx="${round(x(last))}" cy="${round(y(last.average))}" r="4.5"/>
        <text class="chart-value" x="${round(x(last) + 9)}" y="${round(y(last.average) + 4.5)}">${format(last.average)}</text>
        <line class="chart-crosshair" data-crosshair y1="${MARGIN.top}" y2="${HEIGHT - MARGIN.bottom}" hidden/>
        <circle class="chart-end" data-marker r="4.5" hidden/>
        <rect data-hit x="${MARGIN.left}" y="0" width="${PLOT_WIDTH}" height="${HEIGHT}" fill="transparent"/>
      </svg>
      <div class="chart-tooltip" data-tooltip role="status" hidden></div>
      <ul class="chart-legend">
        <li><span class="legend-dot"></span>Pesata</li>
        <li><span class="legend-line"></span>Media a ${AVERAGE_DAYS} giorni</li>
      </ul>
    </div>`;
}

/**
 * Adds the hover / keyboard readout: a crosshair that snaps to the nearest
 * weigh-in and a tooltip with its values. `points` must be the ones rendered.
 */
export function bindWeightChart(root: ParentNode, points: WeightPoint[], goalKg: number | undefined): void {
  const chart = root.querySelector<HTMLElement>("[data-chart='weight']");
  if (!chart || !points.length) return;

  const { x, y } = layout(points, goalKg);
  const crosshair = chart.querySelector<SVGLineElement>("[data-crosshair]")!;
  const marker = chart.querySelector<SVGCircleElement>("[data-marker]")!;

  bindReadout(chart, {
    count: points.length,
    width: WIDTH,
    x: (index) => x(points[index]!),
    content: (index) => {
      const point = points[index]!;
      return {
        title: formatDate(point.date),
        rows: [
          { key: "legend-dot", value: `${format(point.kg)} kg`, label: "pesata" },
          { key: "legend-line", value: `${format(point.average)} kg`, label: `media a ${AVERAGE_DAYS} giorni` },
        ],
      };
    },
    onSelect: (index) => {
      const point = index === undefined ? undefined : points[index];
      crosshair.toggleAttribute("hidden", !point);
      marker.toggleAttribute("hidden", !point);
      if (!point) return;
      crosshair.setAttribute("x1", round(x(point)));
      crosshair.setAttribute("x2", round(x(point)));
      marker.setAttribute("cx", round(x(point)));
      marker.setAttribute("cy", round(y(point.average)));
    },
  });
}
