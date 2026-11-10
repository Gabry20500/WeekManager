export function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function parseDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}
export function isGymDay(date: string): boolean {
  return [1, 3, 5].includes(parseDate(date).getDay());
}
