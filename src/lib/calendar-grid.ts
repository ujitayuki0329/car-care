/** Server month API と同じ UTC 日付キーでカレンダーを組み立てる */

export function utcMonthMeta(year: number, month: number) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { firstWeekday, lastDay };
}

export function utcIsoFromYmd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function todayUtcIso() {
  const t = new Date();
  return utcIsoFromYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function utcWeekday(y: number, m: number, day: number) {
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

export function ymFromIsoDate(iso: string): { y: number; m: number } {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) };
}

export function ymIsBefore(a: { y: number; m: number }, b: { y: number; m: number }): boolean {
  return a.y < b.y || (a.y === b.y && a.m < b.m);
}
