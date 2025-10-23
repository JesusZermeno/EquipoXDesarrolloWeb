// /public/core/router.js
function isAuthenticated() {
  return !!(localStorage.getItem("authToken") || sessionStorage.getItem("authToken"));
}
function go(path) {
  const target = `#${path}`;
  if (location.hash !== target) location.hash = path;
}
const routes = {
  "/splash":    () => import("../screens/splash/splash.js"),
  "/login":     () => import("../screens/login/login.js"),
  "/register":  () => import("../screens/register/register.js"),
  "/home":      () => import("../screens/home/home.js"),
  "/dashboard": () => import("../screens/dashboard/dashboard.js"),
};
function guard(path) {
  const authed = isAuthenticated();
  if (path === "/dashboard" && !authed) return "/login";
  if (authed && (path === "/home" || path === "/login")) return "/dashboard";
  if (authed && path === "/register") return "/dashboard";
  return path;
}
function getPath() {
  const path = location.hash.replace("#", "").trim();
  return path || "/splash";
}
export async function navigate() {
  let path = getPath();
  if (!routes[path]) path = "/splash";
  const next = guard(path);
  if (next !== path) { go(next); return; }
  try {
    const module = await routes[path]();
    const root = document.getElementById("app");
    root.innerHTML = "";
    await module.render(root);
  } catch (err) {
    console.error("Error cargando ruta:", path, err);
    go("/splash");
  }
}
export function initRouter() {
  window.addEventListener("hashchange", navigate);
  window.addEventListener("DOMContentLoaded", navigate);
}
initRouter();
