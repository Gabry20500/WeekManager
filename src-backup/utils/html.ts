export function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, character => replacements[character] ?? character);
}
export function formatAmount(amount: number): string {
  return amount.toLocaleString("it-IT", {
    maximumFractionDigits: 2
  });
}
