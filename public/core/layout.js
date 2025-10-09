import { renderHTML } from "../utils/dom.js";

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
  document.getElementById("sidebarMount").innerHTML =
    await renderHTML("./components/sidebar/sidebar.html");
  document.getElementById("topbarMount").innerHTML =
    await renderHTML("./components/topbar/topbar.html");
  document.getElementById("footerMount").innerHTML =
    await renderHTML("./components/footer/footer.html");

  // Contenido de la pantalla actual
  document.getElementById("contentMount").innerHTML =
    await renderHTML(contentPath);

  // Marcar link activo según hash
  const current = location.hash || "#/home";
  document.querySelectorAll(".nav-link-sidebar").forEach(a => {
    a.classList.toggle("active", a.getAttribute("href") === current);
  });
}
