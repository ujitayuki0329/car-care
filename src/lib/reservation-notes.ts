const MENU_PREFIX = "【ご希望メニュー】";

export function parseMenuFromNotes(notes: string | null | undefined): string | null {
  if (!notes || !notes.startsWith(MENU_PREFIX)) return null;
  const line = notes.split("\n")[0]?.slice(MENU_PREFIX.length).trim();
  return line || null;
}

export function buildNotesWithMenu(serviceMenu: string, extraNotes?: string | null): string {
  const menuLine = `${MENU_PREFIX}${serviceMenu}`;
  const extra = extraNotes?.trim();
  if (!extra) return menuLine;
  return `${menuLine}\n\n${extra}`;
}

export function parseMemoBodyFromNotes(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  if (!notes.startsWith(MENU_PREFIX)) return notes.trim();
  const firstLineEnd = notes.indexOf("\n");
  if (firstLineEnd === -1) return null;
  const rest = notes.slice(firstLineEnd + 1).replace(/^\n+/, "").trim();
  return rest || null;
}
