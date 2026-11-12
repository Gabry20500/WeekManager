/** One line of the tooltip: a colour key, the value and what it is. */
export type ReadoutRow = { key: string; value: string; label: string };

export type ReadoutOptions = {
  /** Number of data positions along the x axis. */
  count: number;
  /** Width of the SVG viewBox, in the same units as `x`. */
  width: number;
  /** Horizontal position of a data point, in viewBox units. */
  x(index: number): number;
  /** Title (usually the date) and rows shown for a data point. */
  content(index: number): { title: string; rows: ReadoutRow[] };
  /** Called when a point is selected or deselected, to move marks on the chart. */
  onSelect?(index: number | undefined): void;
};

/** Pixels between the selected position and the tooltip. */
const TOOLTIP_GAP = 10;

/**
 * Hover and keyboard readout shared by the charts: the pointer selects the
 * nearest data position (it never has to land on a mark), the arrow keys move
 * the selection, and a tooltip lists the values. `chart` must contain an
 * `<svg>` and a `[data-tooltip]` element.
 */
export function bindReadout(chart: HTMLElement, options: ReadoutOptions): void {
  const svg = chart.querySelector("svg");
  const tooltip = chart.querySelector<HTMLElement>("[data-tooltip]");
  if (!svg || !tooltip || !options.count) return;
  let selected = -1;

  const show = (index: number) => {
    if (index < 0 || index >= options.count) return;
    selected = index;
    options.onSelect?.(index);

    const { title, rows } = options.content(index);
    const heading = document.createElement("div");
    heading.className = "chart-tooltip-date";
    heading.textContent = title;
    // Values are untrusted text: build nodes, never markup.
    const lines = rows.map((row) => {
      const line = document.createElement("div");
      const key = document.createElement("span");
      key.className = row.key;
      const value = document.createElement("strong");
      value.textContent = row.value;
      line.append(key, value, ` ${row.label}`);
      return line;
    });
    tooltip.replaceChildren(heading, ...lines);
    tooltip.hidden = false;

    // Sit beside the selected position, on the side where the tooltip fits.
    const box = svg.getBoundingClientRect();
    const pointer = box.left - chart.getBoundingClientRect().left + (options.x(index) / options.width) * box.width;
    const fitsAfter = pointer + TOOLTIP_GAP + tooltip.offsetWidth <= chart.clientWidth;
    const left = fitsAfter ? pointer + TOOLTIP_GAP : pointer - TOOLTIP_GAP - tooltip.offsetWidth;
    tooltip.style.left = `${Math.max(0, left)}px`;
  };

  const hide = () => {
    selected = -1;
    tooltip.hidden = true;
    options.onSelect?.(undefined);
  };

  svg.addEventListener("pointermove", (event) => {
    const box = svg.getBoundingClientRect();
    const pointer = ((event.clientX - box.left) / box.width) * options.width;
    let nearest = 0;
    for (let index = 1; index < options.count; index++) {
      if (Math.abs(options.x(index) - pointer) < Math.abs(options.x(nearest) - pointer)) nearest = index;
    }
    show(nearest);
  });
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("blur", hide);
  svg.addEventListener("focus", () => show(options.count - 1));
  svg.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const from = selected < 0 ? options.count - 1 : selected;
    show(Math.min(options.count - 1, Math.max(0, from + step)));
  });
}

/** "Nice" axis ticks covering `min`..`max` with at most `maxTicks` values. */
export function axisTicks(min: number, max: number, steps: readonly number[], maxTicks = 5): number[] {
  const step = steps.find((candidate) => (max - min) / candidate <= maxTicks - 1) ?? steps.at(-1)!;
  let low = Math.floor(min / step) * step;
  let high = Math.ceil(max / step) * step;
  if (low === high) {
    low -= step;
    high += step;
  }
  const ticks: number[] = [];
  for (let tick = low; tick <= high + step / 2; tick += step) ticks.push(tick);
  return ticks;
}
