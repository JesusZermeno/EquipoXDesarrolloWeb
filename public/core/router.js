// /public/core/router.js

// Mapa de rutas -> import dinámico del módulo de cada pantalla
const routes = {
  "/splash":   () => import("../screens/splash/splash.js"),
  "/login":    () => import("../screens/login/login.js"),
  "/register": () => import("../screens/register/register.js"),
};

// Obtiene la ruta actual del hash (o /splash por defecto)
function getPath() {
  const path = location.hash.replace("#", "").trim();
  return path || "/splash";
}

// Carga y renderiza la pantalla
export async function navigate() {
  const path = getPath();
  const loader = routes[path] || routes["/splash"]; // fallback a splash

  try {
    const module = await loader();
    const root = document.getElementById("app");
    root.innerHTML = "";                     // limpia el contenedor
    await module.render(root);               // cada screen exporta render(root)
  } catch (err) {
    console.error("Error cargando ruta:", path, err);
    // Fallback simple si algo falla
    location.hash = "/splash";
  }
}

// Inicializa el router
export function initRouter() {
  window.addEventListener("hashchange", navigate);
  window.addEventListener("DOMContentLoaded", navigate);
}

// Arranca el router inmediatamente
initRouter();
