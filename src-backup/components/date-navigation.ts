import { it } from "../locales/it";
import { getDateKey, parseDate } from "../utils/date";
import { escapeHtml } from "../utils/html";
export function renderDateNavigation(selectedDate: string): string {
  const date = parseDate(selectedDate);
  const isToday = selectedDate === getDateKey(new Date());
  const weekday = date.toLocaleDateString("it-IT", {
    weekday: "long"
  });
  const fullDate = date.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  return `
    <div class="date-controls">
      <button
        id="previous"
        class="date-arrow"
        aria-label="${it.previousDay}"
      >
        ←
      </button>

      <div class="date-label" aria-live="polite">
        <span class="date-weekday">
          ${escapeHtml(weekday)}
        </span>

        <strong class="date-full">
          ${escapeHtml(fullDate)}
        </strong>
      </div>

      <button
        id="next"
        class="date-arrow"
        aria-label="${it.nextDay}"
      >
        →
      </button>

      <button
        id="go-today"
        class="today-icon ${isToday ? "is-today" : ""}"
        aria-label="${it.goToToday}"
        title="${it.goToToday}"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="2"
          ></rect>

          <path d="M16 3v4M8 3v4M3 11h18"></path>
          <circle cx="12" cy="16" r="2"></circle>
        </svg>
      </button>
    </div>
  `;
}
