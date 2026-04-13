export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutesToTime(start: string, minutes: number): string {
  return minutesToTime(timeToMinutes(start) + minutes);
}

export function formatISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODateOnly(iso: string): Date {
  const [y, mo, day] = iso.split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, mo - 1, day));
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
