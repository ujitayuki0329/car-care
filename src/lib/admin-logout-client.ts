/** ブラウザから管理セッションを終了し、ログイン画面へリダイレクトする */
export async function adminClientLogout() {
  await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
  window.location.href = "/admin/login";
}
