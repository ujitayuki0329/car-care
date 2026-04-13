export const SERVICE_MENU_ITEMS = [
  "車検・法定点検",
  "オイル交換",
  "タイヤ交換・ローテーション",
  "ブレーキ点検・整備",
  "エアコン・クーラー",
  "バッテリー・電装",
  "その他・相談",
] as const;

export type ServiceMenu = (typeof SERVICE_MENU_ITEMS)[number];

export function isServiceMenu(s: string): s is ServiceMenu {
  return (SERVICE_MENU_ITEMS as readonly string[]).includes(s);
}
