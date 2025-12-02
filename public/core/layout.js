import { renderHTML } from "../utils/dom.js";

function isAuthenticated() {
  return !!(
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    localStorage.getItem("idToken")
  );
}

export async function renderLayout(contentPath) {
  const root = document.getElementById("app");

  // Estructura base del dashboard
  root.innerHTML = `
    <div class="dashboard d-flex">
      <aside id="sidebarMount"></aside>
      <main class="flex-grow-1">
        <div id="topbarMount"></div>
        <section id="contentMount"></section>
        <div id="footerMount"></div>
      </main>
    </div>
  `;

  // Montar componentes
  const $sidebar = document.getElementById("sidebarMount");
  const $topbar  = document.getElementById("topbarMount");
  const $footer  = document.getElementById("footerMount");
  const $content = document.getElementById("contentMount");

  // Sidebar solo si hay sesión
  if (isAuthenticated()) {
    $sidebar.innerHTML = await renderHTML("./components/sidebar/sidebar.html");
    // importa la lógica del sidebar (cierre en móvil, resaltar activo, etc.)
    try { await import("../components/sidebar/sidebar.js"); } catch {}
  } else {
    $sidebar.innerHTML = "";
  }

  // Topbar y footer
  $topbar.innerHTML = await renderHTML("./components/topbar/topbar.html");
  $footer.innerHTML = await renderHTML("./components/footer/footer.html");

  // Contenido de la pantalla actual
  $content.innerHTML = await renderHTML(contentPath);

  // Marcar link activo según hash (soporta #/ruta y #/ruta?x=y)
  const current = (location.hash || "#/home").toLowerCase();
  document.querySelectorAll("#sidebarMount .nav-link-sidebar").forEach(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    const active =
      (current.startsWith("#/dashboard") && href === "#/dashboard") ||
      (current.startsWith("#/home")      && href === "#/home");
    a.classList.toggle("active", active);
  });
}
